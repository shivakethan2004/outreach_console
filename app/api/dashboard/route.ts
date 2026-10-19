import { NextResponse } from "next/server";
import { addDaysToDate, dateInTimeZone } from "@/lib/crm-time";
import { findReengagementLeads } from "@/lib/reengagement";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const INCOME_GOALS: Record<string, number> = {
  "2026-10": 36_000,
};

function nextMonthStart(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function countWeekdays(start: string, endExclusive: string): number {
  let count = 0;
  for (let date = start; date < endExclusive; date = addDaysToDate(date, 1)) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

function countCalendarDays(start: string, endExclusive: string): number {
  return Math.max(
    0,
    (Date.parse(`${endExclusive}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000
  );
}

export async function GET() {
  const { supabase, user } = await requireAuthenticatedSupabase();
  const [
    settingsResult,
    leadsResult,
    followUpsResult,
    meetingsResult,
    tasksResult,
    activitiesResult,
    campaignsResult,
    outreachRatesResult,
  ] = await Promise.all([
      supabase.from("crm_settings").select("*").eq("owner_id", user.id).maybeSingle(),
      supabase
        .from("leads")
        .select(
          "phone,status,call_priority,closed_outcome,is_archived,created_at,updated_at,pipeline_amount,amount_received,won_at"
        ),
      supabase.from("follow_ups").select("*"),
      supabase.from("meetings").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("activities").select("lead_phone,type,outcome,occurred_at,is_call_attempt"),
      supabase.from("campaigns").select("id").eq("owner_id", user.id),
      supabase
        .from("campaign_outreach_rates")
        .upsert({ owner_id: user.id }, { onConflict: "owner_id" })
        .select("*")
        .single(),
  ]);

  if (settingsResult.error) return supabaseErrorResponse("Load dashboard settings", settingsResult.error);
  if (leadsResult.error) return supabaseErrorResponse("Load dashboard leads", leadsResult.error);
  if (followUpsResult.error) return supabaseErrorResponse("Load dashboard follow-ups", followUpsResult.error);
  if (meetingsResult.error) return supabaseErrorResponse("Load dashboard meetings", meetingsResult.error);
  if (tasksResult.error) return supabaseErrorResponse("Load dashboard tasks", tasksResult.error);
  if (activitiesResult.error) return supabaseErrorResponse("Load dashboard activity", activitiesResult.error);
  if (campaignsResult.error) return supabaseErrorResponse("Load dashboard campaigns", campaignsResult.error);
  if (outreachRatesResult.error) {
    return supabaseErrorResponse("Load campaign outreach rates", outreachRatesResult.error);
  }

  let campaignCalls: {
    campaign_id: string;
    lead_phone: string;
    outcome: string;
    answered: boolean;
    is_conversation: boolean;
    called_at: string;
  }[] = [];
  let campaignLeads: { campaign_id: string; lead_phone: string }[] = [];
  const campaignIds = campaignsResult.data.map((campaign) => campaign.id);
  if (campaignIds.length > 0) {
    const [campaignCallsResult, campaignLeadsResult] = await Promise.all([
      supabase
        .from("campaign_calls")
        .select("campaign_id,lead_phone,outcome,answered,is_conversation,called_at")
        .in("campaign_id", campaignIds),
      supabase
        .from("campaign_leads")
        .select("campaign_id,lead_phone")
        .in("campaign_id", campaignIds),
    ]);
    if (campaignCallsResult.error) {
      return supabaseErrorResponse("Load dashboard campaign calls", campaignCallsResult.error);
    }
    if (campaignLeadsResult.error) {
      return supabaseErrorResponse("Load dashboard campaign leads", campaignLeadsResult.error);
    }
    campaignCalls = campaignCallsResult.data;
    campaignLeads = campaignLeadsResult.data;
  }

  const settings = settingsResult.data ?? {
    daily_call_target: 30,
    reengagement_days: 4,
    time_zone: "Asia/Kolkata",
    monthly_income_goal: 0,
  };
  const today = dateInTimeZone(new Date(), settings.time_zone);
  const currentMonth = today.slice(0, 7);
  const currentMonthStart = `${currentMonth}-01`;
  const nextCurrentMonthStart = nextMonthStart(currentMonthStart);
  const tomorrow = addDaysToDate(today, 1);
  const monthlyIncomeGoal =
    settings.monthly_income_goal || INCOME_GOALS[currentMonth] || 0;
  const campaignLeadPhones = new Set(campaignLeads.map((lead) => lead.lead_phone));
  const campaignLeadsData = leadsResult.data.filter((lead) =>
    campaignLeadPhones.has(lead.phone)
  );
  const totalLeadAnalytics = {
    total_leads: leadsResult.data.length,
    contacted: leadsResult.data.filter(
      (lead) => lead.status === "in_progress" || lead.status === "deal_closed"
    ).length,
    not_contacted: leadsResult.data.filter((lead) => lead.status === "not_contacted").length,
    in_progress: leadsResult.data.filter((lead) => lead.status === "in_progress").length,
    no_answer: leadsResult.data.filter((lead) => lead.status === "no_answer").length,
    closed: leadsResult.data.filter((lead) => lead.status === "deal_closed").length,
    won: leadsResult.data.filter(
      (lead) => lead.status === "deal_closed" && lead.closed_outcome === "won"
    ).length,
    lost: leadsResult.data.filter(
      (lead) => lead.status === "deal_closed" && lead.closed_outcome === "lost"
    ).length,
    deferred: leadsResult.data.filter(
      (lead) => lead.status === "deal_closed" && lead.closed_outcome === "deferred"
    ).length,
    closed_without_outcome: leadsResult.data.filter(
      (lead) => lead.status === "deal_closed" && lead.closed_outcome === null
    ).length,
    archived: leadsResult.data.filter((lead) => lead.is_archived).length,
  };
  const activeLeads = campaignLeadsData.filter(
    (lead) => !lead.is_archived && lead.call_priority !== "not_calling"
  );
  const activeLeadPhones = new Set(activeLeads.map((lead) => lead.phone));
  const pendingFollowUps = followUpsResult.data.filter((item) => item.status === "pending");
  const pipelineLeads = campaignLeadsData.filter(
    (lead) => !lead.is_archived && lead.status === "in_progress"
  );
  const wonLeads = campaignLeadsData.filter(
    (lead) => lead.status === "deal_closed" && lead.closed_outcome === "won"
  );
  const lostLeads = campaignLeadsData.filter(
    (lead) => lead.status === "deal_closed" && lead.closed_outcome === "lost"
  );
  const closedDealCount = wonLeads.length + lostLeads.length;
  const historicalWinRate =
    closedDealCount > 0 ? wonLeads.length / closedDealCount : null;
  const pipelineTarget =
    monthlyIncomeGoal > 0 && historicalWinRate
      ? Math.ceil(monthlyIncomeGoal / historicalWinRate)
      : null;
  const earnedThisMonth = wonLeads.reduce((total, lead) => {
    if (!lead.won_at || dateInTimeZone(new Date(lead.won_at), settings.time_zone).slice(0, 7) !== currentMonth) {
      return total;
    }
    return total + (lead.amount_received ?? 0);
  }, 0);
  const scheduledToday = (value: string | null) =>
    !!value && value.slice(0, 10) === today;
  const campaignCallAttempts = campaignCalls;
  const callDate = (calledAt: string) =>
    dateInTimeZone(new Date(calledAt), settings.time_zone);
  const callsThisMonth = campaignCallAttempts.filter((call) => {
    const date = callDate(call.called_at);
    return date >= currentMonthStart && date < nextCurrentMonthStart;
  });
  const callsToday = campaignCallAttempts.filter((call) => callDate(call.called_at) === today).length;
  const conversationsThisMonth = callsThisMonth.filter(
    (call) => call.answered && call.is_conversation
  ).length;
  const answeredCampaignCalls = campaignCallAttempts.filter((call) => call.answered);
  const allTimeConversations = campaignCallAttempts.filter(
    (call) => call.answered && call.is_conversation
  ).length;
  const noAnswerCampaignCalls = campaignCallAttempts.filter((call) => !call.answered).length;
  const calledLeadPhones = new Set(campaignCallAttempts.map((call) => call.lead_phone));
  const calledLeads = leadsResult.data.filter((lead) => calledLeadPhones.has(lead.phone));
  const inProgressFromCalls = calledLeads.filter(
    (lead) => !lead.is_archived && lead.status === "in_progress"
  ).length;
  const callToAnswerIsAssumed = answeredCampaignCalls.length === 0;
  const callToAnswerRate =
    answeredCampaignCalls.length > 0
      ? answeredCampaignCalls.length / campaignCallAttempts.length
      : Number(outreachRatesResult.data.call_to_answer_rate);
  const callToFollowUpRate =
    campaignCallAttempts.length > 0
      ? campaignCallAttempts.filter((call) => ["follow_up", "meeting"].includes(call.outcome)).length /
        campaignCallAttempts.length
      : null;
  const callToInProgressRate =
    calledLeadPhones.size > 0
      ? inProgressFromCalls / calledLeadPhones.size
      : null;
  const campaignWonLeads = leadsResult.data.filter(
    (lead) =>
      calledLeadPhones.has(lead.phone) &&
      !lead.is_archived &&
      lead.status === "deal_closed" &&
      lead.closed_outcome === "won"
  );
  const campaignLostLeads = leadsResult.data.filter(
    (lead) =>
      calledLeadPhones.has(lead.phone) &&
      !lead.is_archived &&
      lead.status === "deal_closed" &&
      lead.closed_outcome === "lost"
  );
  const campaignClosedDealCount = campaignWonLeads.length + campaignLostLeads.length;
  const campaignCloseRate =
    campaignClosedDealCount > 0
      ? campaignWonLeads.length / campaignClosedDealCount
      : null;
  const actualDealsPerCall =
    campaignWonLeads.length > 0 && campaignCallAttempts.length > 0
      ? campaignWonLeads.length / campaignCallAttempts.length
      : Number(outreachRatesResult.data.call_to_deal_closed_rate);
  const actualDealsPerConversation =
    campaignWonLeads.length > 0 && allTimeConversations > 0
      ? Math.min(1, campaignWonLeads.length / allTimeConversations)
      : Number(outreachRatesResult.data.conversation_to_deal_closed_rate);
  const campaignNoAnswerLeads = campaignLeadsData.filter(
    (lead) => !lead.is_archived && lead.status === "no_answer"
  ).length;
  const campaignEarnedThisMonth = campaignWonLeads.reduce((total, lead) => {
    if (
      !lead.won_at ||
      dateInTimeZone(new Date(lead.won_at), settings.time_zone).slice(0, 7) !== currentMonth
    ) {
      return total;
    }
    return total + (lead.amount_received ?? 0);
  }, 0);
  const recordedCampaignWins = campaignWonLeads.filter(
    (lead) => lead.amount_received !== null && lead.amount_received > 0
  );
  const averageCampaignWonAmount =
    recordedCampaignWins.length > 0
      ? recordedCampaignWins.reduce((total, lead) => total + lead.amount_received!, 0) /
        recordedCampaignWins.length
      : Number(outreachRatesResult.data.expected_deal_amount);
  const calendarDaysLeft = countCalendarDays(today, nextCurrentMonthStart);
  const workingDaysLeft = countWeekdays(today, nextCurrentMonthStart);
  const workingDaysAfterToday = countWeekdays(tomorrow, nextCurrentMonthStart);
  const todayWeekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const isWorkingDayToday = todayWeekday !== 0 && todayWeekday !== 6;
  const remainingIncomeGoal = Math.max(monthlyIncomeGoal - campaignEarnedThisMonth, 0);
  const requiredWins =
    monthlyIncomeGoal <= 0
      ? null
      : remainingIncomeGoal === 0
        ? 0
        : Math.ceil(remainingIncomeGoal / averageCampaignWonAmount);
  const callsNeededForGoal = requiredWins === null
    ? null
    : Math.max(
        Math.ceil(requiredWins / actualDealsPerCall),
        Math.ceil(requiredWins / actualDealsPerConversation / callToAnswerRate)
      );
  const callsCompletedThisMonth = callsThisMonth.length;
  const callsRemainingThisMonth =
    callsNeededForGoal === null
      ? null
      : Math.max(0, callsNeededForGoal - callsCompletedThisMonth);
  const callsPerWorkdayAfterToday =
    callsRemainingThisMonth === null || workingDaysAfterToday === 0
      ? callsRemainingThisMonth === 0
        ? 0
        : null
      : Math.ceil(callsRemainingThisMonth / workingDaysAfterToday);
  const callsBeforeToday = callsCompletedThisMonth - callsToday;
  const callsNeededToday =
    callsNeededForGoal === null || !isWorkingDayToday || workingDaysLeft === 0
      ? callsNeededForGoal === 0 ? 0 : null
      : Math.max(
          0,
          Math.ceil(Math.max(0, callsNeededForGoal - callsBeforeToday) / workingDaysLeft) -
            callsToday
        );
  const conversationsNeededForGoal =
    requiredWins === null
      ? null
      : Math.ceil(requiredWins / actualDealsPerConversation);
  const conversationsRemainingThisMonth =
    conversationsNeededForGoal === null
      ? null
      : Math.max(0, conversationsNeededForGoal - conversationsThisMonth);
  const conversationsPerWorkdayAfterToday =
    conversationsRemainingThisMonth === null || workingDaysAfterToday === 0
      ? conversationsRemainingThisMonth === 0
        ? 0
        : null
      : Math.ceil(conversationsRemainingThisMonth / workingDaysAfterToday);
  const dailyCallTarget =
    callsNeededToday === null ? settings.daily_call_target : callsToday + callsNeededToday;
  const { error: updateOutreachRatesError } = await supabase
    .from("campaign_outreach_rates")
    .update({
      call_to_answer_rate: callToAnswerRate,
      call_to_follow_up_rate:
        callToFollowUpRate ?? Number(outreachRatesResult.data.call_to_follow_up_rate),
      call_to_in_progress_rate:
        callToInProgressRate ?? Number(outreachRatesResult.data.call_to_in_progress_rate),
      call_to_deal_closed_rate: actualDealsPerCall,
      conversation_to_deal_closed_rate: actualDealsPerConversation,
      expected_deal_amount: Math.round(averageCampaignWonAmount),
    })
    .eq("owner_id", user.id);
  if (updateOutreachRatesError) {
    return supabaseErrorResponse("Update campaign outreach rates", updateOutreachRatesError);
  }
  const meetingsToday = meetingsResult.data.filter(
    (meeting) => meeting.status === "scheduled" && scheduledToday(meeting.scheduled_at)
  ).length;
  const callFollowUpsToday = pendingFollowUps.filter(
    (item) => item.type === "call" && scheduledToday(item.scheduled_at)
  ).length;
  const whatsappFollowUps = pendingFollowUps.filter(
    (item) => item.type === "whatsapp" &&
      (!item.scheduled_at || scheduledToday(item.scheduled_at))
  ).length;
  const tasksToday = tasksResult.data.filter(
    (task) => task.status === "pending" && (!task.due_at || scheduledToday(task.due_at))
  ).length;

  const campaignPendingFollowUps = pendingFollowUps.filter((item) =>
    campaignLeadPhones.has(item.lead_phone)
  );
  const reengagementCount = findReengagementLeads(
    campaignLeadsData,
    activitiesResult.data.filter(
      (activity) => !!activity.lead_phone && campaignLeadPhones.has(activity.lead_phone)
    ),
    campaignPendingFollowUps,
    today,
    settings.reengagement_days,
    settings.time_zone
  ).length;
  const contactedPhones = new Set(
    campaignCallAttempts
      .filter((call) => call.answered && activeLeadPhones.has(call.lead_phone))
      .map((call) => call.lead_phone)
  );
  const progressDays = 30;
  const progressStart = addDaysToDate(today, -(progressDays - 1));
  const callsByDate = new Map<string, number>();
  for (const call of campaignCallAttempts) {
    const date = callDate(call.called_at);
    if (date < progressStart || date > today) continue;
    callsByDate.set(date, (callsByDate.get(date) || 0) + 1);
  }
  const callProgress = Array.from({ length: progressDays }, (_, index) => {
    const date = addDaysToDate(progressStart, index);
    const calls = callsByDate.get(date) || 0;
    return {
      date,
      calls,
      target: settings.daily_call_target,
      percent: Math.round((calls / settings.daily_call_target) * 100),
    };
  });

  return NextResponse.json({
    date: today,
    settings,
    today_work: {
      call_target: dailyCallTarget,
      calls_completed: callsToday,
      meetings: meetingsToday,
      call_follow_ups: callFollowUpsToday,
      whatsapp_follow_ups: whatsappFollowUps,
      tasks: tasksToday,
    },
    total_lead_analytics: totalLeadAnalytics,
    campaign_analytics: {
      total_leads: campaignLeadPhones.size,
      active_leads: activeLeads.length,
      not_contacted: campaignLeadsData.filter((lead) => lead.status === "not_contacted").length,
      in_progress: campaignLeadsData.filter((lead) => lead.status === "in_progress").length,
      no_answer: campaignLeadsData.filter((lead) => lead.status === "no_answer").length,
      answered_called_leads: contactedPhones.size,
      closed: campaignLeadsData.filter((lead) => lead.status === "deal_closed").length,
      won: campaignLeadsData.filter(
        (lead) => lead.status === "deal_closed" && lead.closed_outcome === "won"
      ).length,
      lost: campaignLeadsData.filter(
        (lead) => lead.status === "deal_closed" && lead.closed_outcome === "lost"
      ).length,
      deferred: campaignLeadsData.filter(
        (lead) => lead.status === "deal_closed" && lead.closed_outcome === "deferred"
      ).length,
      follow_ups: campaignPendingFollowUps.length,
      reengagement_needed: reengagementCount,
    },
    money: {
      pipeline_amount: pipelineLeads.reduce((total, lead) => total + lead.pipeline_amount, 0),
      pipeline_leads: pipelineLeads.length,
      earned_this_month: earnedThisMonth,
      earned_all_time: wonLeads.reduce(
        (total, lead) => total + (lead.amount_received ?? 0),
        0
      ),
      monthly_income_goal: monthlyIncomeGoal,
      pipeline_target: pipelineTarget,
      historical_win_rate: historicalWinRate,
      closed_deals: closedDealCount,
      won_deals: wonLeads.length,
    },
    outreach_plan: {
      current_month: currentMonth,
      income_goal: monthlyIncomeGoal,
      income_earned: campaignEarnedThisMonth,
      income_remaining: remainingIncomeGoal,
      calendar_days_left: calendarDaysLeft,
      working_days_left: workingDaysLeft,
      working_days_after_today: workingDaysAfterToday,
      campaign_leads: campaignLeadPhones.size,
      unique_leads_called: calledLeadPhones.size,
      calls_all_time: campaignCallAttempts.length,
      conversations_all_time: allTimeConversations,
      no_answer_calls_all_time: noAnswerCampaignCalls,
      no_answer_lead_status: campaignNoAnswerLeads,
      calls_this_month: callsCompletedThisMonth,
      calls_today: callsToday,
      conversations_this_month: conversationsThisMonth,
      answered_this_month: callsThisMonth.filter((call) => call.answered).length,
      call_to_answer_rate: callToAnswerRate,
      call_to_follow_up_rate: callToFollowUpRate,
      call_to_in_progress_rate: callToInProgressRate,
      call_to_answer_is_assumed: callToAnswerIsAssumed,
      call_to_deal_closed_rate: actualDealsPerCall,
      conversation_to_deal_closed_rate: actualDealsPerConversation,
      in_progress_leads: inProgressFromCalls,
      campaign_won_leads: campaignWonLeads.length,
      campaign_lost_leads: campaignLostLeads.length,
      close_rate: campaignCloseRate,
      average_won_amount: averageCampaignWonAmount,
      deal_closing_deals: campaignWonLeads.length,
      is_using_initial_deal_rates: campaignWonLeads.length === 0,
      calls_needed_for_goal: callsNeededForGoal,
      calls_remaining_this_month: callsRemainingThisMonth,
      calls_needed_today: callsNeededToday,
      calls_per_workday_after_today: callsPerWorkdayAfterToday,
      conversations_needed_for_goal: conversationsNeededForGoal,
      conversations_remaining_this_month: conversationsRemainingThisMonth,
      conversations_per_workday_after_today: conversationsPerWorkdayAfterToday,
    },
    call_progress: callProgress,
    next_workday: tomorrow,
  });
}
