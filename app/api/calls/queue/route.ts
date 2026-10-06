import { NextResponse } from "next/server";
import { dateInTimeZone } from "@/lib/crm-time";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { supabase } = await requireAuthenticatedSupabase();
  const [settingsResult, leadsResult, followUpsResult, activitiesResult] = await Promise.all([
    supabase.from("crm_settings").select("time_zone").maybeSingle(),
    supabase
      .from("leads")
      .select("phone, name, category, status, notes, updated_at")
      .eq("is_archived", false)
      .neq("status", "deal_closed"),
    supabase
      .from("follow_ups")
      .select("lead_phone, type, scheduled_at, status")
      .eq("status", "pending"),
    supabase
      .from("activities")
      .select("lead_phone, occurred_at, is_call_attempt")
      .order("occurred_at", { ascending: false }),
  ]);

  if (settingsResult.error) return supabaseErrorResponse("Load call queue settings", settingsResult.error);
  if (leadsResult.error) return supabaseErrorResponse("Load call queue leads", leadsResult.error);
  if (followUpsResult.error) return supabaseErrorResponse("Load call queue follow-ups", followUpsResult.error);
  if (activitiesResult.error) return supabaseErrorResponse("Load call queue history", activitiesResult.error);

  const latestActivity = new Map<string, string>();
  for (const activity of activitiesResult.data) {
    if (
      activity.lead_phone &&
      !latestActivity.has(activity.lead_phone)
    ) {
      latestActivity.set(activity.lead_phone, activity.occurred_at);
    }
  }
  const today = dateInTimeZone(new Date(), settingsResult.data?.time_zone || "Asia/Kolkata");
  const latestCallAttempt = new Map<string, string>();
  for (const activity of activitiesResult.data) {
    if (
      activity.lead_phone &&
      activity.is_call_attempt &&
      !latestCallAttempt.has(activity.lead_phone)
    ) {
      latestCallAttempt.set(activity.lead_phone, activity.occurred_at);
    }
  }
  const deferredPhones = new Set(
    followUpsResult.data
      .filter(
        (followUp) =>
          followUp.type !== "call" ||
          !followUp.scheduled_at ||
          followUp.scheduled_at.slice(0, 10) > today
      )
      .map((followUp) => followUp.lead_phone)
  );

  const queue = leadsResult.data
    .filter((lead) => {
      if (deferredPhones.has(lead.phone)) return false;
      if (latestCallAttempt.get(lead.phone)?.slice(0, 10) === today) return false;
      if (lead.status === "not_contacted" || lead.status === "no_answer") return true;
      if (lead.status !== "in_progress") return false;
      const lastActivity = latestActivity.get(lead.phone);
      return !lastActivity || lastActivity.slice(0, 10) <= today;
    })
    .sort((left, right) => {
      const priority = { not_contacted: 0, no_answer: 1, in_progress: 2 } as const;
      return (
        priority[left.status as keyof typeof priority] -
          priority[right.status as keyof typeof priority] ||
        (latestActivity.get(left.phone) || "").localeCompare(
          latestActivity.get(right.phone) || ""
        )
      );
    });

  return NextResponse.json({
    today,
    queue: queue.map((lead) => ({ ...lead, last_activity_at: latestActivity.get(lead.phone) || null })),
  });
}
