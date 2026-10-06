import { NextRequest, NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone: encodedPhone } = await params;
  const phone = decodeURIComponent(encodedPhone);
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid lead product selection." }, { status: 400 });
  }
  const productIds = (body as Record<string, unknown>).product_ids;
  if (
    !Array.isArray(productIds) ||
    productIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))
  ) {
    return NextResponse.json({ error: "Choose valid products." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { error } = await supabase.rpc("set_lead_products", {
    p_phone: phone,
    p_product_ids: productIds,
  });
  if (error) return supabaseErrorResponse("Update lead products", error);

  const { data, error: leadError } = await supabase
    .from("leads")
    .select("*, lead_products(*, products(id, name, is_active))")
    .eq("phone", phone)
    .maybeSingle();
  if (leadError) return supabaseErrorResponse("Read updated lead products", leadError);
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ lead: data });
}
