import { NextRequest, NextResponse } from "next/server";
import { canonicalPhone } from "@/lib/phone";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

function validLocalDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

export async function GET() {
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, leads(phone, name)")
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) return supabaseErrorResponse("List tasks", error);
  return NextResponse.json({ tasks: data });
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid task details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const note = typeof input.note === "string" ? input.note : "";
  const dueAt =
    input.due_at === undefined || input.due_at === null || input.due_at === ""
      ? null
      : validLocalDateTime(input.due_at)
        ? input.due_at
        : undefined;
  const phone =
    input.phone === undefined || input.phone === null || input.phone === ""
      ? null
      : typeof input.phone === "string"
        ? canonicalPhone(input.phone)
        : "";

  if (!title || dueAt === undefined || phone === "") {
    return NextResponse.json(
      { error: "Enter a task title and valid optional date/time and lead." },
      { status: 400 }
    );
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("create_task", {
    p_title: title,
    p_note: note,
    p_due_at: dueAt,
    p_phone: phone,
  });
  if (error) return supabaseErrorResponse("Create task", error);
  return NextResponse.json({ task: data }, { status: 201 });
}
