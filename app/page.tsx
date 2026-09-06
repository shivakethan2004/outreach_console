import { readContacts } from "@/lib/csv-store";
import { readChangelog } from "@/lib/changelog-store";
import {
  computeStats,
  byCategory,
  byInterestLevel,
  channelFunnel,
  coldCallOutcomeBreakdown,
  needsFollowUp,
  computeTodayStats,
} from "@/lib/insights";
import { StatCards } from "@/components/dashboard/stat-cards";
import {
  CategoryBarChart,
  InterestPieChart,
  ChannelFunnelChart,
  ColdCallOutcomeChart,
} from "@/components/dashboard/charts";
import { FollowUpsList } from "@/components/dashboard/followups-list";
import { TodayActivity } from "@/components/dashboard/today-activity";
import { ActivityTrendChart } from "@/components/dashboard/activity-trend-chart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const contacts = readContacts();
  const changelog = readChangelog();
  const stats = computeStats(contacts);
  const categoryData = byCategory(contacts);
  const interestData = byInterestLevel(contacts);
  const funnelData = channelFunnel(contacts);
  const outcomeData = coldCallOutcomeBreakdown(contacts);
  const followUps = needsFollowUp(contacts);
  const today = computeTodayStats(changelog);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Live view of{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            data/outreach_master_tracker.csv
          </code>{" "}
          — the CSV file is the database.
        </p>
      </div>

      <TodayActivity
        coldCallsToday={today.coldCallsToday}
        whatsappToday={today.whatsappToday}
        meetingsBookedToday={today.meetingsBookedToday}
        newOutreachToday={today.newOutreachToday}
        followUpsToday={today.followUpsToday}
        newLeadsToday={today.newLeadsToday}
      />

      <StatCards
        total={stats.total}
        coldCallContacted={stats.coldCallContacted}
        whatsappContacted={stats.whatsappContacted}
        meetings={stats.meetings}
        conversionRate={stats.conversionRate}
      />

      <ActivityTrendChart changelog={changelog} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChannelFunnelChart data={funnelData} />
        </div>
        <InterestPieChart data={interestData} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBarChart data={categoryData} />
        <ColdCallOutcomeChart data={outcomeData} />
      </div>

      <FollowUpsList contacts={followUps} />
    </div>
  );
}
