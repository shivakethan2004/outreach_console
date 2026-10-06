import { NextRequest, NextResponse } from "next/server";
import { canonicalPhone } from "@/lib/phone";
import { FollowUpType } from "@/lib/crm-types";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

function isLocalDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

export async function GET() {
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*, leads(phone, name, category, status), meetings(*)")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) return supabaseErrorResponse("List follow-ups", error);
  return NextResponse.json({ follow_ups: data });
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid follow-up details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const phone = typeof input.phone === "string" ? canonicalPhone(input.phone) : "";
  const type = input.type;
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (!phone || !["call", "whatsapp", "meeting"].includes(String(type)) || !note) {
    return NextResponse.json(
      { error: "Choose a lead and follow-up type, and enter a short note." },
      { status: 400 }
    );
  }
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
    type === "meeting" &&
    (scheduledAt === null ||
      !["online", "offline"].includes(String(input.meeting_mode)) ||
      typeof input.product_id !== "string")
  ) {
    return NextResponse.json(
      { error: "Meetings need a product, date/time, and online or offline mode." },
      { status: 400 }
    );
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("create_follow_up", {
    p_phone: phone,
    p_type: type as FollowUpType,
    p_scheduled_at: scheduledAt,
    p_note: note,
    p_meeting_mode: (input.meeting_mode as string | null) || null,
    p_product_id: (input.product_id as string | null) || null,
  });

  if (error) return supabaseErrorResponse("Create follow-up", error);
  return NextResponse.json({ result: data }, { status: 201 });
}
