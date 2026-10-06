import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";

export async function GET() {
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return supabaseErrorResponse("List products", error);
  return NextResponse.json({ products: data });
}

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid product details." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });

  const { supabase, user } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("products")
    .insert({ owner_id: user.id, name, description })
    .select()
    .single();
  if (error) {
    return supabaseErrorResponse(
      "Create product",
      error,
      "A product with this name already exists."
    );
  }
  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body: unknown = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid product changes." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id : "";
  const updates: { name?: string; description?: string; is_active?: boolean } = {};
  if (typeof input.name === "string" && input.name.trim()) updates.name = input.name.trim();
  if (typeof input.description === "string") updates.description = input.description.trim();
  if (typeof input.is_active === "boolean") updates.is_active = input.is_active;
  if (!id || Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Product id and valid changes are required." }, { status: 400 });
  }
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    return supabaseErrorResponse(
      "Update product",
      error,
      "A product with this name already exists."
    );
  }
  if (!data) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ product: data });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("product_id");
  if (!id) return NextResponse.json({ error: "Missing product id." }, { status: 400 });
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return supabaseErrorResponse("Archive product", error);
  if (!data) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ product: data });
}
