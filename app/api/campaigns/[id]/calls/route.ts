import { NextRequest, NextResponse } from "next/server";
import { isCallOutcome } from "@/lib/crm-types";
import { canonicalPhone } from "@/lib/phone";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid call details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const phone = typeof input.phone === "string" ? canonicalPhone(input.phone) : "";
  if (!phone) return NextResponse.json({ error: "Choose a valid lead." }, { status: 400 });
  if (!isCallOutcome(input.outcome)) {
    return NextResponse.json({ error: "Choose a valid call outcome." }, { status: 400 });
  }
  if (input.note !== undefined && typeof input.note !== "string") {
    return NextResponse.json({ error: "Call note must be text." }, { status: 400 });
  }
  if (!Number.isInteger(input.duration_seconds) || (input.duration_seconds as number) < 0) {
    return NextResponse.json({ error: "Call duration is required." }, { status: 400 });
  }
  if (
    input.scheduled_at !== null &&
    input.scheduled_at !== undefined &&
    input.scheduled_at !== "" &&
    (typeof input.scheduled_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(input.scheduled_at) ||
      Number.isNaN(new Date(input.scheduled_at).getTime()))
  ) {
    return NextResponse.json({ error: "Use a valid local date and time." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("log_campaign_call", {
    p_campaign_id: id,
    p_phone: phone,
    p_outcome: input.outcome,
    p_note: typeof input.note === "string" ? input.note.trim() : "",
    p_follow_up_type: typeof input.follow_up_type === "string" ? input.follow_up_type : null,
    p_scheduled_at: typeof input.scheduled_at === "string" ? input.scheduled_at : null,
    p_meeting_mode: typeof input.meeting_mode === "string" ? input.meeting_mode : null,
    p_product_id: typeof input.product_id === "string" ? input.product_id : null,
    p_duration_seconds: input.duration_seconds,
  });
  if (error) return supabaseErrorResponse("Log campaign call", error);
  return NextResponse.json({ call_id: data }, { status: 201 });
}
