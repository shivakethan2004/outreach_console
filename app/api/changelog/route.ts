import { NextRequest, NextResponse } from "next/server";
import { readChangelog } from "@/lib/changelog-store";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "200");
  const entries = readChangelog().slice(0, limit);
  return NextResponse.json({ entries });
}
