import { NextRequest, NextResponse } from "next/server";
import { ContactProductStatus } from "@/lib/products";
import {
  deleteContactProductStatus,
  getStatusesForContact,
  getStatusesForProduct,
  readContactProductStatuses,
  upsertContactProductStatus,
} from "@/lib/products-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contact_id");
  const productId = searchParams.get("product_id");

  if (contactId && productId) {
    const item = readContactProductStatuses().find(
      (entry) => entry.contact_id === contactId && entry.product_id === productId
    );
    return NextResponse.json({ status: item ?? null });
  }

  if (contactId) {
    return NextResponse.json({ statuses: getStatusesForContact(contactId) });
  }

  if (productId) {
    return NextResponse.json({ statuses: getStatusesForProduct(productId) });
  }

  return NextResponse.json({ statuses: readContactProductStatuses() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const status: ContactProductStatus = {
    relationship_id: body.relationship_id || `${body.contact_id || "new"}-${body.product_id || "new"}`,
    contact_id: body.contact_id,
    product_id: body.product_id,
    interest_status: body.interest_status || "Follow-up Needed",
    email: body.email || "",
    notes: body.notes || "",
    meeting_status: body.meeting_status || "",
    follow_up_date: body.follow_up_date || "",
    meeting_date: body.meeting_date || "",
    meeting_time: body.meeting_time || "",
    created_at: body.created_at || new Date().toISOString(),
    updated_at: body.updated_at || new Date().toISOString(),
  };

  const items = upsertContactProductStatus(status);
  return NextResponse.json({ status, statuses: items });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contact_id");
  const productId = searchParams.get("product_id");
  if (!contactId || !productId) {
    return NextResponse.json({ error: "Missing contact_id or product_id" }, { status: 400 });
  }

  const items = deleteContactProductStatus(contactId, productId);
  return NextResponse.json({ statuses: items });
}
