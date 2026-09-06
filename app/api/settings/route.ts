import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings-store";

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const patch: { daily_call_limit?: number } = {};
  if (body.daily_call_limit !== undefined) {
    const n = Number(body.daily_call_limit);
    if (Number.isFinite(n) && n > 0) patch.daily_call_limit = Math.round(n);
  }
  const updated = writeSettings(patch);
  return NextResponse.json(updated);
}
