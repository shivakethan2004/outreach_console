export const LEAD_STATUSES = [
  "not_contacted",
  "in_progress",
  "no_answer",
  "deal_closed",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type DealOutcome = "won" | "lost";
export type FollowUpType = "call" | "whatsapp" | "meeting";
export type FollowUpStatus = "pending" | "completed" | "cancelled";

export type Lead = {
  phone: string;
  owner_id: string;
  legacy_contact_id: string | null;
  name: string;
  category: string;
  address: string;
  rating: string;
  reviews: string;
  status: LeadStatus;
  closed_outcome: DealOutcome | null;
  interest_level: "cold" | "warm" | "hot" | null;
  notes: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  lead_products?: LeadProduct[];
};

export type Product = {
  id: string;
  owner_id: string;
  legacy_product_id: string | null;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

export type LeadProduct = {
  id: string;
  lead_phone: string;
  product_id: string;
  is_active: boolean;
  interest_status: string | null;
  email: string;
  notes: string;
  products?: Pick<Product, "id" | "name" | "is_active"> | null;
};

export type Activity = {
  id: string;
  lead_phone: string | null;
  legacy_contact_id: string | null;
  type: "call" | "whatsapp" | "meeting" | "deal" | "note" | "task" | "legacy";
  outcome: string | null;
  occurred_at: string;
  note: string;
  is_call_attempt: boolean;
  source_payload?: Record<string, unknown>;
};

export type Meeting = {
  id: string;
  lead_phone: string;
  product_id: string | null;
  mode: "online" | "offline" | null;
  scheduled_at: string | null;
  legacy_date: string | null;
  legacy_time: string | null;
  note: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
};

export type FollowUp = {
  id: string;
  lead_phone: string;
  meeting_id: string | null;
  type: FollowUpType;
  scheduled_at: string | null;
  note: string;
  status: FollowUpStatus;
  completed_at: string | null;
  leads?: Pick<Lead, "phone" | "name" | "category" | "status"> | null;
  meetings?: Meeting | null;
};

export type Task = {
  id: string;
  lead_phone: string | null;
  title: string;
  note: string;
  due_at: string | null;
  status: "pending" | "completed" | "cancelled";
  completed_at: string | null;
};

export type CrmSettings = {
  owner_id: string;
  daily_call_target: number;
  reengagement_days: number;
  time_zone: string;
};

export type LegacyMigrationReview = {
  id: string;
  source_file: string;
  legacy_record_key: string;
  issue_code: string;
  source_payload: Record<string, unknown>;
  review_status: "pending" | "resolved" | "dismissed";
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};
