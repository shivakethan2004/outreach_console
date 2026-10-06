import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid follow-up." }, { status: 400 });
  }
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid follow-up action." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const action = input.action;
  if (!["complete", "reschedule", "cancel", "close_not_interested"].includes(String(action))) {
    return NextResponse.json({ error: "Choose a valid follow-up action." }, { status: 400 });
  }

  let scheduledAt: string | null = null;
  if (action === "reschedule") {
    if (
      typeof input.scheduled_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(input.scheduled_at) ||
      Number.isNaN(new Date(input.scheduled_at).getTime())
    ) {
      return NextResponse.json({ error: "Choose a valid new date and time." }, { status: 400 });
    }
    scheduledAt = input.scheduled_at;
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("update_follow_up", {
    p_id: id,
    p_action: action,
    p_scheduled_at: scheduledAt,
  });

  if (error) return supabaseErrorResponse("Update follow-up", error);
  return NextResponse.json({ follow_up: data });
}
