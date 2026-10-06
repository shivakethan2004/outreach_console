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
  call_progress: { date: string; calls: number; target: number; percent: number }[];
};

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
  { key: "not_interested", label: "Not interested" },
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
