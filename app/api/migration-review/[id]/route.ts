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
    return NextResponse.json({ error: "Invalid migration review item." }, { status: 400 });
  }

  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid migration review action." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (input.review_status !== "resolved" && input.review_status !== "dismissed") {
    return NextResponse.json({ error: "Choose Reviewed or Dismissed." }, { status: 400 });
  }
  if (
    typeof input.resolution_note !== "string" ||
    !input.resolution_note.trim() ||
    input.resolution_note.trim().length > 1000
  ) {
    return NextResponse.json(
      { error: "Add a review note of up to 1000 characters." },
      { status: 400 }
    );
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("legacy_migration_review")
    .update({
      review_status: input.review_status,
      resolution_note: input.resolution_note.trim(),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("id, review_status, resolution_note, reviewed_at")
    .maybeSingle();

  if (error) return supabaseErrorResponse("Update legacy migration review", error);
  if (!data) return NextResponse.json({ error: "This review item is no longer pending." }, { status: 404 });
  return NextResponse.json({ review: data });
}
