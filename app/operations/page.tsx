import { readContacts } from "@/lib/csv-store";
import { readContactProductStatuses, readProducts } from "@/lib/products-store";
import { readSettings } from "@/lib/settings-store";
import { DailyOpsDashboard } from "@/components/dashboard/daily-ops-dashboard";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const contacts = readContacts();
  const products = readProducts();
  const statuses = readContactProductStatuses();
  const settings = readSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Operations Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Upcoming meetings, follow-ups, free days, and product validation pipeline.
        </p>
      </div>

      <DailyOpsDashboard
        contacts={contacts}
        products={products}
        statuses={statuses}
        settings={settings}
      />
    </div>
  );
}
