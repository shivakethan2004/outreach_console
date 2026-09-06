import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { importContacts, mapImportRow } from "@/lib/csv-store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const csvText = body?.csv;
  if (!csvText || typeof csvText !== "string") {
    return NextResponse.json({ error: "No CSV text provided" }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json(
      { error: "Couldn't parse that as CSV. Check the file and try again." },
      { status: 400 }
    );
  }

  const rows = parsed.data.map(mapImportRow);
  const result = importContacts(rows);

  return NextResponse.json({
    addedCount: result.added.length,
    skippedCount: result.skipped.length,
    added: result.added,
    skipped: result.skipped,
  });
}
