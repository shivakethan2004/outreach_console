import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("crm_settings")
    .upsert({ owner_id: user.id }, { onConflict: "owner_id" })
    .select()
    .single();
  if (error) return supabaseErrorResponse("Read CRM settings", error);
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: NextRequest) {
  const body: unknown = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid CRM settings." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const updates: {
    daily_call_target?: number;
    reengagement_days?: number;
    time_zone?: string;
  } = {};
  if (input.daily_call_target !== undefined) {
    const target = Number(input.daily_call_target);
    if (!Number.isInteger(target) || target < 1 || target > 1000) {
      return NextResponse.json({ error: "Call target must be between 1 and 1000." }, { status: 400 });
    }
    updates.daily_call_target = target;
  }
  if (input.reengagement_days !== undefined) {
    const days = Number(input.reengagement_days);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return NextResponse.json({ error: "Re-engagement delay must be 1–30 days." }, { status: 400 });
    }
    updates.reengagement_days = days;
  }
  if (input.time_zone !== undefined) {
    if (typeof input.time_zone !== "string") {
      return NextResponse.json({ error: "Time zone must be text." }, { status: 400 });
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.time_zone }).format();
    } catch {
      return NextResponse.json({ error: "Choose a valid time zone." }, { status: 400 });
    }
    updates.time_zone = input.time_zone;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No settings changes were supplied." }, { status: 400 });
  }

  const { supabase, user } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("crm_settings")
    .upsert({ owner_id: user.id, ...updates }, { onConflict: "owner_id" })
    .select()
    .single();
  if (error) return supabaseErrorResponse("Update CRM settings", error);
  return NextResponse.json({ settings: data });
}
