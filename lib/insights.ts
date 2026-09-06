import { Contact } from "./types";
import { ChangeEntry } from "./changelog-types";
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

export function dueFollowUps(contacts: Contact[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return contacts
    .map((c) => ({ c, date: parseDate(c.next_follow_up_date) }))
    .filter((x) => x.date && x.date <= today)
    .map((x) => x.c);
}
