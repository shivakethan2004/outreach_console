import { ChangeType } from "./changelog-types";
import { BadgeTone } from "./badge-tone";

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  created: "Lead added",
  field_edit: "Edited",
  cold_call_logged: "Cold call logged",
  whatsapp_logged: "WhatsApp logged",
  meeting_booked: "🟢 Meeting booked",
  imported: "Imported",
  deleted: "Lead removed",
  undo: "Undone",
};

export const CHANGE_TYPE_TONE: Record<ChangeType, BadgeTone> = {
  created: "outline",
  field_edit: "muted",
  cold_call_logged: "amber",
  whatsapp_logged: "teal",
  meeting_booked: "green",
  imported: "outline",
  deleted: "rust",
  undo: "muted",
};
