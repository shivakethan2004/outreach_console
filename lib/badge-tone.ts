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

export function currentStatusTone(status: string): BadgeTone {
  const s = (status || "").toLowerCase();
  if (s === "not interested") return "rust";
  if (s === "deal closed") return "green";
  if (s === "meeting booked" || s === "whatsapp - meeting arranged") return "green";
  if (s === "rescheduled" || s === "follow-up needed" || s === "whatsapp - responded")
    return "amber";
  if (s === "whatsapp - ghosted") return "outline";
  return "muted"; // "Can Call Again"
}

export function interestTone(level: string): BadgeTone {
  const s = (level || "").toLowerCase();
  if (s.startsWith("hot")) return "rust";
  if (s.startsWith("warm")) return "amber";
  if (s.startsWith("cold")) return "outline";
  return "muted";
}
