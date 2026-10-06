export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addDaysToDate(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateTimeInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${dateInTimeZone(date, timeZone)}T${value("hour")}:${value("minute")}:${value("second")}`;
}

export function isLocalDateTime(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
  ) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function formatRelativeSchedule(value: string, today: string): string {
  const date = value.slice(0, 10);
  const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const todayParts = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateParts || !todayParts) return value.replace("T", " ");

  const [year, month, day] = dateParts.slice(1).map(Number);
  const [todayYear, todayMonth, todayDay] = todayParts.slice(1).map(Number);
  const dayDifference =
    (Date.UTC(year, month - 1, day) -
      Date.UTC(todayYear, todayMonth - 1, todayDay)) /
    86_400_000;
  const relative =
    dayDifference === 0
      ? "Today"
      : dayDifference === 1
        ? "Tomorrow"
        : dayDifference === -1
          ? "Yesterday"
          : dayDifference > 0
            ? `In ${dayDifference} days`
            : `${Math.abs(dayDifference)} days ago`;
  const absolute = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
  const time = value.length >= 16 ? value.slice(11, 16) : "";

  return `${relative} (${absolute})${time ? ` · ${time}` : ""}`;
}
