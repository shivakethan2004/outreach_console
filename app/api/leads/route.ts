import { NextRequest, NextResponse } from "next/server";
import { canonicalPhone } from "@/lib/phone";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*, lead_products(*, products(id, name, is_active))")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) return supabaseErrorResponse("List leads", error);
  return NextResponse.json({ leads: data });
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid lead details." }, { status: 400 });
  }
  const fields = body as Record<string, unknown>;
  const phone = typeof fields.phone === "string" ? canonicalPhone(fields.phone) : "";
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const productIds = fields.product_ids ?? [];

  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid phone number; it identifies each lead uniquely." },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json({ error: "Lead name is required." }, { status: 400 });
  }
  if (
    !Array.isArray(productIds) ||
    productIds.some((id) => typeof id !== "string")
  ) {
    return NextResponse.json({ error: "Invalid product selection." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("create_lead", {
    p_phone: phone,
    p_name: name,
    p_category: typeof fields.category === "string" ? fields.category.trim() : "",
    p_address: typeof fields.address === "string" ? fields.address.trim() : "",
    p_rating: typeof fields.rating === "string" ? fields.rating.trim() : "",
    p_reviews: typeof fields.reviews === "string" ? fields.reviews.trim() : "",
    p_notes: typeof fields.notes === "string" ? fields.notes : "",
    p_product_ids: productIds,
  });

  if (error) return supabaseErrorResponse("Create lead", error);
  return NextResponse.json({ lead: data }, { status: 201 });
}
