import { NextRequest, NextResponse } from "next/server";
import { readContacts, upsertContact, nextContactId } from "@/lib/csv-store";
import { emptyContact, Contact } from "@/lib/types";

export async function GET() {
  const contacts = readContacts();
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contacts = readContacts();
  const id = nextContactId(contacts);
  const base = emptyContact(id);
  const newContact: Contact = { ...base, ...body, contact_id: id };
  const updated = upsertContact(newContact, { changeType: "created" });
  return NextResponse.json({ contact: newContact, contacts: updated });
}
