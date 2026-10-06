"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { CrmSettings, LegacyMigrationReview, Product } from "@/lib/crm-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SettingsView() {
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviewItems, setReviewItems] = useState<LegacyMigrationReview[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [settingsResponse, productsResponse, reviewResponse] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/products"),
        fetch("/api/migration-review"),
      ]);
      const [settingsData, productsData, reviewData] = await Promise.all([
        settingsResponse.json(),
        productsResponse.json(),
        reviewResponse.json(),
      ]);
      if (!settingsResponse.ok) throw new Error(settingsData.error || "Could not load settings.");
      if (!productsResponse.ok) throw new Error(productsData.error || "Could not load products.");
      if (!reviewResponse.ok) throw new Error(reviewData.error || "Could not load migration reviews.");
      setSettings(settingsData.settings);
      setProducts(productsData.products);
      setReviewItems(reviewData.reviews);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/settings"), fetch("/api/products"), fetch("/api/migration-review")])
      .then(async ([settingsResponse, productsResponse, reviewResponse]) => {
        const [settingsData, productsData, reviewData] = await Promise.all([
          settingsResponse.json(),
          productsResponse.json(),
          reviewResponse.json(),
        ]);
        if (!settingsResponse.ok) throw new Error(settingsData.error || "Could not load settings.");
        if (!productsResponse.ok) throw new Error(productsData.error || "Could not load products.");
        if (!reviewResponse.ok) throw new Error(reviewData.error || "Could not load migration reviews.");
        if (!active) return;
        setSettings(settingsData.settings);
        setProducts(productsData.products);
        setReviewItems(reviewData.reviews);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_call_target: settings.daily_call_target,
          reengagement_days: settings.reengagement_days,
          time_zone: settings.time_zone,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save settings.");
      setSettings(result.settings);
      toast.success("Settings saved.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add product.");
      setName("");
      setDescription("");
      toast.success("Product added.");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not add product.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleProduct(product: Product) {
    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update product.");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not update product.");
    }
  }

  async function updateReview(
    item: LegacyMigrationReview,
    reviewStatus: "resolved" | "dismissed"
  ) {
    const resolutionNote = reviewNotes[item.id]?.trim();
    if (!resolutionNote) {
      toast.error("Add a note explaining how this record was reviewed.");
      return;
    }
    setReviewingId(item.id);
    try {
      const response = await fetch(`/api/migration-review/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: reviewStatus, resolution_note: resolutionNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the review.");
      setReviewNotes((current) => ({ ...current, [item.id]: "" }));
      await load();
      toast.success(reviewStatus === "resolved" ? "Record marked as reviewed." : "Review item dismissed.");
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : "Could not update the review.");
    } finally {
      setReviewingId("");
    }
  }

  function formatIssue(issueCode: string) {
    return issueCode.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
  }

  if (loading && !settings) return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Call goals, re-engagement, and products.</p>
      </header>
      {error && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{error}</p>}

      <Card>
        <CardHeader><CardTitle>Daily workflow</CardTitle></CardHeader>
        <CardContent>
          {settings && (
            <form onSubmit={saveSettings} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="daily-target">Daily call target</Label>
                <Input id="daily-target" type="number" min={1} max={1000} value={settings.daily_call_target} onChange={(event) => setSettings({ ...settings, daily_call_target: Number(event.target.value) })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reengagement-days">Re-engagement after days</Label>
                <Input id="reengagement-days" type="number" min={1} max={30} value={settings.reengagement_days} onChange={(event) => setSettings({ ...settings, reengagement_days: Number(event.target.value) })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crm-time-zone">Time zone</Label>
                <Input id="crm-time-zone" value={settings.time_zone} onChange={(event) => setSettings({ ...settings, time_zone: event.target.value })} required />
              </div>
              <div className="sm:col-span-3"><Button disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button></div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Products and services</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">A lead can be linked to multiple active products. Archived products remain on historical lead records.</p>
          <div className="space-y-2">
            {products.map((product) => (
              <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">{product.name}</p>
                  {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => void toggleProduct(product)}>
                  {product.is_active ? "Archive" : "Reactivate"}
                </Button>
              </div>
            ))}
          </div>
          <form onSubmit={addProduct} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="product-name">New product / SaaS</Label>
              <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-description">Description</Label>
              <Input id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="sm:col-span-2"><Button disabled={saving}>{saving ? "Saving..." : "Add product"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legacy data review{reviewItems.length > 0 ? ` (${reviewItems.length})` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ambiguous CSV rows are preserved here with their original data. Review notes only mark the item;
            they do not merge, change, or import a lead.
          </p>
          {reviewItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No legacy rows are waiting for review.</p>
          ) : (
            reviewItems.map((item) => (
              <section key={item.id} className="space-y-3 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">{formatIssue(item.issue_code)}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.source_file} · {item.legacy_record_key}
                  </p>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">View preserved CSV row</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-secondary p-3 text-xs whitespace-pre-wrap break-words">
                    {JSON.stringify(item.source_payload, null, 2)}
                  </pre>
                </details>
                <div className="space-y-1.5">
                  <Label htmlFor={`review-note-${item.id}`}>Review note</Label>
                  <Textarea
                    id={`review-note-${item.id}`}
                    value={reviewNotes[item.id] || ""}
                    onChange={(event) =>
                      setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                    maxLength={1000}
                    placeholder="Record the decision or why this item is being dismissed."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={reviewingId === item.id}
                    onClick={() => void updateReview(item, "resolved")}
                  >
                    Mark reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reviewingId === item.id}
                    onClick={() => void updateReview(item, "dismissed")}
                  >
                    Dismiss
                  </Button>
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
