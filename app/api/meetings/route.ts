import { NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .select("*, leads(phone, name, category), products(id, name)")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) return supabaseErrorResponse("List meetings", error);
  return NextResponse.json({ meetings: data });
}
