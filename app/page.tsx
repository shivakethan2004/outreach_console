import { readContacts } from "@/lib/csv-store";
import { readChangelog } from "@/lib/changelog-store";
import { readSettings } from "@/lib/settings-store";
import { nicheAnalytics } from "@/lib/insights";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { NicheAnalyticsSection } from "@/components/dashboard/niche-analytics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const contacts = readContacts();
  const changelog = readChangelog();
  const settings = readSettings();
  const niches = nicheAnalytics(contacts, changelog);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Just two things: are you hitting your daily call target, and is each niche actually
          converting.
        </p>
      </div>

      <ProgressChart changelog={changelog} initialLimit={settings.daily_call_limit} />

      <NicheAnalyticsSection niches={niches} />
    </div>
  );
}
