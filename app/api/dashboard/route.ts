import { NextResponse } from "next/server";
import { addDaysToDate, dateInTimeZone } from "@/lib/crm-time";
import { findReengagementLeads } from "@/lib/reengagement";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireAuthenticatedSupabase();
  const [settingsResult, leadsResult, followUpsResult, meetingsResult, tasksResult, activitiesResult] =
    await Promise.all([
      supabase.from("crm_settings").select("*").eq("owner_id", user.id).maybeSingle(),
      supabase.from("leads").select("phone,status,closed_outcome,is_archived,created_at,updated_at"),
      supabase.from("follow_ups").select("*"),
      supabase.from("meetings").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("activities").select("lead_phone,type,outcome,occurred_at,is_call_attempt"),
    ]);

  if (settingsResult.error) return supabaseErrorResponse("Load dashboard settings", settingsResult.error);
  if (leadsResult.error) return supabaseErrorResponse("Load dashboard leads", leadsResult.error);
  if (followUpsResult.error) return supabaseErrorResponse("Load dashboard follow-ups", followUpsResult.error);
  if (meetingsResult.error) return supabaseErrorResponse("Load dashboard meetings", meetingsResult.error);
  if (tasksResult.error) return supabaseErrorResponse("Load dashboard tasks", tasksResult.error);
  if (activitiesResult.error) return supabaseErrorResponse("Load dashboard activity", activitiesResult.error);

  const settings = settingsResult.data ?? {
    daily_call_target: 30,
    reengagement_days: 4,
    time_zone: "Asia/Kolkata",
  };
  const today = dateInTimeZone(new Date(), settings.time_zone);
  const tomorrow = addDaysToDate(today, 1);
  const activeLeads = leadsResult.data.filter((lead) => !lead.is_archived);
  const pendingFollowUps = followUpsResult.data.filter((item) => item.status === "pending");
  const scheduledToday = (value: string | null) =>
    !!value && value.slice(0, 10) === today;
  const callsToday = activitiesResult.data.filter(
    (activity) => activity.is_call_attempt && scheduledToday(activity.occurred_at)
  ).length;
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

  const reengagementCount = findReengagementLeads(
    leadsResult.data,
    activitiesResult.data,
    pendingFollowUps,
    today,
    settings.reengagement_days,
    settings.time_zone
  ).length;
  const contactedPhones = new Set(
    activitiesResult.data
      .filter(
        (activity) =>
          activity.lead_phone &&
          ((activity.type === "call" && activity.outcome !== "no_answer") ||
            activity.type === "whatsapp")
      )
      .map((activity) => activity.lead_phone)
  );
  const progressDays = 30;
  const progressStart = addDaysToDate(today, -(progressDays - 1));
  const callsByDate = new Map<string, number>();
  for (const activity of activitiesResult.data) {
    if (!activity.is_call_attempt) continue;
    const date = activity.occurred_at.slice(0, 10);
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
      call_target: settings.daily_call_target,
      calls_completed: callsToday,
      meetings: meetingsToday,
      call_follow_ups: callFollowUpsToday,
      whatsapp_follow_ups: whatsappFollowUps,
      tasks: tasksToday,
    },
    analytics: {
      total_leads: activeLeads.length,
      not_contacted: activeLeads.filter((lead) => lead.status === "not_contacted").length,
      in_progress: activeLeads.filter((lead) => lead.status === "in_progress").length,
      no_answer: activeLeads.filter((lead) => lead.status === "no_answer").length,
      talked_contacted: contactedPhones.size,
      not_interested: activeLeads.filter(
        (lead) => lead.status === "deal_closed" && lead.closed_outcome === "lost"
      ).length,
      deals_won: activeLeads.filter(
        (lead) => lead.status === "deal_closed" && lead.closed_outcome === "won"
      ).length,
      follow_ups: pendingFollowUps.length,
      reengagement_needed: reengagementCount,
    },
    call_progress: callProgress,
    next_workday: tomorrow,
  });
}
