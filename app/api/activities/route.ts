import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { supabase } = await requireAuthenticatedSupabase();
  const leadPhone = request.nextUrl.searchParams.get("phone");
  let query = supabase
    .from("activities")
    .select(
      "id, lead_phone, legacy_contact_id, type, outcome, occurred_at, note, is_call_attempt, leads(phone, name)"
    )
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (leadPhone) query = query.eq("lead_phone", leadPhone);
  const { data, error } = await query;
  if (error) return supabaseErrorResponse("List activity", error);
  return NextResponse.json({ activities: data });
}
