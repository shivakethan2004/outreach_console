function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalDateIso(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function toLocalDateTimeIso(date = new Date()): string {
  return `${toLocalDateIso(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function parseLocalDate(dateIso?: string | null): Date | null {
  if (!dateIso) return null;
  const trimmed = dateIso.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nowIso(): string {
  return toLocalDateTimeIso(new Date());
}

export function todayIso(): string {
  return toLocalDateIso(new Date());
}

export function isSameDay(iso: string, dayIso: string): boolean {
  if (!iso) return false;
  const left = parseLocalDate(iso.slice(0, 10) || iso);
  const right = parseLocalDate(dayIso);
  if (!left || !right) return iso.slice(0, 10) === dayIso;
  return toLocalDateIso(left) === toLocalDateIso(right);
}

export function relativeTime(iso: string): string {
  if (!iso) return "—";
  const d = parseLocalDate(iso.length <= 10 ? iso : iso.slice(0, 10));
  if (!d) return iso;

  const today = parseLocalDate(todayIso());
  if (!today) return iso;

  const dayIso = toLocalDateIso(d);
  if (dayIso === todayIso()) return "Today";

  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 30) return `${diffDays}d ago`;
  return dayIso;
}
