import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { canonicalPhone } from "@/lib/phone";
import { requireAuthenticatedSupabase } from "@/lib/supabase/server";

type ImportIssue = {
  row: number;
  phone: string;
  reason: string;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function getField(row: Record<string, string>, aliases: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  );
  for (const alias of aliases) {
    const value = normalized.get(alias);
    if (value?.trim()) return value.trim();
  }
  return "";
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid CSV import request." }, { status: 400 });
  }
  const csv = (body as Record<string, unknown>).csv;
  if (typeof csv !== "string" || !csv.trim()) {
    return NextResponse.json({ error: "Choose a CSV file or paste CSV text." }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { error: `Could not parse the CSV: ${parsed.errors[0].message}` },
      { status: 400 }
    );
  }
  if (parsed.data.length === 0) {
    return NextResponse.json({ error: "The CSV contains no lead rows." }, { status: 400 });
  }
  if (parsed.data.length > 500) {
    return NextResponse.json({ error: "Import up to 500 lead rows at a time." }, { status: 400 });
  }

  const { supabase } = await requireAuthenticatedSupabase();
  const skipped: ImportIssue[] = [];
  const failed: ImportIssue[] = [];
  let importedCount = 0;

  for (const [index, row] of parsed.data.entries()) {
    const rowNumber = index + 2;
    const name = getField(row, ["name", "business name", "contact name", "contact person"]);
    const rawPhone = getField(row, ["phone", "phone number", "mobile"]);
    const phone = canonicalPhone(rawPhone);
    if (!name || !phone) {
      failed.push({
        row: rowNumber,
        phone: rawPhone,
        reason: !name ? "Missing name." : "Missing or invalid phone number.",
      });
      continue;
    }

    const { error } = await supabase.rpc("create_lead", {
      p_phone: phone,
      p_name: name,
      p_category: getField(row, ["category", "type"]),
      p_address: getField(row, ["address"]),
      p_rating: getField(row, ["rating"]),
      p_reviews: getField(row, ["reviews"]),
      p_notes: getField(row, ["notes", "note"]),
      p_product_ids: [],
    });
    if (!error) {
      importedCount += 1;
    } else if (error.code === "23505") {
      skipped.push({ row: rowNumber, phone, reason: "Phone number already exists." });
    } else if (error.code === "P0001") {
      failed.push({ row: rowNumber, phone, reason: error.message });
    } else {
      console.error("Lead CSV import row failed in Supabase", {
        row: rowNumber,
        code: error.code || "unknown",
      });
      failed.push({
        row: rowNumber,
        phone,
        reason: "Database request failed for this row; it was not imported.",
      });
    }
  }

  return NextResponse.json(
    {
      importedCount,
      skippedCount: skipped.length,
      failedCount: failed.length,
      skipped,
      failed,
    },
    { status: failed.length > 0 ? 207 : 200 }
  );
}
