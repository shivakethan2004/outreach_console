import { NextRequest, NextResponse } from "next/server";
import { readContacts, upsertContact, deleteContact } from "@/lib/csv-store";
import { Contact } from "@/lib/types";
import { ChangeType } from "@/lib/changelog-types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { _changeType, _isFirstTouch, ...fields } = body as Record<
    string,
    unknown
  >;

  const contacts = readContacts();
  const existing = contacts.find((c) => c.contact_id === id);
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  const updated: Contact = { ...existing, ...fields, contact_id: id };
  const all = upsertContact(updated, {
    changeType: (_changeType as ChangeType) || "field_edit",
    isFirstTouch:
      typeof _isFirstTouch === "boolean" ? _isFirstTouch : undefined,
  });
  return NextResponse.json({ contact: updated, contacts: all });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const all = deleteContact(id);
  return NextResponse.json({ contacts: all });
}
