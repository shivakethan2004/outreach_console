import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const MAX_MEMORY_LENGTH = 20_000;

export async function GET() {
  const { supabase, user } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("advisor_memory")
    .select("content")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) return supabaseErrorResponse("Read advisor memory", error);
  return NextResponse.json({ memory: data?.content ?? "" });
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid advisor memory." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid advisor memory." }, { status: 400 });
  }

  const content = (body as Record<string, unknown>).content;
  if (typeof content !== "string" || content.length > MAX_MEMORY_LENGTH) {
    return NextResponse.json(
      { error: `Advisor memory must be text under ${MAX_MEMORY_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const { supabase, user } = await requireAuthenticatedSupabase();
  const { error } = await supabase
    .from("advisor_memory")
    .upsert({ owner_id: user.id, content }, { onConflict: "owner_id" });

  if (error) return supabaseErrorResponse("Save advisor memory", error);
  return NextResponse.json({ memory: content });
}
