import { NextResponse } from "next/server";
import { dateInTimeZone } from "@/lib/crm-time";
import { findReengagementLeads } from "@/lib/reengagement";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireAuthenticatedSupabase();
  const [settingsResult, leadsResult, activitiesResult, followUpsResult] = await Promise.all([
    supabase.from("crm_settings").select("time_zone,reengagement_days").eq("owner_id", user.id).maybeSingle(),
    supabase.from("leads").select("phone,name,category,status,is_archived,updated_at").eq("is_archived", false),
    supabase.from("activities").select("lead_phone,occurred_at"),
    supabase.from("follow_ups").select("lead_phone,status"),
  ]);
  if (settingsResult.error) return supabaseErrorResponse("Load re-engagement settings", settingsResult.error);
  if (leadsResult.error) return supabaseErrorResponse("Load re-engagement leads", leadsResult.error);
  if (activitiesResult.error) return supabaseErrorResponse("Load re-engagement activity", activitiesResult.error);
  if (followUpsResult.error) return supabaseErrorResponse("Load re-engagement follow-ups", followUpsResult.error);

  const timeZone = settingsResult.data?.time_zone || "Asia/Kolkata";
  const today = dateInTimeZone(new Date(), timeZone);
  const leads = findReengagementLeads(
    leadsResult.data,
    activitiesResult.data,
    followUpsResult.data,
    today,
    settingsResult.data?.reengagement_days || 4,
    timeZone
  );
  return NextResponse.json({ today, leads });
}
