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
  analytics: {
    total_leads: number;
    not_contacted: number;
    in_progress: number;
    no_answer: number;
    talked_contacted: number;
    not_interested: number;
    deals_won: number;
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
  call_progress: { date: string; calls: number; target: number; percent: number }[];
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const workItems = [
  { key: "meetings", label: "Meetings today", href: "/follow-ups?view=meetings" },
  { key: "call_follow_ups", label: "Call follow-ups today", href: "/follow-ups?view=calls" },
  { key: "whatsapp_follow_ups", label: "WhatsApp follow-ups", href: "/follow-ups?view=whatsapp" },
  { key: "tasks", label: "Other tasks", href: "/follow-ups?view=tasks" },
] as const;

const analyticItems = [
  { key: "total_leads", label: "Total leads" },
  { key: "not_contacted", label: "Not contacted" },
  { key: "in_progress", label: "In progress" },
  { key: "no_answer", label: "No answer" },
  { key: "talked_contacted", label: "Talked / contacted" },
  { key: "not_interested", label: "Lost leads" },
  { key: "deals_won", label: "Deals won" },
  { key: "follow_ups", label: "Open follow-ups" },
] as const;

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load the dashboard.");
        if (active) setData(result);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the dashboard.");
        }
      });
    return () => {
      active = false;
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

      {data.analytics.reengagement_needed > 0 && (
        <Link
          href="/follow-ups?view=reengagement"
          className="rounded-lg border border-amber/50 bg-amber-soft/70 p-4 text-sm"
        >
          <span className="font-semibold">Re-engagement needed:</span>{" "}
          {data.analytics.reengagement_needed} in-progress lead
          {data.analytics.reengagement_needed === 1 ? "" : "s"} have gone quiet without a next step.
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
          <h2 className="text-lg font-semibold">Lead analytics</h2>
          <Link href="/analytics" className="text-sm font-medium text-primary underline">
            Full analytics
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {analyticItems.map((item) => (
            <Card key={item.key}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{data.analytics[item.key]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
