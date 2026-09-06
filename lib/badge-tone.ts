export type BadgeTone = "muted" | "teal" | "green" | "amber" | "rust" | "outline";

export function statusTone(status: string): BadgeTone {
  const s = (status || "").toLowerCase();
  if (!s || s === "not contacted") return "muted";
  if (
    s.includes("interested") ||
    s.includes("meeting") ||
    s.includes("contacted")
  )
    return "teal";
  if (
    s.includes("declined") ||
    s.includes("not interested") ||
    s.includes("no answer") ||
    s.includes("failed") ||
    s.includes("did not")
  )
    return "rust";
  if (s.includes("gatekeeper") || s.includes("brochure") || s.includes("no call"))
    return "amber";
  return "outline";
}

export function interestTone(level: string): BadgeTone {
  const s = (level || "").toLowerCase();
  if (s.startsWith("hot")) return "rust";
  if (s.startsWith("warm")) return "amber";
  if (s.startsWith("cold")) return "outline";
  return "muted";
}
