import { NextRequest, NextResponse } from "next/server";
import { findChange, invertChange, logChange } from "@/lib/changelog-store";
import { restoreContact, deleteContact, readContacts } from "@/lib/csv-store";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = findChange(id);
  if (!entry) {
    return NextResponse.json({ error: "Change not found" }, { status: 404 });
  }

  const inverse = invertChange(entry);
  const currentContacts = readContacts();
  const currentState =
    currentContacts.find((c) => c.contact_id === entry.contact_id) || null;

  if (inverse.type === "delete") {
    deleteContact(entry.contact_id, { skipLog: true });
  } else if (inverse.contact) {
    restoreContact(inverse.contact);
  } else {
    return NextResponse.json(
      { error: "Nothing to restore for this change" },
      { status: 400 }
    );
  }

  logChange({
    contactId: entry.contact_id,
    contactName: entry.contact_name,
    action: inverse.type === "delete" ? "delete" : "update",
    changeType: "undo",
    before: currentState,
    after: inverse.type === "delete" ? null : inverse.contact,
    undoOf: entry.id,
  });

  return NextResponse.json({ contacts: readContacts() });
}
