import { readContacts } from "@/lib/csv-store";
import { readChangelog } from "@/lib/changelog-store";
import { readSettings } from "@/lib/settings-store";
import { readProducts, readContactProductStatuses } from "@/lib/products-store";
import { nicheAnalytics } from "@/lib/insights";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { NicheAnalyticsSection } from "@/components/dashboard/niche-analytics";
import { DailyOpsDashboard } from "@/components/dashboard/daily-ops-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const contacts = readContacts();
  const changelog = readChangelog();
  const settings = readSettings();
  const products = readProducts();
  const statuses = readContactProductStatuses();
  const niches = nicheAnalytics(contacts, changelog);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Daily Command Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Calls, meetings, follow-ups, product validation, and lead pipeline in one view.
        </p>
      </div>

      <ProgressChart changelog={changelog} initialLimit={settings.daily_call_limit} />
      <DailyOpsDashboard
        contacts={contacts}
        products={products}
        statuses={statuses}
        settings={settings}
      />
      <NicheAnalyticsSection niches={niches} />
    </div>
  );
}
