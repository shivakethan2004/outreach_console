import fs from "fs";
import path from "path";
import crypto from "crypto";
import Papa from "papaparse";
import { Contact } from "./types";
import {
  ChangeEntry,
  ChangeAction,
  ChangeType,
  CHANGELOG_COLUMNS,
  parseSnapshot,
} from "./changelog-types";
import { nowIso } from "./format";

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_PATH = path.join(DATA_DIR, "changelog.csv");

function ensureFileExists() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOG_PATH)) {
    fs.writeFileSync(LOG_PATH, CHANGELOG_COLUMNS.join(",") + "\n", "utf-8");
  }
}

export function readChangelog(): ChangeEntry[] {
  ensureFileExists();
  const raw = fs.readFileSync(LOG_PATH, "utf-8");
  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data
    .filter((row) => row.id)
    .map((row) => {
      const entry: Record<string, string> = {};
      for (const col of CHANGELOG_COLUMNS) entry[col] = row[col] ?? "";
      return entry as unknown as ChangeEntry;
    })
    // newest first
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

function writeChangelog(entries: ChangeEntry[]) {
  ensureFileExists();
  // sort chronologically for storage, we sort newest-first only on read
  const chronological = [...entries].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : 1
  );
  const csv = Papa.unparse(chronological, {
    columns: CHANGELOG_COLUMNS as unknown as string[],
    newline: "\n",
  });
  fs.writeFileSync(LOG_PATH, csv + "\n", "utf-8");
}

export function logChange(params: {
  contactId: string;
  contactName: string;
  action: ChangeAction;
  changeType: ChangeType;
  before: Contact | null;
  after: Contact | null;
  isFirstTouch?: boolean;
  undoOf?: string;
}): ChangeEntry {
  const entry: ChangeEntry = {
    id: crypto.randomUUID(),
    timestamp: nowIso(),
    contact_id: params.contactId,
    contact_name: params.contactName,
    action: params.action,
    change_type: params.changeType,
    is_first_touch:
      params.isFirstTouch === undefined ? "" : String(params.isFirstTouch),
    before: params.before ? JSON.stringify(params.before) : "",
    after: params.after ? JSON.stringify(params.after) : "",
    undo_of: params.undoOf || "",
  };
  const entries = readChangelog();
  entries.push(entry);
  writeChangelog(entries);
  return entry;
}

export function findChange(id: string): ChangeEntry | undefined {
  return readChangelog().find((e) => e.id === id);
}

/** Returns the inverse mutation to apply for a given change entry. */
export function invertChange(entry: ChangeEntry): {
  type: "delete" | "restore";
  contact: Contact | null;
} {
  if (entry.action === "create") {
    return { type: "delete", contact: null };
  }
  // both "update" and "delete" are undone by restoring the "before" snapshot
  return { type: "restore", contact: parseSnapshot(entry.before) };
}
