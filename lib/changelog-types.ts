import { Contact } from "./types";

export type ChangeAction = "create" | "update" | "delete";

// what triggered the change - drives both badges in the Activity view
// and the "today's activity" dashboard counts
export type ChangeType =
  | "created"
  | "field_edit"
  | "cold_call_logged"
  | "whatsapp_logged"
  | "meeting_booked"
  | "imported"
  | "deleted"
  | "undo";

export type ChangeEntry = {
  id: string;
  timestamp: string;
  contact_id: string;
  contact_name: string;
  action: ChangeAction;
  change_type: ChangeType;
  is_first_touch: string; // "true" | "false" | "" - new outreach vs follow-up, for call/whatsapp logs
  before: string; // JSON-encoded Contact | ""
  after: string; // JSON-encoded Contact | ""
  undo_of: string; // id of the entry this undoes, or ""
};

export const CHANGELOG_COLUMNS: (keyof ChangeEntry)[] = [
  "id",
  "timestamp",
  "contact_id",
  "contact_name",
  "action",
  "change_type",
  "is_first_touch",
  "before",
  "after",
  "undo_of",
];

export function parseSnapshot(s: string): Contact | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as Contact;
  } catch {
    return null;
  }
}
