import { readContacts } from "@/lib/csv-store";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const contacts = readContacts();
  return <CalendarView initialContacts={contacts} />;
}
