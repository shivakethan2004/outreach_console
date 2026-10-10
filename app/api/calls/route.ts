import { NextRequest, NextResponse } from "next/server";
import { canonicalPhone } from "@/lib/phone";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

function isLocalDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid call details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const phone = typeof input.phone === "string" ? canonicalPhone(input.phone) : "";
  const outcome = input.outcome;
  if (!phone) {
    return NextResponse.json({ error: "A valid lead phone number is required." }, { status: 400 });
  }
  if (!["no_answer", "not_interested", "follow_up", "meeting"].includes(String(outcome))) {
    return NextResponse.json({ error: "Choose a valid call outcome." }, { status: 400 });
  }
  if (input.note !== undefined && typeof input.note !== "string") {
    return NextResponse.json({ error: "Call note must be text." }, { status: 400 });
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  const scheduledAt =
    input.scheduled_at === undefined || input.scheduled_at === null || input.scheduled_at === ""
      ? null
      : isLocalDateTime(input.scheduled_at)
        ? input.scheduled_at
        : undefined;
  if (scheduledAt === undefined) {
    return NextResponse.json({ error: "Use a valid local date and time." }, { status: 400 });
  }
  if (
    outcome === "follow_up" &&
    (!["call", "whatsapp", "meeting"].includes(String(input.follow_up_type)) || !note)
  ) {
    return NextResponse.json(
      { error: "Choose a follow-up type and enter a short note." },
      { status: 400 }
    );
  }
  if (
    (outcome === "meeting" || input.follow_up_type === "meeting") &&
    (!isLocalDateTime(scheduledAt) ||
      !["online", "offline"].includes(String(input.meeting_mode)) ||
      typeof input.product_id !== "string" ||
      !note)
  ) {
    return NextResponse.json(
      { error: "Meetings need a product, date/time, mode, and note." },
      { status: 400 }
    );
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("log_call", {
    p_phone: phone,
    p_outcome: outcome,
    p_note: note,
    p_follow_up_type:
      outcome === "meeting"
        ? "meeting"
        : outcome === "follow_up"
          ? (input.follow_up_type as string)
          : null,
    p_scheduled_at: scheduledAt,
    p_meeting_mode: (input.meeting_mode as string | null) || null,
    p_product_id: (input.product_id as string | null) || null,
  });

  if (error) return supabaseErrorResponse("Log call", error);
  return NextResponse.json({ result: data }, { status: 201 });
}
