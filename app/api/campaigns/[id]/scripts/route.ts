import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PDF_SIZE = 20 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  const { supabase, user } = await requireAuthenticatedSupabase();
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const title = typeof form.get("title") === "string" ? String(form.get("title")).trim() : "";
    if (!title || !(file instanceof File)) {
      return NextResponse.json({ error: "A PDF and title are required." }, { status: 400 });
    }
    if (file.type !== "application/pdf" || file.size === 0 || file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: "Upload a non-empty PDF no larger than 20 MB." }, { status: 400 });
    }
    const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (signature !== "%PDF-") {
      return NextResponse.json({ error: "The selected file is not a valid PDF." }, { status: 400 });
    }

    const path = `${user.id}/${id}/${randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("campaign-pdfs")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      console.error("Upload campaign PDF failed in Supabase", { message: uploadError.message });
      return NextResponse.json({ error: "Could not upload the campaign PDF." }, { status: 500 });
    }
    const { data, error } = await supabase
      .from("campaign_scripts")
      .insert({
        campaign_id: id,
        owner_id: user.id,
        title,
        file_path: path,
        file_name: file.name.slice(0, 255),
      })
      .select("id, title, content, file_path, file_name, created_at")
      .single();
    if (error) {
      const { error: cleanupError } = await supabase.storage.from("campaign-pdfs").remove([path]);
      if (cleanupError) console.error("Clean up unlinked campaign PDF failed in Supabase", { message: cleanupError.message });
      return supabaseErrorResponse("Save campaign PDF", error);
    }
    return NextResponse.json({ script: data }, { status: 201 });
  }

  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid script details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!title || !content) return NextResponse.json({ error: "Script title and text are required." }, { status: 400 });
  const { data, error } = await supabase
    .from("campaign_scripts")
    .insert({ campaign_id: id, owner_id: user.id, title, content })
    .select("id, title, content, file_path, file_name, created_at")
    .single();
  if (error) return supabaseErrorResponse("Save campaign script", error);
  return NextResponse.json({ script: data }, { status: 201 });
}
