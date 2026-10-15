import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { supabase } = await requireAuthenticatedSupabase();
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, status, started_at, completed_at, created_at")
    .order("created_at", { ascending: false });
  if (error) return supabaseErrorResponse("List campaigns", error);
  if (!campaigns.length) return NextResponse.json({ campaigns: [] });

  const ids = campaigns.map((campaign) => campaign.id);
  const [leadsResult, callsResult] = await Promise.all([
    supabase.from("campaign_leads").select("campaign_id").in("campaign_id", ids),
    supabase
      .from("campaign_calls")
      .select("campaign_id, answered, is_conversation, outcome, duration_seconds")
      .in("campaign_id", ids),
  ]);
  if (leadsResult.error) return supabaseErrorResponse("Count campaign leads", leadsResult.error);
  if (callsResult.error) return supabaseErrorResponse("Load campaign stats", callsResult.error);

  const campaignsWithStats = campaigns.map((campaign) => {
    const calls = callsResult.data.filter((call) => call.campaign_id === campaign.id);
    return {
      ...campaign,
      stats: {
        leads: leadsResult.data.filter((lead) => lead.campaign_id === campaign.id).length,
        calls: calls.length,
        answered: calls.filter((call) => call.answered).length,
        conversations: calls.filter((call) => call.is_conversation).length,
        meetings: calls.filter((call) => call.outcome === "meeting").length,
        average_duration_seconds: calls.filter((call) => call.answered).length
          ? Math.round(
              calls.filter((call) => call.answered).reduce((total, call) => total + call.duration_seconds, 0) /
                calls.filter((call) => call.answered).length
            )
          : 0,
      },
    };
  });
  return NextResponse.json({ campaigns: campaignsWithStats });
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid campaign details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const mode = input.selection_mode;
  if (!name) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
  if (mode !== "manual" && mode !== "random") {
    return NextResponse.json({ error: "Choose manual or random lead selection." }, { status: 400 });
  }
  if (
    mode === "manual" &&
    (!Array.isArray(input.lead_phones) ||
      input.lead_phones.length === 0 ||
      input.lead_phones.some((phone) => typeof phone !== "string"))
  ) {
    return NextResponse.json({ error: "Select at least one lead." }, { status: 400 });
  }
  if (mode === "random" && (!Number.isInteger(input.count) || (input.count as number) < 1)) {
    return NextResponse.json({ error: "Enter a valid number of leads." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("create_campaign", {
    p_name: name,
    p_selection_mode: mode,
    p_lead_phones: mode === "manual" ? (input.lead_phones as string[]) : [],
    p_random_count: mode === "random" ? (input.count as number) : null,
  });
  if (error) return supabaseErrorResponse("Create campaign", error);
  return NextResponse.json({ campaign: data }, { status: 201 });
}
