export function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isSameDay(iso: string, dayIso: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === dayIso;
}

export function relativeTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return iso;
  const today = todayIso();
  const dayIso = iso.slice(0, 10);
  if (dayIso === today) return "Today";
  const diffMs = new Date(today).getTime() - new Date(dayIso).getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 30) return `${diffDays}d ago`;
  return dayIso;
}
