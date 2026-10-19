"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressChart } from "@/components/dashboard/progress-chart";

type DashboardData = {
  today_work: {
    call_target: number;
    calls_completed: number;
    meetings: number;
    call_follow_ups: number;
    whatsapp_follow_ups: number;
    tasks: number;
  };
  total_lead_analytics: {
    total_leads: number;
    contacted: number;
    not_contacted: number;
    in_progress: number;
    no_answer: number;
    closed: number;
    won: number;
    lost: number;
    deferred: number;
    closed_without_outcome: number;
    archived: number;
  };
  campaign_analytics: {
    total_leads: number;
    active_leads: number;
    not_contacted: number;
    in_progress: number;
    no_answer: number;
    answered_called_leads: number;
    closed: number;
    won: number;
    lost: number;
    deferred: number;
    follow_ups: number;
    reengagement_needed: number;
  };
  money: {
    pipeline_amount: number;
    pipeline_leads: number;
    earned_this_month: number;
    earned_all_time: number;
    monthly_income_goal: number;
    pipeline_target: number | null;
    historical_win_rate: number | null;
    closed_deals: number;
    won_deals: number;
  };
  outreach_plan: {
    current_month: string;
    income_goal: number;
    income_earned: number;
    income_remaining: number;
    calendar_days_left: number;
    working_days_left: number;
    working_days_after_today: number;
    campaign_leads: number;
    unique_leads_called: number;
    calls_all_time: number;
    conversations_all_time: number;
    no_answer_calls_all_time: number;
    no_answer_lead_status: number;
    calls_this_month: number;
    calls_today: number;
    conversations_this_month: number;
    answered_this_month: number;
    call_to_answer_rate: number;
    call_to_follow_up_rate: number | null;
    call_to_in_progress_rate: number | null;
    call_to_deal_closed_rate: number;
    conversation_to_deal_closed_rate: number;
    call_to_answer_is_assumed: boolean;
    in_progress_leads: number;
    close_rate: number | null;
    average_won_amount: number;
    campaign_won_leads: number;
    campaign_lost_leads: number;
    is_using_initial_deal_rates: boolean;
    calls_needed_for_goal: number | null;
    calls_remaining_this_month: number | null;
    calls_needed_today: number | null;
    calls_per_workday_after_today: number | null;
    conversations_needed_for_goal: number | null;
    conversations_remaining_this_month: number | null;
    conversations_per_workday_after_today: number | null;
  };
  call_progress: { date: string; calls: number; target: number; percent: number }[];
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatRate = (rate: number | null) =>
  rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;

const formatMonth = (month: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(`${month}-01T12:00:00Z`)
  );

const workItems = [
  { key: "meetings", label: "Meetings today", href: "/follow-ups?view=meetings" },
  { key: "call_follow_ups", label: "Call follow-ups today", href: "/follow-ups?view=calls" },
  { key: "whatsapp_follow_ups", label: "WhatsApp follow-ups", href: "/follow-ups?view=whatsapp" },
  { key: "tasks", label: "Other tasks", href: "/follow-ups?view=tasks" },
] as const;

const totalLeadItems = [
  { key: "total_leads", label: "Total leads" },
  { key: "contacted", label: "Contacted (excludes no answer)" },
  { key: "not_contacted", label: "Not contacted" },
  { key: "in_progress", label: "In progress" },
  { key: "no_answer", label: "No answer" },
  { key: "archived", label: "Archived" },
] as const;

const closedLeadItems = [
  { key: "closed", label: "Closed leads" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "deferred", label: "Deferred / not now" },
  { key: "closed_without_outcome", label: "Closed without outcome" },
] as const;

const campaignLeadItems = [
  { key: "total_leads", label: "Unique campaign leads" },
  { key: "active_leads", label: "Active campaign leads" },
  { key: "answered_called_leads", label: "Called leads with an answered call" },
  { key: "not_contacted", label: "Not contacted" },
  { key: "in_progress", label: "In progress" },
  { key: "no_answer", label: "No answer" },
  { key: "closed", label: "Closed leads" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "deferred", label: "Deferred / not now" },
  { key: "follow_ups", label: "Open follow-ups" },
] as const;

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const response = await fetch("/api/dashboard");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load the dashboard.");
        if (active) setData(result);
      } catch (loadError: unknown) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the dashboard.");
        }
      }
    };
    void loadDashboard();
    const interval = window.setInterval(loadDashboard, 60_000);
    window.addEventListener("focus", loadDashboard);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadDashboard);
    };
  }, []);

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-rust/40 bg-rust-soft p-4 text-sm">
        {error}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">Loading today&apos;s work...</p>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">A clear view of today&apos;s sales work.</p>
        </div>
        <Link
          href="/calls"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Start calling
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s calls</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {data.today_work.calls_completed}
              <span className="text-lg text-muted-foreground"> / {data.today_work.call_target}</span>
            </p>
            <Link className="mt-3 inline-block text-sm font-medium text-primary underline" href="/calls">
              Complete today&apos;s calls
            </Link>
          </CardContent>
        </Card>
        {workItems.map((item) => (
          <Link key={item.key} href={item.href}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{data.today_work[item.key]}</p>
                <p className="mt-2 text-xs text-muted-foreground">View and manage</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Current-month income and calling plan</h2>
          <p className="text-sm text-muted-foreground">
            Call attempts come from campaign calls only, so mirrored activity log entries are not double-counted.
            Real conversations use the campaign&apos;s over-60-second definition.
          </p>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: `Calls → answered${data.outreach_plan.call_to_answer_is_assumed ? " · assumed" : ""}`,
              value: formatRate(data.outreach_plan.call_to_answer_rate),
            },
            { label: "Calls → follow-up / meeting", value: formatRate(data.outreach_plan.call_to_follow_up_rate) },
            { label: "Called leads → In Progress", value: formatRate(data.outreach_plan.call_to_in_progress_rate) },
            { label: "Calls → Won deal", value: formatRate(data.outreach_plan.call_to_deal_closed_rate) },
            { label: "Real conversations → Won deal", value: formatRate(data.outreach_plan.conversation_to_deal_closed_rate) },
            { label: "Calls logged · all time", value: data.outreach_plan.calls_all_time },
            { label: "Real conversations · all time", value: data.outreach_plan.conversations_all_time },
            { label: "No-answer calls · all time", value: data.outreach_plan.no_answer_calls_all_time },
            { label: "Campaign leads called", value: `${data.outreach_plan.unique_leads_called} / ${data.outreach_plan.campaign_leads}` },
            { label: "Called leads currently In Progress", value: data.outreach_plan.in_progress_leads },
            { label: "Called leads currently No Answer", value: data.outreach_plan.no_answer_lead_status },
            { label: "Won / Lost called leads", value: `${data.outreach_plan.campaign_won_leads} / ${data.outreach_plan.campaign_lost_leads}` },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap justify-between gap-2">
              <div>
                <h3 className="font-semibold">{formatMonth(data.outreach_plan.current_month)} goal</h3>
                <p className="text-xs text-muted-foreground">
                  {data.outreach_plan.calendar_days_left} calendar days and{" "}
                  {data.outreach_plan.working_days_left} working days left, including today. Saturdays
                  and Sundays are days off.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Campaign Won/(Won + Lost): {formatRate(data.outreach_plan.close_rate)} · Expected amount per win:{" "}
                {formatCurrency(data.outreach_plan.average_won_amount)}
              </p>
            </div>
            {data.outreach_plan.income_goal > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-sm text-muted-foreground">Income progress</p>
                    <p className="mt-1 font-semibold">
                      {formatCurrency(data.outreach_plan.income_earned)} /{" "}
                      {formatCurrency(data.outreach_plan.income_goal)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(data.outreach_plan.income_remaining)} left to goal
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-sm text-muted-foreground">Calls made today</p>
                    <p className="mt-1 text-2xl font-semibold">{data.outreach_plan.calls_today}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.outreach_plan.calls_needed_today === null
                        ? "Need more call or deal history to estimate today's pace."
                        : `${data.outreach_plan.calls_needed_today} more to stay on pace today`}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-sm text-muted-foreground">Calls remaining this month</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {data.outreach_plan.calls_remaining_this_month ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.outreach_plan.calls_needed_for_goal === null
                        ? "Set a monthly goal to see the call estimate."
                        : `${data.outreach_plan.calls_this_month} campaign calls logged this month`}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-sm text-muted-foreground">Daily calls after today</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {data.outreach_plan.calls_per_workday_after_today ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Across {data.outreach_plan.working_days_after_today} remaining workdays
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">Real conversations needed</p>
                    <p className="mt-1 font-semibold">
                      {data.outreach_plan.conversations_remaining_this_month ?? "—"} remaining this month
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.outreach_plan.conversations_per_workday_after_today ?? "—"} per workday after today ·{" "}
                      {data.outreach_plan.conversations_this_month} so far this month
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">Forecast inputs</p>
                    <p className="mt-1 text-sm">
                      {data.outreach_plan.campaign_won_leads} Won from{" "}
                      {data.outreach_plan.calls_all_time} calls and{" "}
                      {data.outreach_plan.conversations_all_time} real conversations
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.outreach_plan.is_using_initial_deal_rates
                        ? "Starting deal assumptions: 1 Won per 100 calls and 1 Won per 50 real conversations; both update as campaign wins are recorded."
                        : "Deal conversion rates and average deal amount update from called campaign leads marked Won."}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set this month&apos;s income goal in Settings to see the calls needed to reach it.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              All funnel metrics use campaign calls and unique campaign leads only; mirrored activities and duplicate leads across campaigns are excluded.
              No-answer attempts are distinct from leads whose current status is No Answer.
              Daily pace recalculates from campaign calls logged today and the remaining workdays.
            </p>
          </CardContent>
        </Card>
      </section>

      {data.campaign_analytics.reengagement_needed > 0 && (
        <Link
          href="/follow-ups?view=reengagement"
          className="rounded-lg border border-amber/50 bg-amber-soft/70 p-4 text-sm"
        >
          <span className="font-semibold">Re-engagement needed:</span>{" "}
          {data.campaign_analytics.reengagement_needed} in-progress campaign lead
          {data.campaign_analytics.reengagement_needed === 1 ? "" : "s"} have gone quiet without a next step.
        </Link>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Money in the pipeline</h2>
            <p className="text-sm text-muted-foreground">
              Estimated value for in-progress leads and actual money received on won deals.
            </p>
          </div>
          <Link href="/leads" className="text-sm font-medium text-primary underline">
            Manage deal values
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pipeline value</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(data.money.pipeline_amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.money.pipeline_leads} in-progress lead{data.money.pipeline_leads === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Suggested pipeline target</p>
              {data.money.pipeline_target !== null ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatCurrency(data.money.pipeline_amount)}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}/ {formatCurrency(data.money.pipeline_target)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Based on a {Math.round((data.money.historical_win_rate || 0) * 100)}% close rate
                    ({data.money.won_deals} Won of {data.money.closed_deals} closed).
                  </p>
                  <div
                    role="progressbar"
                    aria-label="Pipeline target progress"
                    aria-valuenow={Math.min(
                      100,
                      Math.round((data.money.pipeline_amount / data.money.pipeline_target) * 100)
                    )}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          (data.money.pipeline_amount / data.money.pipeline_target) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated pipeline needed for your monthly goal.
                  </p>
                </>
              ) : data.money.monthly_income_goal === 0 ? (
                <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-primary underline">
                  Set a monthly goal
                </Link>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Close a deal to establish a historical close rate.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Earned this month</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(data.money.earned_this_month)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Earned all time</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(data.money.earned_all_time)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Monthly income goal</p>
              {data.money.monthly_income_goal > 0 ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatCurrency(data.money.earned_this_month)}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}/ {formatCurrency(data.money.monthly_income_goal)}
                    </span>
                  </p>
                  <div
                    role="progressbar"
                    aria-label="Monthly income goal progress"
                    aria-valuenow={Math.min(
                      100,
                      Math.round((data.money.earned_this_month / data.money.monthly_income_goal) * 100)
                    )}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          (data.money.earned_this_month / data.money.monthly_income_goal) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-primary underline">
                  Set a monthly goal
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <ProgressChart
        callProgress={data.call_progress}
        initialTarget={data.today_work.call_target}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Total lead analytics</h2>
            <p className="text-sm text-muted-foreground">
              Counts use all rows in Leads, including archived and not-calling records. No-answer leads are not counted as contacted.
            </p>
          </div>
          <Link href="/analytics" className="text-sm font-medium text-primary underline">
            Full analytics
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totalLeadItems.map((item) => (
            <Card key={item.key}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{data.total_lead_analytics[item.key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <h3 className="mb-3 mt-5 font-semibold">Closed lead outcomes · all leads</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {closedLeadItems.map((item) => (
            <Card key={item.key}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{data.total_lead_analytics[item.key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Campaign analytics</h2>
          <p className="text-sm text-muted-foreground">
            Counts are limited to unique leads linked to your campaigns; call and conversation measures above use campaign calls.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {campaignLeadItems.map((item) => (
            <Card key={item.key}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{data.campaign_analytics[item.key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
