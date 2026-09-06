export const CSV_COLUMNS = [
  "contact_id",
  "name",
  "category",
  "phone",
  "address",
  "rating",
  "reviews",
  "cold_call_status",
  "cold_call_last_contacted_at",
  "current_status",
  "whatsapp_status",
  "whatsapp_initial_contacted_at",
  "whatsapp_followup_contacted_at",
  "interest_level",
  "is_meeting_milestone",
  "meeting_date",
  "meeting_time",
  "next_follow_up_date",
  "notes",
] as const;

export type ContactField = (typeof CSV_COLUMNS)[number];

export type Contact = {
  contact_id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  rating: string;
  reviews: string;
  cold_call_status: string;
  cold_call_last_contacted_at: string;
  current_status: string;
  whatsapp_status: string;
  whatsapp_initial_contacted_at: string;
  whatsapp_followup_contacted_at: string;
  interest_level: string;
  is_meeting_milestone: string;
  meeting_date: string;
  meeting_time: string;
  next_follow_up_date: string;
  notes: string;
};

/**
 * Only 5 real outcomes for a cold call, plus the untouched default.
 * "Not Interested" is a dead end — never call again.
 */
export const COLD_CALL_STATUSES = [
  "Not Contacted",
  "No Answer",
  "Follow-up Call Needed",
  "Meeting Booked",
  "Follow-up Through WhatsApp",
  "Not Interested",
] as const;

/**
 * current_status is the "what do I do about this lead right now" field —
 * separate from the raw call outcome above. It drives filtering
 * ("hide everyone who's dead") and the dashboard analytics.
 */
export const CURRENT_STATUSES = [
  "Can Call Again",
  "Meeting Booked",
  "Rescheduled",
  "Deal Closed",
  "Follow-up Needed",
  "WhatsApp - Ghosted",
  "WhatsApp - Responded",
  "WhatsApp - Meeting Arranged",
  "Not Interested",
] as const;

export type CurrentStatus = (typeof CURRENT_STATUSES)[number];

/** What current_status should default to right after logging a cold-call outcome. */
export function deriveCurrentStatus(coldCallStatus: string): CurrentStatus {
  const s = (coldCallStatus || "").toLowerCase().trim();
  if (s === "not interested") return "Not Interested";
  if (s === "meeting booked") return "Meeting Booked";
  if (s === "follow-up through whatsapp") return "WhatsApp - Ghosted";
  // "No Answer" and "Follow-up Call Needed" (and the untouched default) are
  // both just "we can call this lead again".
  return "Can Call Again";
}

export function isDeadLead(currentStatus: string): boolean {
  return (currentStatus || "").toLowerCase().trim() === "not interested";
}

export const WHATSAPP_STATUSES = ["Not Contacted", "Contacted"] as const;

export const INTEREST_LEVELS = ["", "Cold", "Warm", "Hot"] as const;

export const MEETING_OPTIONS = ["No", "Yes"] as const;

export function emptyContact(nextId: string): Contact {
  return {
    contact_id: nextId,
    name: "",
    category: "",
    phone: "",
    address: "",
    rating: "",
    reviews: "",
    cold_call_status: "Not Contacted",
    cold_call_last_contacted_at: "",
    current_status: "Can Call Again",
    whatsapp_status: "Not Contacted",
    whatsapp_initial_contacted_at: "",
    whatsapp_followup_contacted_at: "",
    interest_level: "",
    is_meeting_milestone: "No",
    meeting_date: "",
    meeting_time: "",
    next_follow_up_date: "",
    notes: "",
  };
}
