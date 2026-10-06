import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

const dataDirectory = new URL("../data/", import.meta.url);
const ownerId = process.env.SUPABASE_OWNER_ID;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey || !ownerId) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_OWNER_ID in .env.local before migration."
  );
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) {
  throw new Error("SUPABASE_OWNER_ID must be the UUID of the CRM Auth user.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function readCsv(filename) {
  const content = readFileSync(new URL(filename, dataDirectory), "utf8");
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`${filename} contains invalid CSV: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

function canonicalPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

function mapLeadStatus(row) {
  const callStatus = (row.cold_call_status || "").trim().toLowerCase();
  const currentStatus = (row.current_status || "").trim().toLowerCase();

  if (callStatus === "not interested" || currentStatus === "not interested") {
    return { status: "deal_closed", closed_outcome: "lost" };
  }
  if (currentStatus === "deal closed") return null;
  if (callStatus === "no answer") {
    return { status: "no_answer", closed_outcome: null };
  }
  if (callStatus === "not contacted") {
    return { status: "not_contacted", closed_outcome: null };
  }
  if (
    callStatus === "follow-up call needed" ||
    callStatus === "meeting booked" ||
    callStatus === "follow-up through whatsapp" ||
    currentStatus === "meeting booked" ||
    currentStatus === "follow-up needed" ||
    currentStatus.startsWith("whatsapp -")
  ) {
    return { status: "in_progress", closed_outcome: null };
  }
  return null;
}

function parseSnapshot(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function changedNote(before, after) {
  const beforeLines = new Set(String(before?.notes || "").split("\n"));
  return String(after?.notes || "")
    .split("\n")
    .filter((line) => line && !beforeLines.has(line))
    .join("\n");
}

function dateTime(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)) {
    return null;
  }
  const localValue = trimmed.replace(" ", "T");
  return Number.isNaN(new Date(localValue).getTime()) ? null : localValue;
}

async function upsertRows(table, rows, onConflict, ignoreDuplicates = false) {
  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    if (batch.length === 0) continue;
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates });
    if (error) throw new Error(`Could not migrate ${table}: ${error.message}`);
  }
}

async function stageReview(rows) {
  if (rows.length === 0) return;
  await upsertRows(
    "legacy_migration_review",
    rows,
    "source_file,legacy_record_key",
    true
  );
}

const sourceLeads = readCsv("outreach_master_tracker.csv");
const sourceProducts = readCsv("products.csv");
const sourceProductStatuses = readCsv("contact_product_statuses.csv");
const sourceChangelog = readCsv("changelog.csv");
const phoneGroups = new Map();

for (const row of sourceLeads) {
  const phone = canonicalPhone(row.phone);
  if (!phone) continue;
  const group = phoneGroups.get(phone) || [];
  group.push(row);
  phoneGroups.set(phone, group);
}

const duplicateContactIds = new Set();
const reviewRows = [];
for (const [phone, rows] of phoneGroups) {
  if (rows.length < 2) continue;
  for (const row of rows) {
    duplicateContactIds.add(row.contact_id);
    reviewRows.push({
      owner_id: ownerId,
      source_file: "outreach_master_tracker.csv",
      legacy_record_key: row.contact_id,
      issue_code: "duplicate_normalized_phone",
      source_payload: { canonical_phone: phone, row },
    });
  }
}

const leadsToInsert = [];
const phoneByContactId = new Map();

for (const row of sourceLeads) {
  const phone = canonicalPhone(row.phone);
  if (!phone) {
    reviewRows.push({
      owner_id: ownerId,
      source_file: "outreach_master_tracker.csv",
      legacy_record_key: row.contact_id,
      issue_code: "invalid_or_missing_phone",
      source_payload: row,
    });
    continue;
  }
  if (duplicateContactIds.has(row.contact_id)) continue;

  const mapped = mapLeadStatus(row);
  if (!mapped) {
    reviewRows.push({
      owner_id: ownerId,
      source_file: "outreach_master_tracker.csv",
      legacy_record_key: row.contact_id,
      issue_code: "ambiguous_legacy_status",
      source_payload: row,
    });
    continue;
  }

  phoneByContactId.set(row.contact_id, phone);
  leadsToInsert.push({
    phone,
    owner_id: ownerId,
    legacy_contact_id: row.contact_id,
    name: row.name || "",
    category: row.category || "",
    address: row.address || "",
    rating: row.rating || "",
    reviews: row.reviews || "",
    status: mapped.status,
    closed_outcome: mapped.closed_outcome,
    interest_level: ["Cold", "Warm", "Hot"].includes(row.interest_level)
      ? row.interest_level.toLowerCase()
      : null,
    notes: row.notes || "",
    legacy_payload: row,
  });

  if (row.next_follow_up_date) {
    reviewRows.push({
      owner_id: ownerId,
      source_file: "outreach_master_tracker.csv",
      legacy_record_key: `${row.contact_id}:next_follow_up`,
      issue_code: "legacy_follow_up_missing_type_or_note",
      source_payload: row,
    });
  }
  if (row.is_meeting_milestone?.trim().toLowerCase() === "yes" && row.meeting_date) {
    reviewRows.push({
      owner_id: ownerId,
      source_file: "outreach_master_tracker.csv",
      legacy_record_key: `${row.contact_id}:meeting`,
      issue_code: "legacy_meeting_mode_or_timezone_unknown",
      source_payload: row,
    });
  }
}

await upsertRows("leads", leadsToInsert, "phone", true);

const productsToInsert = sourceProducts.map((row) => {
  const name =
    row.name?.trim().toLowerCase() === "photo club"
      ? "Photo Cloud SaaS"
      : row.name?.trim();
  return {
    owner_id: ownerId,
    legacy_product_id: row.product_id,
    name,
    description: row.description || "",
    is_active: String(row.is_active).toLowerCase() !== "false",
    legacy_payload: row,
  };
});
await upsertRows("products", productsToInsert, "legacy_product_id", true);

const { data: currentProducts, error: productsError } = await supabase
  .from("products")
  .select("id,name,legacy_product_id")
  .eq("owner_id", ownerId);
if (productsError) throw new Error(`Could not read migrated products: ${productsError.message}`);

for (const name of ["Website", "Photo Cloud SaaS"]) {
  if (currentProducts.some((product) => product.name === name)) continue;
  const { error } = await supabase.from("products").insert({
    owner_id: ownerId,
    name,
    description: "",
    is_active: true,
  });
  if (error) throw new Error(`Could not seed product "${name}": ${error.message}`);
}

const productIdByLegacyId = new Map(
  currentProducts
    .filter((product) => product.legacy_product_id)
    .map((product) => [product.legacy_product_id, product.id])
);
const leadProducts = [];
const meetings = [];

for (const row of sourceProductStatuses) {
  const leadPhone = phoneByContactId.get(row.contact_id);
  const productId = productIdByLegacyId.get(row.product_id);
  if (!leadPhone || !productId) {
    reviewRows.push({
      owner_id: ownerId,
      source_file: "contact_product_statuses.csv",
      legacy_record_key: row.relationship_id,
      issue_code: !leadPhone
        ? "product_link_has_unresolved_lead"
        : "product_link_has_unknown_product",
      source_payload: row,
    });
    continue;
  }

  const statusMap = new Map([
    ["interested", "interested"],
    ["not interested", "not_interested"],
    ["follow-up needed", "follow_up_needed"],
    ["meeting scheduled", "meeting_scheduled"],
    ["demo completed", "demo_completed"],
    ["converted/customer", "converted"],
  ]);
  leadProducts.push({
    owner_id: ownerId,
    lead_phone: leadPhone,
    product_id: productId,
    interest_status: statusMap.get((row.interest_status || "").trim().toLowerCase()) || null,
    email: row.email || "",
    notes: row.notes || "",
    legacy_payload: row,
  });

  if (row.follow_up_date) {
    reviewRows.push({
      owner_id: ownerId,
      source_file: "contact_product_statuses.csv",
      legacy_record_key: `${row.relationship_id}:follow_up`,
      issue_code: "legacy_follow_up_missing_type_or_note",
      source_payload: row,
    });
  }
  if (row.meeting_date) {
    meetings.push({
      owner_id: ownerId,
      lead_phone: leadPhone,
      product_id: productId,
      legacy_meeting_key: row.relationship_id,
      mode: null,
      scheduled_at: null,
      legacy_date: row.meeting_date,
      legacy_time: row.meeting_time || null,
      note: row.notes || "",
      legacy_payload: row,
    });
    reviewRows.push({
      owner_id: ownerId,
      source_file: "contact_product_statuses.csv",
      legacy_record_key: `${row.relationship_id}:meeting`,
      issue_code: "legacy_meeting_mode_or_timezone_unknown",
      source_payload: row,
    });
  }
}

for (const row of sourceLeads) {
  const leadPhone = phoneByContactId.get(row.contact_id);
  if (!leadPhone || !row.meeting_date || row.is_meeting_milestone?.trim().toLowerCase() !== "yes") {
    continue;
  }
  meetings.push({
    owner_id: ownerId,
    lead_phone: leadPhone,
    product_id: null,
    legacy_meeting_key: `${row.contact_id}:lead-meeting`,
    mode: null,
    scheduled_at: null,
    legacy_date: row.meeting_date,
    legacy_time: row.meeting_time || null,
    note: "",
    legacy_payload: row,
  });
}
await upsertRows("lead_products", leadProducts, "lead_phone,product_id", true);
await upsertRows("meetings", meetings, "legacy_meeting_key", true);

const activities = [];
for (const row of sourceChangelog) {
  const occurredAt = dateTime(row.timestamp);
  if (!occurredAt) {
    reviewRows.push({
      owner_id: ownerId,
      source_file: "changelog.csv",
      legacy_record_key: row.id,
      issue_code: "invalid_history_timestamp",
      source_payload: row,
    });
    continue;
  }

  const before = parseSnapshot(row.before);
  const after = parseSnapshot(row.after);
  let type = "legacy";
  let isCallAttempt = false;
  if (row.change_type === "cold_call_logged") {
    type = "call";
    isCallAttempt = true;
  } else if (row.change_type === "whatsapp_logged") {
    type = "whatsapp";
  } else if (row.change_type === "meeting_booked") {
    const callChanged =
      before?.cold_call_last_contacted_at !== after?.cold_call_last_contacted_at;
    const whatsappChanged =
      before?.whatsapp_initial_contacted_at !== after?.whatsapp_initial_contacted_at ||
      before?.whatsapp_followup_contacted_at !== after?.whatsapp_followup_contacted_at;
    if (callChanged) {
      type = "call";
      isCallAttempt = true;
    } else if (whatsappChanged) {
      type = "whatsapp";
    } else {
      type = "meeting";
    }
  }

  const contactPhone = phoneByContactId.get(row.contact_id);
  activities.push({
    owner_id: ownerId,
    lead_phone: contactPhone || null,
    legacy_contact_id: row.contact_id || null,
    source_changelog_id: row.id,
    type,
    outcome: after?.cold_call_status || row.change_type || null,
    occurred_at: occurredAt,
    note: changedNote(before, after),
    is_call_attempt: isCallAttempt,
    source_payload: row,
  });
}
await upsertRows("activities", activities, "source_changelog_id", true);
await stageReview(reviewRows);

let dailyCallTarget = 30;
try {
  const settings = JSON.parse(readFileSync(new URL("settings.json", dataDirectory), "utf8"));
  const parsedTarget = Number(settings.daily_call_limit);
  if (Number.isFinite(parsedTarget) && parsedTarget > 0) {
    dailyCallTarget = Math.round(parsedTarget);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const { error: settingsError } = await supabase
  .from("crm_settings")
  .upsert({ owner_id: ownerId, daily_call_target: dailyCallTarget }, { onConflict: "owner_id", ignoreDuplicates: true });
if (settingsError) throw new Error(`Could not migrate CRM settings: ${settingsError.message}`);

const { count: stagedCount, error: reviewCountError } = await supabase
  .from("legacy_migration_review")
  .select("id", { count: "exact", head: true })
  .eq("owner_id", ownerId)
  .eq("review_status", "pending");
if (reviewCountError) throw new Error(`Could not verify migration review queue: ${reviewCountError.message}`);

console.log(
  JSON.stringify(
    {
      leadsImported: leadsToInsert.length,
      duplicateOrAmbiguousLeadRowsStaged: reviewRows.filter(
        (item) =>
          item.source_file === "outreach_master_tracker.csv" &&
          ["duplicate_normalized_phone", "invalid_or_missing_phone", "ambiguous_legacy_status"].includes(item.issue_code)
      ).length,
      productsImported: productsToInsert.length,
      productLinksImported: leadProducts.length,
      legacyMeetingsPreserved: meetings.length,
      historicalActivitiesImported: activities.length,
      reviewItemsPending: stagedCount,
      sourceCsvFilesChanged: false,
    },
    null,
    2
  )
);
