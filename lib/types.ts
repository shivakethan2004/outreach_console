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

export const COLD_CALL_STATUSES = [
  "Not Contacted",
  "Contacted",
  "No Answer",
  "Gatekeeper - Owner Not Present",
  "Interested - requested info",
  "Owner-declined",
  "Not Interested",
] as const;

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
