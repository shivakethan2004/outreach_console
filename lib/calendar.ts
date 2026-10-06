import { Contact } from "./types";
import { parseLocalDate, toLocalDateIso } from "./format";

export const SLOT_START_HOUR = 9; // 9:00
export const SLOT_END_HOUR = 19; // up to 18:30 start (19:00 end)
export const SLOT_MINUTES = 30;

export type Slot = {
  time: string; // "HH:MM" 24h
  label: string; // "9:00 AM"
};

export function generateSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const time = `${hh}:${mm}`;
      const period = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      slots.push({ time, label: `${hour12}:${mm} ${period}` });
    }
  }
  return slots;
}

/** Snaps an arbitrary "HH:MM" time to its containing slot start, e.g. "9:12" -> "09:00" */
export function snapToSlot(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const snappedMin = Math.floor(m / SLOT_MINUTES) * SLOT_MINUTES;
  return `${String(h).padStart(2, "0")}:${String(snappedMin).padStart(2, "0")}`;
}

export function meetingsOnDate(contacts: Contact[], dateIso: string): Contact[] {
  return contacts.filter(
    (c) =>
      c.is_meeting_milestone?.toLowerCase() === "yes" &&
      c.meeting_date === dateIso
  );
}

/** Meetings on a date that have a specific time set and land in a real slot. */
export function scheduledMeetings(contacts: Contact[], dateIso: string): Contact[] {
  return meetingsOnDate(contacts, dateIso).filter((c) => !!c.meeting_time);
}

/** Meetings on a date with no time set - shown separately since they can't be slotted. */
export function unscheduledMeetings(contacts: Contact[], dateIso: string): Contact[] {
  return meetingsOnDate(contacts, dateIso).filter((c) => !c.meeting_time);
}

export function todayDateIso(): string {
  return toLocalDateIso(new Date());
}

export function addDays(dateIso: string, delta: number): string {
  const d = parseLocalDate(dateIso);
  if (!d) return dateIso;
  d.setDate(d.getDate() + delta);
  return toLocalDateIso(d);
}

export function formatDateHeading(dateIso: string): string {
  const d = parseLocalDate(dateIso);
  if (!d) return dateIso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
