import { NextRequest, NextResponse } from "next/server";
import { LEAD_STATUSES, DealOutcome } from "@/lib/crm-types";
import { supabaseErrorResponse } from "@/lib/supabase/api-error";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ phone: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { phone } = await params;
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid lead status." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const status = input.status;
  const outcome = input.closed_outcome ?? null;
  const amountReceived = input.amount_received;
  if (typeof status !== "string" || !LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    return NextResponse.json({ error: "Choose a valid lead status." }, { status: 400 });
  }
  if (
    (status === "deal_closed" && !["won", "lost"].includes(String(outcome))) ||
    (status !== "deal_closed" && outcome !== null)
  ) {
    return NextResponse.json(
      { error: "Closed leads require a Won or Lost outcome." },
      { status: 400 }
    );
  }
  if (status === "deal_closed" && outcome === "won") {
    const amount = Number(amountReceived);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000000000) {
      return NextResponse.json(
        { error: "Enter the actual amount received as a whole amount greater than zero." },
        { status: 400 }
      );
    }
  } else if (amountReceived !== undefined && amountReceived !== null) {
    return NextResponse.json(
      { error: "Only won deals can have an amount received." },
      { status: 400 }
    );
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("update_lead_status", {
    p_phone: decodeURIComponent(phone),
    p_status: status,
    p_closed_outcome: outcome as DealOutcome | null,
    p_amount_received:
      status === "deal_closed" && outcome === "won" ? Number(amountReceived) : null,
  });

  if (error) return supabaseErrorResponse("Update lead status", error);
  return NextResponse.json({ lead: data });
}
