export const PRODUCT_COLUMNS = [
  "product_id",
  "name",
  "description",
  "status",
  "created_at",
  "is_active",
] as const;

export const CONTACT_PRODUCT_STATUS_COLUMNS = [
  "relationship_id",
  "contact_id",
  "product_id",
  "interest_status",
  "email",
  "notes",
  "meeting_status",
  "follow_up_date",
  "meeting_date",
  "meeting_time",
  "created_at",
  "updated_at",
] as const;

export type Product = {
  product_id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  is_active: string;
};

export type ContactProductStatus = {
  relationship_id: string;
  contact_id: string;
  product_id: string;
  interest_status: string;
  email: string;
  notes: string;
  meeting_status: string;
  follow_up_date: string;
  meeting_date: string;
  meeting_time: string;
  created_at: string;
  updated_at: string;
};

export const PRODUCT_INTEREST_STATUSES = [
  "Interested",
  "Not Interested",
  "Follow-up Needed",
  "Meeting Scheduled",
  "Demo Completed",
  "Converted/Customer",
] as const;

export const PRODUCT_STATUS_VALUES = ["Active", "Paused", "Inactive"] as const;

export const DEFAULT_PRODUCTS: Product[] = [
  {
    product_id: "P001",
    name: "Website",
    description: "General website/service interest and follow-up",
    status: "Active",
    created_at: "",
    is_active: "true",
  },
  {
    product_id: "P002",
    name: "Photo Club",
    description: "Photographer SaaS / cloud software validation campaign",
    status: "Active",
    created_at: "",
    is_active: "true",
  },
];
