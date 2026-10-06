import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const REVIEW_STATUSES = ["pending", "resolved", "dismissed"] as const;

export async function GET(request: NextRequest) {
  const requestedStatus = request.nextUrl.searchParams.get("status") || "pending";
  if (requestedStatus !== "all" && !REVIEW_STATUSES.includes(requestedStatus as (typeof REVIEW_STATUSES)[number])) {
    return NextResponse.json({ error: "Choose a valid review status." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  let query = supabase
    .from("legacy_migration_review")
    .select("id, source_file, legacy_record_key, issue_code, source_payload, review_status, resolution_note, created_at, reviewed_at")
    .order("created_at", { ascending: true });
  if (requestedStatus !== "all") query = query.eq("review_status", requestedStatus);

  const { data, error } = await query;
  if (error) return supabaseErrorResponse("List legacy migration reviews", error);
  return NextResponse.json({ reviews: data });
}
