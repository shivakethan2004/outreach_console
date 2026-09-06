import { Contact, isDeadLead } from "./types";
import { ChangeEntry, parseSnapshot } from "./changelog-types";
import { todayIso, isSameDay } from "./format";

export function dailyActivitySeries(changelog: ChangeEntry[], days: number) {
  const today = todayIso();
  const series: {
    date: string;
    label: string;
    calls: number;
    whatsapp: number;
    meetings: number;
    newLeads: number;
  }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - i);
    const dateIso = d.toISOString().slice(0, 10);
    const dayEntries = changelog.filter((e) => isSameDay(e.timestamp, dateIso));

    series.push({
      date: dateIso,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      calls: dayEntries.filter((e) => e.change_type === "cold_call_logged").length,
      whatsapp: dayEntries.filter((e) => e.change_type === "whatsapp_logged").length,
      meetings: dayEntries.filter((e) => e.change_type === "meeting_booked").length,
      newLeads: dayEntries.filter(
        (e) => e.change_type === "created" || e.change_type === "imported"
      ).length,
    });
  }

  return series;
}

export function computeTodayStats(changelog: ChangeEntry[]) {
  const today = todayIso();
  const todays = changelog.filter((e) => isSameDay(e.timestamp, today));

  const coldCalls = todays.filter((e) => e.change_type === "cold_call_logged");
  const whatsapps = todays.filter((e) => e.change_type === "whatsapp_logged");
  const meetings = todays.filter((e) => e.change_type === "meeting_booked");
  const newLeads = todays.filter(
    (e) => e.change_type === "created" || e.change_type === "imported"
  );

  const touches = [...coldCalls, ...whatsapps];
  const newOutreach = touches.filter((e) => e.is_first_touch === "true").length;
  const followUps = touches.filter((e) => e.is_first_touch === "false").length;

  return {
    coldCallsToday: coldCalls.length,
    whatsappToday: whatsapps.length,
    meetingsBookedToday: meetings.length,
    newLeadsToday: newLeads.length,
    newOutreachToday: newOutreach,
    followUpsToday: followUps,
    totalActivityToday: todays.length,
  };
}


export function isContacted(status: string) {
  const s = (status || "").toLowerCase().trim();
  if (!s) return false;
  return s !== "not contacted";
}

export function parseDate(d: string): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function computeStats(contacts: Contact[]) {
  const total = contacts.length;
  const coldCallContacted = contacts.filter((c) =>
    isContacted(c.cold_call_status)
  ).length;
  const whatsappContacted = contacts.filter((c) =>
    isContacted(c.whatsapp_status)
  ).length;
  const bothChannels = contacts.filter(
    (c) => isContacted(c.cold_call_status) && isContacted(c.whatsapp_status)
  ).length;
  const meetings = contacts.filter(
    (c) => c.is_meeting_milestone?.toLowerCase() === "yes"
  ).length;
  const anyContacted = contacts.filter(
    (c) => isContacted(c.cold_call_status) || isContacted(c.whatsapp_status)
  ).length;
  const notContactedYet = total - anyContacted;
  const conversionRate = anyContacted > 0 ? (meetings / anyContacted) * 100 : 0;

  return {
    total,
    coldCallContacted,
    whatsappContacted,
    bothChannels,
    meetings,
    anyContacted,
    notContactedYet,
    conversionRate,
  };
}

export function byCategory(contacts: Contact[]) {
  const map = new Map<string, number>();
  for (const c of contacts) {
    const key = c.category?.trim() || "Uncategorized";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map, ([category, count]) => ({ category, count })).sort(
    (a, b) => b.count - a.count
  );
}

export function byInterestLevel(contacts: Contact[]) {
  const levels = ["Hot", "Warm", "Cold"];
  const map = new Map<string, number>();
  for (const c of contacts) {
    const raw = c.interest_level?.trim();
    if (!raw) continue;
    // normalize things like "Warm (unconfirmed)" -> "Warm"
    const matched = levels.find((l) => raw.toLowerCase().startsWith(l.toLowerCase()));
    const key = matched || raw;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map, ([level, count]) => ({ level, count }));
}

export function channelFunnel(contacts: Contact[]) {
  return [
    {
      channel: "Cold Call",
      Contacted: contacts.filter((c) => isContacted(c.cold_call_status)).length,
      "Not Contacted": contacts.filter((c) => !isContacted(c.cold_call_status))
        .length,
    },
    {
      channel: "WhatsApp",
      Contacted: contacts.filter((c) => isContacted(c.whatsapp_status)).length,
      "Not Contacted": contacts.filter((c) => !isContacted(c.whatsapp_status))
        .length,
    },
  ];
}

export function coldCallOutcomeBreakdown(contacts: Contact[]) {
  const map = new Map<string, number>();
  for (const c of contacts) {
    const status = c.cold_call_status?.trim();
    if (!status || status.toLowerCase() === "not contacted") continue;
    map.set(status, (map.get(status) || 0) + 1);
  }
  return Array.from(map, ([status, count]) => ({ status, count })).sort(
    (a, b) => b.count - a.count
  );
}

export function needsFollowUp(contacts: Contact[]) {
  return contacts.filter((c) => {
    if (c.is_meeting_milestone?.toLowerCase() === "yes") return false;
    if (c.next_follow_up_date?.trim()) return true;
    if (/follow[- ]?up/i.test(c.notes || "")) return true;
    return false;
  });
}

/** Leads that are still worth pursuing — "Not Interested" is a dead end. */
export function activeContacts(contacts: Contact[]) {
  return contacts.filter((c) => !isDeadLead(c.current_status));
}

/**
 * Progress = am I hitting my daily call-limit target. One bar per day,
 * colored by how close to (or past) the limit that day's calls got.
 */
export function progressSeries(
  changelog: ChangeEntry[],
  days: number,
  dailyLimit: number
) {
  const today = todayIso();
  const series: {
    date: string;
    label: string;
    calls: number;
    limit: number;
    pct: number;
    met: boolean;
  }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - i);
    const dateIso = d.toISOString().slice(0, 10);
    const calls = changelog.filter(
      (e) => e.change_type === "cold_call_logged" && isSameDay(e.timestamp, dateIso)
    ).length;
    const pct = dailyLimit > 0 ? Math.round((calls / dailyLimit) * 100) : 0;

    series.push({
      date: dateIso,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      calls,
      limit: dailyLimit,
      pct,
      met: calls >= dailyLimit,
    });
  }

  return series;
}

export type NicheVerdict =
  | "not_enough_data"
  | "working"
  | "promising"
  | "not_working";

export type NicheAnalytics = {
  category: string;
  totalCalls: number;
  whatsappOutreach: number;
  meetingsBooked: number;
  dealsClosed: number;
  verdict: NicheVerdict;
};

const MIN_CALLS_TO_JUDGE = 100;
const MIN_MEETINGS_TO_WORK = 5;
const MIN_DEALS_TO_WORK = 1;

/**
 * Per-niche (category) analytics: calls made, WhatsApp outreach sent, and
 * meetings booked — the three numbers that decide whether a niche is
 * worth continuing to focus on.
 */
export function nicheAnalytics(
  contacts: Contact[],
  changelog: ChangeEntry[]
): NicheAnalytics[] {
  // category lookup by contact_id, falling back to the changelog snapshot's
  // own category in case a contact was later deleted or recategorized.
  const categoryById = new Map<string, string>();
  for (const c of contacts) categoryById.set(c.contact_id, c.category?.trim() || "Uncategorized");

  function categoryFor(entry: ChangeEntry): string {
    const fromLive = categoryById.get(entry.contact_id);
    if (fromLive) return fromLive;
    const snap = parseSnapshot(entry.after) || parseSnapshot(entry.before);
    return snap?.category?.trim() || "Uncategorized";
  }

  const categories = new Set<string>(
    contacts.map((c) => c.category?.trim() || "Uncategorized")
  );

  const map = new Map<string, NicheAnalytics>();
  for (const category of categories) {
    map.set(category, {
      category,
      totalCalls: 0,
      whatsappOutreach: 0,
      meetingsBooked: 0,
      dealsClosed: 0,
      verdict: "not_enough_data",
    });
  }

  for (const entry of changelog) {
    const category = categoryFor(entry);
    if (!map.has(category)) {
      map.set(category, {
        category,
        totalCalls: 0,
        whatsappOutreach: 0,
        meetingsBooked: 0,
        dealsClosed: 0,
        verdict: "not_enough_data",
      });
    }
    const row = map.get(category)!;
    if (entry.change_type === "cold_call_logged") row.totalCalls += 1;
    if (entry.change_type === "whatsapp_logged") row.whatsappOutreach += 1;
    if (entry.change_type === "meeting_booked") row.meetingsBooked += 1;
  }

  for (const c of contacts) {
    if ((c.current_status || "").toLowerCase().trim() === "deal closed") {
      const category = c.category?.trim() || "Uncategorized";
      const row = map.get(category);
      if (row) row.dealsClosed += 1;
    }
  }

  for (const row of map.values()) {
    if (row.totalCalls < MIN_CALLS_TO_JUDGE) {
      row.verdict = "not_enough_data";
    } else if (row.meetingsBooked >= MIN_MEETINGS_TO_WORK && row.dealsClosed >= MIN_DEALS_TO_WORK) {
      row.verdict = "working";
    } else if (row.meetingsBooked > 0) {
      row.verdict = "promising";
    } else {
      row.verdict = "not_working";
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalCalls - a.totalCalls);
}

export function dueFollowUps(contacts: Contact[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return contacts
    .map((c) => ({ c, date: parseDate(c.next_follow_up_date) }))
    .filter((x) => x.date && x.date <= today)
    .map((x) => x.c);
}
