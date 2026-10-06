"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity as ActivityIcon } from "lucide-react";
import type { Activity as ActivityRecord, DealOutcome, Lead, LeadStatus, Product } from "@/lib/crm-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImportLeadsDialog } from "@/components/crm/import-leads-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LeadDraft = {
  name: string;
  phone: string;
  category: string;
  address: string;
  rating: string;
  reviews: string;
  notes: string;
  product_ids: string[];
};

const emptyDraft: LeadDraft = {
  name: "",
  phone: "",
  category: "",
  address: "",
  rating: "",
  reviews: "",
  notes: "",
  product_ids: [],
};

const statusLabels: Record<LeadStatus, string> = {
  not_contacted: "Not Contacted",
  in_progress: "In Progress",
  no_answer: "No Answer",
  deal_closed: "Deal Closed",
};

export function LeadsView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [closingPhone, setClosingPhone] = useState<string | null>(null);
  const [closeOutcome, setCloseOutcome] = useState<DealOutcome | "">("");
  const [editingProducts, setEditingProducts] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [draft, setDraft] = useState<LeadDraft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [leadResponse, productResponse] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/products"),
      ]);
      const [leadData, productData] = await Promise.all([
        leadResponse.json(),
        productResponse.json(),
      ]);
      const failed = [leadResponse, productResponse].find((response) => !response.ok);
      if (failed) throw new Error(leadData.error || productData.error || "Could not load leads.");
      setLeads(leadData.leads);
      setProducts(productData.products);
      setSelectedPhone((current) =>
        leadData.leads.some((lead: Lead) => lead.phone === current)
          ? current
          : leadData.leads[0]?.phone || ""
      );
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/leads"), fetch("/api/products")])
      .then(async ([leadResponse, productResponse]) => {
        const [leadData, productData] = await Promise.all([
          leadResponse.json(),
          productResponse.json(),
        ]);
        if (!leadResponse.ok || !productResponse.ok) {
          throw new Error(leadData.error || productData.error || "Could not load leads.");
        }
        if (!active) return;
        setLeads(leadData.leads);
        setProducts(productData.products);
        setSelectedPhone((current) =>
          leadData.leads.some((lead: Lead) => lead.phone === current)
            ? current
            : leadData.leads[0]?.phone || ""
        );
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load leads.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPhone) return;
    let active = true;
    fetch(`/api/activities?phone=${encodeURIComponent(selectedPhone)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load lead history.");
        if (active) setActivities(result.activities);
      })
      .catch((loadError: unknown) => {
        if (active) {
          toast.error(loadError instanceof Error ? loadError.message : "Could not load lead history.");
        }
      });
    return () => {
      active = false;
    };
  }, [selectedPhone]);

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesQuery =
          !query ||
          lead.name.toLowerCase().includes(query.toLowerCase()) ||
          lead.phone.includes(query);
        return matchesQuery && (statusFilter === "all" || lead.status === statusFilter);
      }),
    [leads, query, statusFilter]
  );
  const selectedLead = leads.find((lead) => lead.phone === selectedPhone) || null;

  function updateDraft<K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function addLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add lead.");
      toast.success(`Added ${result.lead.name}.`);
      setDraft(emptyDraft);
      setShowForm(false);
      await load();
      setSelectedPhone(result.lead.phone);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not add lead.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: LeadStatus, outcome: DealOutcome | null = null) {
    if (!selectedLead) return;
    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(selectedLead.phone)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, closed_outcome: outcome }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update lead status.");
      toast.success("Lead status updated.");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not update lead status.");
    }
  }

  function beginProductEdit() {
    if (!selectedLead) return;
    setSelectedProductIds(
      (selectedLead.lead_products || [])
        .filter((item) => item.is_active !== false)
        .map((item) => item.product_id)
    );
    setEditingProducts(true);
  }

  async function saveLeadProducts() {
    if (!selectedLead) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(selectedLead.phone)}/products`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_ids: selectedProductIds }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update lead products.");
      setEditingProducts(false);
      toast.success("Lead products updated.");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not update lead products.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveLead() {
    if (!selectedLead || !confirm(`Archive ${selectedLead.name}? Its activity history will be kept.`)) return;
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(selectedLead.phone)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not archive lead.");
      toast.success("Lead archived; history is preserved.");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not archive lead.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People and businesses, uniquely identified by phone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button onClick={() => setShowForm((open) => !open)}>
            {showForm ? "Close" : "+ Add lead"}
          </Button>
        </div>
      </header>

      <ImportLeadsDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />

      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={addLead} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-lead-name">Name / business</Label>
                <Input id="new-lead-name" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-lead-phone">Phone (unique)</Label>
                <Input id="new-lead-phone" type="tel" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-lead-category">Category</Label>
                <Input id="new-lead-category" value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-lead-address">Address</Label>
                <Input id="new-lead-address" value={draft.address} onChange={(event) => updateDraft("address", event.target.value)} />
              </div>
              {products.filter((product) => product.is_active).length > 0 && (
                <fieldset className="space-y-2 sm:col-span-2">
                  <legend className="text-sm font-medium">Products of interest</legend>
                  <div className="flex flex-wrap gap-4">
                    {products.filter((product) => product.is_active).map((product) => (
                      <label key={product.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.product_ids.includes(product.id)}
                          onChange={(event) =>
                            updateDraft(
                              "product_ids",
                              event.target.checked
                                ? [...draft.product_ids, product.id]
                                : draft.product_ids.filter((id) => id !== product.id)
                            )
                          }
                        />
                        {product.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-lead-notes">Notes</Label>
                <Textarea id="new-lead-notes" rows={2} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button disabled={saving}>{saving ? "Saving..." : "Save lead"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Search leads"
              placeholder="Search name or phone"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-40 flex-1"
            />
            <select
              aria-label="Filter by lead status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "all")}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading leads...</p>
          ) : filteredLeads.length === 0 ? (
            <Card><CardContent className="p-5 text-sm text-muted-foreground">No leads match this view.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredLeads.map((lead) => (
                <button
                  key={lead.phone}
                  type="button"
                  onClick={() => {
                    setEditingProducts(false);
                    setSelectedPhone(lead.phone);
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    lead.phone === selectedPhone ? "border-primary bg-accent/40" : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{lead.name}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {statusLabels[lead.status]}
                      {lead.closed_outcome ? ` · ${lead.closed_outcome === "won" ? "Won" : "Lost"}` : ""}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {lead.phone}{lead.category ? ` · ${lead.category}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          {selectedLead ? (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedLead.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedLead.phone}</p>
                  {selectedLead.category && <p className="text-sm">{selectedLead.category}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-status">Status</Label>
                  <select
                    id="lead-status"
                    value={selectedLead.status}
                    onChange={(event) => {
                      const value = event.target.value as LeadStatus;
                      if (value === "deal_closed") {
                        setClosingPhone(selectedLead.phone);
                        setCloseOutcome(selectedLead.closed_outcome || "");
                      } else {
                        setClosingPhone(null);
                        void changeStatus(value);
                      }
                    }}
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  {(selectedLead.status === "deal_closed" || closingPhone === selectedLead.phone) && (
                    <div className="space-y-2">
                      <select
                        aria-label="Deal outcome"
                        value={selectedLead.status === "deal_closed" ? selectedLead.closed_outcome || "" : closeOutcome}
                        onChange={(event) => {
                          const value = event.target.value as DealOutcome | "";
                          if (selectedLead.status === "deal_closed" && value) {
                            void changeStatus("deal_closed", value);
                          } else {
                            setCloseOutcome(value);
                          }
                        }}
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                      >
                        <option value="">Choose deal outcome</option>
                        <option value="won">Won</option>
                        <option value="lost">Not Interested / Lost</option>
                      </select>
                      {selectedLead.status !== "deal_closed" && (
                        <Button
                          size="sm"
                          disabled={!closeOutcome}
                          onClick={() => closeOutcome && void changeStatus("deal_closed", closeOutcome)}
                        >
                          Save closed outcome
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Products of interest</p>
                    {!editingProducts && (
                      <Button size="sm" variant="outline" onClick={beginProductEdit}>
                        Edit products
                      </Button>
                    )}
                  </div>
                  {!editingProducts ? (
                    <div className="flex flex-wrap gap-2">
                      {(selectedLead.lead_products || [])
                        .filter((item) => item.is_active !== false)
                        .map((item) => (
                          <span key={item.id} className="rounded-full bg-teal-soft px-2.5 py-1 text-xs text-teal">
                            {item.products?.name || "Product"}
                          </span>
                        ))}
                      {!(selectedLead.lead_products || []).some((item) => item.is_active !== false) && (
                        <p className="text-sm text-muted-foreground">No products assigned.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-md border border-border p-3">
                      <fieldset className="flex flex-wrap gap-3">
                        <legend className="sr-only">Select products of interest</legend>
                        {products
                          .filter((product) =>
                            product.is_active || selectedProductIds.includes(product.id)
                          )
                          .map((product) => (
                            <label key={product.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.includes(product.id)}
                                onChange={(event) =>
                                  setSelectedProductIds((current) =>
                                    event.target.checked
                                      ? [...current, product.id]
                                      : current.filter((id) => id !== product.id)
                                  )
                                }
                              />
                              {product.name}{!product.is_active ? " (archived)" : ""}
                            </label>
                          ))}
                      </fieldset>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={saving} onClick={() => void saveLeadProducts()}>
                          {saving ? "Saving..." : "Save products"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => setEditingProducts(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedLead.notes && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap text-sm">{selectedLead.notes}</p>
                  </div>
                )}
                <div className="border-t border-border pt-3">
                  <h3 className="mb-2 flex items-center gap-2 font-medium">
                    <ActivityIcon className="h-4 w-4" /> Timeline
                  </h3>
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity recorded.</p>
                  ) : (
                    <ol className="space-y-2">
                      {activities.map((activity) => (
                        <li key={activity.id} className="border-l-2 border-border pl-3">
                          <p className="text-sm font-medium">
                            {activity.type === "call" ? "Call" : activity.type === "whatsapp" ? "WhatsApp" : activity.type === "meeting" ? "Meeting" : activity.type === "deal" ? "Deal" : "Activity"}
                            {activity.outcome ? ` · ${activity.outcome.replaceAll("_", " ")}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.occurred_at).toLocaleString()}
                          </p>
                          {activity.note && <p className="mt-1 whitespace-pre-wrap text-sm">{activity.note}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => void archiveLead()}>
                  Archive lead (keep history)
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-5 text-sm text-muted-foreground">
              Select a lead to see its status and timeline.
            </CardContent></Card>
          )}
        </section>
      </div>
    </div>
  );
}
