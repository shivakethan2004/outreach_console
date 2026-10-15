import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scriptId: string }> }
) {
  const { id, scriptId } = await params;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(scriptId)) {
    return NextResponse.json({ error: "Invalid campaign script." }, { status: 400 });
  }
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid script details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content : "";
  if (!title || !content.trim()) {
    return NextResponse.json({ error: "Script title and text are required." }, { status: 400 });
  }
  if (title.length > 200 || content.length > 50000) {
    return NextResponse.json({ error: "Script title must be under 200 characters and content under 50,000 characters." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("campaign_scripts")
    .update({ title, content })
    .eq("id", scriptId)
    .eq("campaign_id", id)
    .is("file_path", null)
    .select("id, title, content, file_path, file_name, created_at")
    .maybeSingle();
  if (error) return supabaseErrorResponse("Update campaign script", error);
  if (!data) return NextResponse.json({ error: "Text script not found." }, { status: 404 });
  return NextResponse.json({ script: data });
}
