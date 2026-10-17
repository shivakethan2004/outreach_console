import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });

  const { supabase } = await requireAuthenticatedSupabase();
  const [campaignResult, leadsResult, callsResult, scriptsResult] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("campaign_leads")
      .select("lead_phone, leads(phone, name, category, status, is_archived)")
      .eq("campaign_id", id)
      .order("added_at", { ascending: true }),
    supabase
      .from("campaign_calls")
      .select("id, lead_phone, outcome, duration_seconds, answered, is_conversation, called_at, active_elapsed_seconds")
      .eq("campaign_id", id)
      .order("called_at", { ascending: false }),
    supabase
      .from("campaign_scripts")
      .select("id, title, content, file_path, file_name, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (campaignResult.error) return supabaseErrorResponse("Load campaign", campaignResult.error);
  if (!campaignResult.data) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (leadsResult.error) return supabaseErrorResponse("Load campaign leads", leadsResult.error);
  if (callsResult.error) return supabaseErrorResponse("Load campaign calls", callsResult.error);
  if (scriptsResult.error) return supabaseErrorResponse("Load campaign scripts", scriptsResult.error);

  const scripts = await Promise.all(
    scriptsResult.data.map(async (script) => {
      if (!script.file_path) return { ...script, file_url: null };
      const { data, error } = await supabase.storage
        .from("campaign-pdfs")
        .createSignedUrl(script.file_path, 3600);
      if (error) {
        console.error("Create campaign PDF URL failed in Supabase", { message: error.message });
        return { ...script, file_url: null, file_error: "Could not create a viewing link for this PDF." };
      }
      return { ...script, file_url: data.signedUrl, file_error: null };
    })
  );
  return NextResponse.json({
    campaign: campaignResult.data,
    leads: leadsResult.data.map((item) => item.leads),
    calls: callsResult.data,
    scripts,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid campaign action." }, { status: 400 });
  }
  const action = (body as Record<string, unknown>).action;
  const actions = ["start", "pause", "resume", "complete", "reset"] as const;
  if (typeof action !== "string" || !actions.includes(action as (typeof actions)[number])) {
    return NextResponse.json({ error: "Choose a valid campaign action." }, { status: 400 });
  }
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("update_campaign", {
    p_id: id,
    p_action: action as (typeof actions)[number],
  });
  if (error) return supabaseErrorResponse("Update campaign", error);
  return NextResponse.json({ campaign: data });
}
