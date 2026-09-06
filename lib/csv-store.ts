import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { Contact, CSV_COLUMNS, emptyContact } from "./types";
import { ChangeType } from "./changelog-types";
import { logChange } from "./changelog-store";
import { normalizePhone, displayPhone } from "./phone";

const DATA_DIR = path.join(process.cwd(), "data");
const CSV_PATH = path.join(DATA_DIR, "outreach_master_tracker.csv");
const BACKUP_PATH = path.join(DATA_DIR, "outreach_master_tracker.backup.csv");

function ensureFileExists() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, CSV_COLUMNS.join(",") + "\n", "utf-8");
  }
}

export function readContacts(): Contact[] {
  ensureFileExists();
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data
    .filter((row) => row.contact_id)
    .map((row) => {
      const contact: Record<string, string> = {};
      for (const col of CSV_COLUMNS) {
        contact[col] = (row[col] ?? "").toString().trim();
      }
      return contact as Contact;
    });
}

export function writeContacts(contacts: Contact[]) {
  ensureFileExists();
  // keep a rolling backup of the previous state before overwriting
  if (fs.existsSync(CSV_PATH)) {
    fs.copyFileSync(CSV_PATH, BACKUP_PATH);
  }
  const csv = Papa.unparse(contacts, {
    columns: CSV_COLUMNS as unknown as string[],
    newline: "\n",
  });
  fs.writeFileSync(CSV_PATH, csv + "\n", "utf-8");
}

export function upsertContact(
  updated: Contact,
  opts?: { changeType?: ChangeType; isFirstTouch?: boolean; skipLog?: boolean }
): Contact[] {
  const contacts = readContacts();
  const idx = contacts.findIndex((c) => c.contact_id === updated.contact_id);
  const before = idx === -1 ? null : contacts[idx];
  if (idx === -1) {
    contacts.push(updated);
  } else {
    contacts[idx] = updated;
  }
  writeContacts(contacts);

  if (!opts?.skipLog) {
    logChange({
      contactId: updated.contact_id,
      contactName: updated.name,
      action: before ? "update" : "create",
      changeType: opts?.changeType ?? (before ? "field_edit" : "created"),
      before,
      after: updated,
      isFirstTouch: opts?.isFirstTouch,
    });
  }

  return contacts;
}

/** Writes a contact back exactly as given, without diffing against current state (used by undo). */
export function restoreContact(contact: Contact): Contact[] {
  return upsertContact(contact, { skipLog: true });
}

export function deleteContact(
  contactId: string,
  opts?: { skipLog?: boolean }
): Contact[] {
  const contacts = readContacts();
  const existing = contacts.find((c) => c.contact_id === contactId);
  const remaining = contacts.filter((c) => c.contact_id !== contactId);
  writeContacts(remaining);

  if (!opts?.skipLog && existing) {
    logChange({
      contactId: existing.contact_id,
      contactName: existing.name,
      action: "delete",
      changeType: "deleted",
      before: existing,
      after: null,
    });
  }

  return remaining;
}

export type ImportRow = {
  name?: string;
  category?: string;
  phone?: string;
  address?: string;
  rating?: string;
  reviews?: string;
  notes?: string;
};

export type ImportResult = {
  added: Contact[];
  skipped: { row: ImportRow; reason: string }[];
};

const IMPORT_FIELD_ALIASES: Record<string, keyof ImportRow> = {
  name: "name",
  "business name": "name",
  "contact name": "name",
  "contact person": "name",
  category: "category",
  type: "category",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  address: "address",
  rating: "rating",
  reviews: "reviews",
  notes: "notes",
  note: "notes",
};

export function mapImportRow(raw: Record<string, string>): ImportRow {
  const row: ImportRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const norm = key.trim().toLowerCase();
    const field = IMPORT_FIELD_ALIASES[norm];
    if (field && value?.trim()) {
      row[field] = value.trim();
    }
  }
  return row;
}

export function importContacts(rows: ImportRow[]): ImportResult {
  const contacts = readContacts();
  const existingPhones = new Set(
    contacts.map((c) => normalizePhone(c.phone)).filter(Boolean)
  );

  const added: Contact[] = [];
  const skipped: { row: ImportRow; reason: string }[] = [];
  let nextIdCounter = (() => {
    let max = 0;
    for (const c of contacts) {
      const m = /^C(\d+)$/.exec(c.contact_id.trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max;
  })();

  for (const row of rows) {
    if (!row.name?.trim()) {
      skipped.push({ row, reason: "Missing name" });
      continue;
    }
    const phoneNorm = row.phone ? normalizePhone(row.phone) : "";
    if (phoneNorm && existingPhones.has(phoneNorm)) {
      skipped.push({ row, reason: "Phone already in tracker (duplicate)" });
      continue;
    }
    nextIdCounter += 1;
    const id = "C" + String(nextIdCounter).padStart(3, "0");
    const contact: Contact = {
      ...emptyContact(id),
      name: row.name.trim(),
      category: row.category?.trim() || "",
      phone: row.phone ? displayPhone(row.phone) : "",
      address: row.address?.trim() || "",
      rating: row.rating?.trim() || "",
      reviews: row.reviews?.trim() || "",
      notes: row.notes?.trim() || "",
    };
    if (phoneNorm) existingPhones.add(phoneNorm);
    added.push(contact);
  }

  if (added.length > 0) {
    const all = [...contacts, ...added];
    writeContacts(all);
    for (const c of added) {
      logChange({
        contactId: c.contact_id,
        contactName: c.name,
        action: "create",
        changeType: "imported",
        before: null,
        after: c,
      });
    }
  }

  return { added, skipped };
}

export function nextContactId(contacts: Contact[]): string {
  let max = 0;
  for (const c of contacts) {
    const m = /^C(\d+)$/.exec(c.contact_id.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "C" + String(max + 1).padStart(3, "0");
}


