"use client";

import { useCallback, useEffect, useState } from "react";
import { Lead, Product } from "@/lib/crm-types";
import { CallOutcomeForm } from "./call-outcome-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeadTimelineDialog } from "@/components/crm/lead-timeline-dialog";

type QueueLead = Pick<
  Lead,
  "phone" | "name" | "category" | "status" | "notes" | "updated_at"
> & { last_activity_at: string | null };

type DashboardToday = { calls_completed: number; call_target: number };

export function CallsView() {
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [today, setToday] = useState<DashboardToday>({ calls_completed: 0, call_target: 30 });
  const [selected, setSelected] = useState<QueueLead | null>(null);
  const [timelinePhone, setTimelinePhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [queueResponse, productResponse, dashboardResponse] = await Promise.all([
        fetch("/api/calls/queue"),
        fetch("/api/products"),
        fetch("/api/dashboard"),
      ]);
      const [queueData, productData, dashboardData] = await Promise.all([
        queueResponse.json(),
        productResponse.json(),
        dashboardResponse.json(),
      ]);
      const failed = [queueResponse, productResponse, dashboardResponse].find((response) => !response.ok);
      if (failed) {
        const responseData = !queueResponse.ok
          ? queueData
          : !productResponse.ok
            ? productData
            : dashboardData;
        throw new Error(responseData.error || "Could not load the call queue.");
      }
      setQueue(queueData.queue);
      setProducts(productData.products);
      setToday({
        calls_completed: dashboardData.today_work.calls_completed,
        call_target: dashboardData.today_work.call_target,
      });
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the call queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/calls/queue"),
      fetch("/api/products"),
      fetch("/api/dashboard"),
    ])
      .then(async ([queueResponse, productResponse, dashboardResponse]) => {
        const [queueData, productData, dashboardData] = await Promise.all([
          queueResponse.json(),
          productResponse.json(),
          dashboardResponse.json(),
        ]);
        const failedData = !queueResponse.ok
          ? queueData
          : !productResponse.ok
            ? productData
            : !dashboardResponse.ok
              ? dashboardData
              : null;
        if (failedData) throw new Error(failedData.error || "Could not load the call queue.");
        if (!active) return;
        setQueue(queueData.queue);
        setProducts(productData.products);
        setToday({
          calls_completed: dashboardData.today_work.calls_completed,
          call_target: dashboardData.today_work.call_target,
        });
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the call queue.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete today&apos;s calls.</p>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm text-muted-foreground">Attempts completed today</p>
            <p className="text-3xl font-semibold">
              {today.calls_completed}<span className="text-lg text-muted-foreground"> / {today.call_target}</span>
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Every attempted call counts, whatever the outcome.
          </div>
        </CardContent>
      </Card>

      {error && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{error}</p>}

      <LeadTimelineDialog phone={timelinePhone} onOpenChange={setTimelinePhone} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Call queue</h2>
            <span className="text-xs text-muted-foreground">{queue.length} leads</span>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading calls...</p>
          ) : queue.length === 0 ? (
            <Card><CardContent className="p-5 text-sm text-muted-foreground">
              You&apos;re caught up. No more leads need a call attempt today.
            </CardContent></Card>
          ) : (
            queue.map((lead) => (
              <Card key={lead.phone}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setTimelinePhone(lead.phone)}
                      className="block max-w-full truncate text-left font-medium text-primary underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`View notes and timeline for ${lead.name}`}
                    >
                      {lead.name}
                    </button>
                    <p className="truncate text-sm text-muted-foreground">
                      {lead.phone}{lead.category ? ` · ${lead.category}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lead.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSelected(lead)}>
                    Log call
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <section>
          {selected ? (
            <CallOutcomeForm
              lead={selected}
              products={products}
              onCancel={() => setSelected(null)}
              onDone={() => {
                setSelected(null);
                void load();
              }}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Choose a lead to record the call outcome.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
