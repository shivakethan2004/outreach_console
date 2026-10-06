"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsData = {
  selected_product_id: string | null;
  products: {
    id: string;
    name: string;
    is_active: boolean;
    lead_count: number;
    interested: number;
    follow_up_needed: number;
    converted: number;
  }[];
  total_leads: number;
  leads_by_status: {
    not_contacted: number;
    in_progress: number;
    no_answer: number;
    deals_closed: number;
  };
  leads_by_category: { category: string; count: number }[];
  calls_by_date: { date: string; calls: number }[];
  deals: { won: number; lost: number };
  follow_ups: {
    pending: number;
    today: number;
    upcoming: number;
    overdue: number;
    by_type: { call: number; whatsapp: number; meeting: number };
  };
};

const statusMetrics = [
  { key: "not_contacted", label: "Not contacted" },
  { key: "in_progress", label: "In progress" },
  { key: "no_answer", label: "No answer" },
  { key: "deals_closed", label: "Deals closed" },
] as const;

const followUpMetrics = [
  { key: "call", label: "Call follow-ups" },
  { key: "whatsapp", label: "WhatsApp follow-ups" },
  { key: "meeting", label: "Meeting follow-ups" },
] as const;

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("all");
  const [error, setError] = useState<{ productId: string; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    const query = selectedProductId === "all"
      ? ""
      : `?product_id=${encodeURIComponent(selectedProductId)}`;
    fetch(`/api/analytics${query}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load analytics.");
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError({
            productId: selectedProductId,
            message: loadError instanceof Error ? loadError.message : "Could not load analytics.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [selectedProductId]);

  const expectedProductId = selectedProductId === "all" ? null : selectedProductId;
  const loading =
    data?.selected_product_id !== expectedProductId &&
    error?.productId !== selectedProductId;
  const currentError = error?.productId === selectedProductId ? error.message : "";

  if (currentError && !data) {
    return <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{currentError}</p>;
  }
  if (!data) return <p className="text-sm text-muted-foreground">Loading analytics...</p>;

  const maxCalls = Math.max(1, ...data.calls_by_date.map((item) => item.calls));
  const visibleProducts = selectedProductId === "all"
    ? data.products.filter((product) => product.is_active)
    : data.products.filter((product) => product.id === selectedProductId);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lead pipeline, sales outcomes, and follow-up activity by product.
          </p>
        </div>
        <div className="min-w-52 space-y-1.5">
          <label htmlFor="analytics-product" className="text-sm font-medium">Filter analytics by product</label>
          <select
            id="analytics-product"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="all">All products</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}{product.is_active ? "" : " (archived)"}
              </option>
            ))}
          </select>
        </div>
      </header>
      {currentError && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{currentError}</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Updating analytics...</p>}

      <section aria-label="Lead analytics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Leads in view</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_leads}</p>
        </CardContent></Card>
        {statusMetrics.map((item) => (
          <Card key={item.key}><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold">{data.leads_by_status[item.key]}</p>
          </CardContent></Card>
        ))}
      </section>

      <section aria-label="Deal outcomes" className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Deals won</p>
          <p className="mt-1 text-3xl font-semibold">{data.deals.won}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Not interested / lost</p>
          <p className="mt-1 text-3xl font-semibold">{data.deals.lost}</p>
        </CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Open follow-ups</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-sm text-muted-foreground">Pending total</p><p className="text-2xl font-semibold">{data.follow_ups.pending}</p></div>
            <div><p className="text-sm text-muted-foreground">Due today</p><p className="text-2xl font-semibold">{data.follow_ups.today}</p></div>
            <div><p className="text-sm text-muted-foreground">Upcoming</p><p className="text-2xl font-semibold">{data.follow_ups.upcoming}</p></div>
            <div><p className="text-sm text-muted-foreground">Overdue</p><p className="text-2xl font-semibold">{data.follow_ups.overdue}</p></div>
          </div>
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
            {followUpMetrics.map((item) => (
              <div key={item.key} className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{data.follow_ups.by_type[item.key]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Calls attempted (last 90 days)</CardTitle></CardHeader>
          <CardContent>
            {data.calls_by_date.length === 0 ? (
              <p className="text-sm text-muted-foreground">No call attempts recorded for this selection.</p>
            ) : (
              <div className="flex h-52 items-end gap-1 overflow-x-auto border-b border-border pb-1">
                {data.calls_by_date.map((item) => (
                  <div key={item.date} className="group flex h-full min-w-5 flex-col justify-end">
                    <span className="mb-1 hidden text-center text-[10px] group-hover:block">{item.calls}</span>
                    <div
                      title={`${item.date}: ${item.calls} attempts`}
                      className="w-full rounded-t bg-teal"
                      style={{ height: `${Math.max(2, (item.calls / maxCalls) * 100)}%` }}
                    />
                    <span className="mt-1 -rotate-45 text-[9px] text-muted-foreground">
                      {item.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Leads by category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.leads_by_category.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads for this selection.</p>
            ) : data.leads_by_category.map((item) => {
              const total = data.leads_by_category.reduce((sum, value) => sum + value.count, 0);
              return (
                <div key={item.category}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate">{item.category}</span><span>{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / Math.max(1, total)) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Product pipeline</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products match this selection.</p>
          ) : visibleProducts.map((product) => (
            <div key={product.id} className="rounded-md border border-border p-3">
              <h3 className="font-medium">{product.name}</h3>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Leads</dt><dd>{product.lead_count}</dd>
                <dt className="text-muted-foreground">Interested</dt><dd>{product.interested}</dd>
                <dt className="text-muted-foreground">Follow-up needed</dt><dd>{product.follow_up_needed}</dd>
                <dt className="text-muted-foreground">Converted</dt><dd>{product.converted}</dd>
              </dl>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
