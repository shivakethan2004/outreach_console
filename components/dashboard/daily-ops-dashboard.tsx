import { Contact } from "@/lib/types";
import { ContactProductStatus, Product } from "@/lib/products";
import { parseLocalDate, toLocalDateIso } from "@/lib/format";

function formatDate(iso: string): string {
  const parsed = parseLocalDate(iso);
  if (!parsed) return iso || "—";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  const [datePart, timePart] = value.split("T");
  if (timePart) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return formatDate(datePart || value);
}

function toIsoDate(date: Date): string {
  return toLocalDateIso(date);
}

function addDays(dateIso: string, offset: number): string {
  const parsed = parseLocalDate(dateIso) ?? new Date();
  parsed.setDate(parsed.getDate() + offset);
  return toLocalDateIso(parsed);
}

function sameDay(iso: string, dayIso: string): boolean {
  return (iso || "").slice(0, 10) === dayIso;
}

function sortByDate(a: ContactProductStatus, b: ContactProductStatus) {
  return (a.meeting_date || "").localeCompare(b.meeting_date || "") ||
    (a.meeting_time || "").localeCompare(b.meeting_time || "");
}

export function DailyOpsDashboard({
  contacts,
  products,
  statuses,
  settings,
}: {
  contacts: Contact[];
  products: Product[];
  statuses: ContactProductStatus[];
  settings: { daily_call_limit: number };
}) {
  const today = toIsoDate(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  const contactMap = new Map(contacts.map((contact) => [contact.contact_id, contact]));
  const productMap = new Map(products.map((product) => [product.product_id, product]));

  const productSnapshot = products.map((product) => {
    const rows = statuses.filter((entry) => entry.product_id === product.product_id);
    const interested = rows.filter((entry) => entry.interest_status === "Interested").length;
    const needingFollowUp = rows.filter((entry) => entry.interest_status === "Follow-up Needed").length;
    const demos = rows.filter((entry) => entry.meeting_status === "Demo Scheduled" || entry.meeting_status === "Demo Completed").length;
    return {
      product,
      interested,
      needingFollowUp,
      demos,
    };
  });

  const meetings = statuses
    .filter((entry) => !!entry.meeting_date)
    .sort(sortByDate)
    .map((entry) => ({
      ...entry,
      contact: contactMap.get(entry.contact_id),
      product: productMap.get(entry.product_id),
    }))
    .filter((entry) => !!entry.contact && !!entry.product);

  const todayMeetings = meetings.filter((entry) => sameDay(entry.meeting_date, today));
  const tomorrowMeetings = meetings.filter((entry) => sameDay(entry.meeting_date, tomorrow));
  const dayAfterMeetings = meetings.filter((entry) => sameDay(entry.meeting_date, dayAfter));
  const upcomingMeetings = meetings.filter((entry) => entry.meeting_date && entry.meeting_date > today).slice(0, 8);

  const nextFiveDays = Array.from({ length: 5 }, (_, index) => addDays(today, index));
  const freeDays = nextFiveDays.filter(
    (dateIso) => !meetings.some((meeting) => sameDay(meeting.meeting_date, dateIso))
  );

  const followUps = statuses
    .filter((entry) => !!entry.follow_up_date)
    .map((entry) => ({
      ...entry,
      contact: contactMap.get(entry.contact_id),
      product: productMap.get(entry.product_id),
    }))
    .filter((entry) => !!entry.contact && !!entry.product)
    .filter((entry) => {
      const followUpDate = parseLocalDate(entry.follow_up_date);
      if (!followUpDate) return false;
      const diffDays = Math.round((new Date(today).getTime() - followUpDate.getTime()) / 86400000);
      return diffDays >= 0 || entry.interest_status === "Follow-up Needed";
    })
    .sort((a, b) => (a.follow_up_date || "").localeCompare(b.follow_up_date || ""));

  const overdueFollowups = followUps.filter((entry) => {
    const followUpDate = parseLocalDate(entry.follow_up_date);
    if (!followUpDate) return false;
    return followUpDate.getTime() < new Date(today).getTime();
  });

  const totalCallsToday = 0;
  const callsRemaining = Math.max(settings.daily_call_limit - totalCallsToday, 0);
  const leadsAvailable = contacts.filter(
    (contact) => (contact.cold_call_status || "Not Contacted").trim() === "Not Contacted"
  ).length;
  const leadsRequired = settings.daily_call_limit;
  const leadsMissing = Math.max(leadsRequired - leadsAvailable, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Calls today</div>
          <div className="mt-2 text-2xl font-semibold">{totalCallsToday} / {settings.daily_call_limit}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Current block</div>
          <div className="mt-2 text-2xl font-semibold">{callsRemaining} left</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Leads available</div>
          <div className="mt-2 text-2xl font-semibold">{leadsAvailable}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Leads needed</div>
          <div className="mt-2 text-2xl font-semibold">{leadsMissing}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Today</h2>
            <span className="text-xs text-muted-foreground">{todayMeetings.length} meetings</span>
          </div>
          <div className="space-y-2">
            {todayMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings scheduled today.</p>
            ) : (
              todayMeetings.map((meeting) => (
                <div key={`${meeting.contact_id}-${meeting.product_id}`} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{meeting.contact?.name}</div>
                    <span className="text-xs text-muted-foreground">{meeting.product?.name}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{meeting.contact?.category || "Business"} • {meeting.meeting_time || "Time TBD"}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{meeting.email || "No email"} • {meeting.meeting_status || "Awaiting status"}</div>
                  <div className="mt-2 text-xs text-foreground">{meeting.notes || "No notes added."}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Product pipeline</h2>
            <span className="text-xs text-muted-foreground">{products.length} products</span>
          </div>
          <div className="space-y-3">
            {productSnapshot.map(({ product, interested, needingFollowUp, demos }) => (
              <div key={product.product_id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.status}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="rounded bg-secondary px-2 py-1">Interested: {interested}</div>
                  <div className="rounded bg-secondary px-2 py-1">Follow-up: {needingFollowUp}</div>
                  <div className="rounded bg-secondary px-2 py-1">Demos: {demos}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Tomorrow</h2>
          <div className="mt-3 space-y-2">
            {tomorrowMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings tomorrow.</p>
            ) : (
              tomorrowMeetings.map((meeting) => (
                <div key={`${meeting.contact_id}-${meeting.product_id}-tomorrow`} className="text-sm">
                  <div className="font-medium">{meeting.contact?.name}</div>
                  <div className="text-muted-foreground">{meeting.product?.name} • {meeting.meeting_time || "Time TBD"}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Day after tomorrow</h2>
          <div className="mt-3 space-y-2">
            {dayAfterMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings scheduled.</p>
            ) : (
              dayAfterMeetings.map((meeting) => (
                <div key={`${meeting.contact_id}-${meeting.product_id}-after`} className="text-sm">
                  <div className="font-medium">{meeting.contact?.name}</div>
                  <div className="text-muted-foreground">{meeting.product?.name} • {meeting.meeting_time || "Time TBD"}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Free days</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {freeDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No free days in the next 5 days.</p>
            ) : (
              freeDays.map((dateIso) => (
                <span key={dateIso} className="rounded bg-secondary px-2 py-1 text-xs">{formatDate(dateIso)}</span>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <div className="mt-3 space-y-2">
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming meetings found.</p>
            ) : (
              upcomingMeetings.map((meeting) => (
                <div key={`${meeting.contact_id}-${meeting.product_id}-upcoming`} className="rounded border border-border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{meeting.contact?.name}</span>
                    <span className="text-muted-foreground">{meeting.product?.name}</span>
                  </div>
                  <div className="text-muted-foreground">{formatDate(meeting.meeting_date)} • {meeting.meeting_time || "Time TBD"}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Missed follow-ups</h2>
          <div className="mt-3 space-y-2">
            {overdueFollowups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue follow-ups.</p>
            ) : (
              overdueFollowups.map((entry) => {
                const followUpDate = parseLocalDate(entry.follow_up_date);
                const overdueDays = followUpDate
                  ? Math.max(0, Math.round((new Date(today).getTime() - followUpDate.getTime()) / 86400000))
                  : 0;
                return (
                  <div key={`${entry.contact_id}-${entry.product_id}-followup`} className="rounded border border-border p-2 text-sm">
                    <div className="font-medium">{entry.contact?.name}</div>
                    <div className="text-muted-foreground">{entry.product?.name} • {formatDate(entry.follow_up_date)}</div>
                    <div className="mt-1 text-xs text-amber-600">{overdueDays} day(s) overdue</div>
                    <div className="mt-1 text-xs text-muted-foreground">{entry.notes || "No notes"}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
