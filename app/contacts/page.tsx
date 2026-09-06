import { readContacts } from "@/lib/csv-store";
import { ContactsView } from "@/components/contacts/contacts-view";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = readContacts();
  return <ContactsView initialContacts={contacts} />;
}
