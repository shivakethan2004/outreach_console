import { NextRequest, NextResponse } from "next/server";
import { canonicalPhone } from "@/lib/phone";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ phone: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { phone: encodedPhone } = await params;
  const phone = decodeURIComponent(encodedPhone);
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*, lead_products(*, products(id, name, is_active))")
    .eq("phone", phone)
    .maybeSingle();

  if (error) return supabaseErrorResponse("Read lead", error);
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ lead: data });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { phone: encodedPhone } = await params;
  const phone = decodeURIComponent(encodedPhone);
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid lead changes." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const updates: Record<string, string | null> = {};

  for (const field of ["name", "category", "address", "rating", "reviews", "notes"] as const) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== "string") {
      return NextResponse.json({ error: `${field} must be text.` }, { status: 400 });
    }
    updates[field] = field === "name" ? input[field].trim() : input[field];
  }
  if (input.phone !== undefined) {
    if (typeof input.phone !== "string" || !canonicalPhone(input.phone)) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    updates.phone = canonicalPhone(input.phone);
  }
  if (input.interest_level !== undefined) {
    if (
      input.interest_level !== null &&
      !["cold", "warm", "hot"].includes(String(input.interest_level))
    ) {
      return NextResponse.json({ error: "Invalid interest level." }, { status: 400 });
    }
    updates.interest_level = input.interest_level as string | null;
  }
  if (!updates.name?.trim() && input.name !== undefined) {
    return NextResponse.json({ error: "Lead name cannot be empty." }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No lead changes were supplied." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update(updates)
    .eq("phone", phone)
    .select()
    .maybeSingle();

  if (error) return supabaseErrorResponse("Update lead", error);
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ lead: data });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { phone: encodedPhone } = await params;
  const phone = decodeURIComponent(encodedPhone);
  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("phone", phone)
    .eq("is_archived", false)
    .select()
    .maybeSingle();

  if (error) return supabaseErrorResponse("Archive lead", error);
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ lead: data });
}
