"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Contact,
  emptyContact,
  WHATSAPP_STATUSES,
  COLD_CALL_STATUSES,
  CURRENT_STATUSES,
} from "@/lib/types";
import {
  ContactProductStatus,
  Product,
  PRODUCT_INTEREST_STATUSES,
} from "@/lib/products";

const INTEREST_OPTIONS = ["", "Cold", "Warm", "Hot"];

const emptyProductStatus = (
  contactId: string,
  productId: string
): ContactProductStatus => ({
  relationship_id: `${contactId}-${productId}`,
  contact_id: contactId,
  product_id: productId,
  interest_status: "Follow-up Needed",
  email: "",
  notes: "",
  meeting_status: "",
  follow_up_date: "",
  meeting_date: "",
  meeting_time: "",
  created_at: "",
  updated_at: "",
});

export function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSave: (contact: Contact) => Promise<Contact | void>;
}) {
  const [form, setForm] = useState<Contact>(emptyContact(""));
  const [products, setProducts] = useState<Product[]>([]);
  const [productStatuses, setProductStatuses] = useState<Record<string, ContactProductStatus>>({});
  const [saving, setSaving] = useState(false);
  const isNew = !contact;

  useEffect(() => {
    setForm(contact ?? emptyContact(""));
  }, [contact, open]);

  useEffect(() => {
    if (!open) return;
    async function loadProducts() {
      const res = await fetch("/api/products");
      const data = await res.json();
      const productList = (data.products || []) as Product[];
      setProducts(productList);
      if (!contact || !contact.contact_id) {
        setProductStatuses({});
        return;
      }

      const statusRes = await fetch(
        `/api/contact-product-statuses?contact_id=${encodeURIComponent(contact.contact_id)}`
      );
      const statusData = await statusRes.json();
      const existing = (statusData.statuses || []) as ContactProductStatus[];
      const map: Record<string, ContactProductStatus> = {};
      for (const item of existing) map[item.product_id] = item;
      for (const product of productList) {
        map[product.product_id] ??= emptyProductStatus(contact.contact_id, product.product_id);
      }
      setProductStatuses(map);
    }
    loadProducts();
  }, [contact, open]);

  function update<K extends keyof Contact>(key: K, value: Contact[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateProductStatus(productId: string, patch: Partial<ContactProductStatus>) {
    setProductStatuses((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? emptyProductStatus(contact?.contact_id || "", productId)),
        ...patch,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await onSave(form);
      const savedContactId = saved && "contact_id" in saved ? saved.contact_id : contact?.contact_id;
      if (savedContactId) {
        await Promise.all(
          Object.values(productStatuses)
            .filter((status) => status.product_id)
            .map((status) =>
              fetch("/api/contact-product-statuses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...status,
                  contact_id: savedContactId,
                  relationship_id: `${savedContactId}-${status.product_id}`,
                }),
              })
            )
        );
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add lead" : `Edit ${contact?.name || "lead"}`}</DialogTitle>
          <DialogDescription>
            Changes are written straight to outreach_master_tracker.csv.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="name">Business / contact name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Sunrise Dental Clinic"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Dental Clinic"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+91XXXXXXXXXX"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rating">Rating</Label>
            <Input
              id="rating"
              value={form.rating}
              onChange={(e) => update("rating", e.target.value)}
              placeholder="4.8"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reviews">Reviews</Label>
            <Input
              id="reviews"
              value={form.reviews}
              onChange={(e) => update("reviews", e.target.value)}
              placeholder="120"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cold_call_status">Cold call status</Label>
            <Select
              value={form.cold_call_status || "Not Contacted"}
              onValueChange={(v) => update("cold_call_status", v)}
            >
              <SelectTrigger id="cold_call_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLD_CALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cold_call_last_contacted_at">Cold call last contacted</Label>
            <Input
              id="cold_call_last_contacted_at"
              type="date"
              value={form.cold_call_last_contacted_at}
              onChange={(e) => update("cold_call_last_contacted_at", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current_status">Current status</Label>
            <Select
              value={form.current_status || "Can Call Again"}
              onValueChange={(v) => update("current_status", v)}
            >
              <SelectTrigger id="current_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              What to do about this lead next — filterable, drives the dashboard.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whatsapp_status">WhatsApp status</Label>
            <Select
              value={form.whatsapp_status || "Not Contacted"}
              onValueChange={(v) => update("whatsapp_status", v)}
            >
              <SelectTrigger id="whatsapp_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WHATSAPP_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="interest_level">Interest level</Label>
            <Select
              value={form.interest_level || "__none"}
              onValueChange={(v) => update("interest_level", v === "__none" ? "" : v)}
            >
              <SelectTrigger id="interest_level">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {INTEREST_OPTIONS.map((s) => (
                  <SelectItem key={s || "__none"} value={s || "__none"}>
                    {s || "Not set"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whatsapp_initial_contacted_at">WhatsApp initial contact</Label>
            <Input
              id="whatsapp_initial_contacted_at"
              value={form.whatsapp_initial_contacted_at}
              onChange={(e) => update("whatsapp_initial_contacted_at", e.target.value)}
              placeholder="2026-07-27T10:24:29"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whatsapp_followup_contacted_at">WhatsApp follow-up contact</Label>
            <Input
              id="whatsapp_followup_contacted_at"
              value={form.whatsapp_followup_contacted_at}
              onChange={(e) => update("whatsapp_followup_contacted_at", e.target.value)}
              placeholder="2026-08-02T09:00:00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="is_meeting_milestone">Meeting scheduled?</Label>
            <Select
              value={form.is_meeting_milestone || "No"}
              onValueChange={(v) => update("is_meeting_milestone", v)}
            >
              <SelectTrigger id="is_meeting_milestone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="No">No</SelectItem>
                <SelectItem value="Yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meeting_date">Meeting date</Label>
            <Input
              id="meeting_date"
              type="date"
              value={form.meeting_date}
              onChange={(e) => update("meeting_date", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meeting_time">Meeting time</Label>
            <Input
              id="meeting_time"
              type="time"
              step={1800}
              value={form.meeting_time}
              onChange={(e) => update("meeting_time", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="next_follow_up_date">Next follow-up date</Label>
            <Input
              id="next_follow_up_date"
              type="date"
              value={form.next_follow_up_date}
              onChange={(e) => update("next_follow_up_date", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="What happened on the last touch, what's next..."
            />
          </div>

          {!isNew && products.length > 0 && (
            <div className="sm:col-span-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-sm font-medium">Product / SaaS validation</div>
              <div className="space-y-3">
                {products.map((product) => {
                  const status = productStatuses[product.product_id] ?? emptyProductStatus(contact?.contact_id || "", product.product_id);
                  return (
                    <div key={product.product_id} className="rounded-md border border-border bg-background p-3">
                      <div className="mb-2 text-sm font-medium">{product.name}</div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Interest status</Label>
                          <Select
                            value={status.interest_status || "Follow-up Needed"}
                            onValueChange={(value) =>
                              updateProductStatus(product.product_id, { interest_status: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRODUCT_INTEREST_STATUSES.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input
                            value={status.email}
                            onChange={(e) =>
                              updateProductStatus(product.product_id, { email: e.target.value })
                            }
                            placeholder="name@example.com"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Follow-up date</Label>
                          <Input
                            type="date"
                            value={status.follow_up_date}
                            onChange={(e) =>
                              updateProductStatus(product.product_id, { follow_up_date: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Meeting status</Label>
                          <Input
                            value={status.meeting_status}
                            onChange={(e) =>
                              updateProductStatus(product.product_id, { meeting_status: e.target.value })
                            }
                            placeholder="Demo scheduled"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Notes</Label>
                          <Textarea
                            rows={2}
                            value={status.notes}
                            onChange={(e) =>
                              updateProductStatus(product.product_id, { notes: e.target.value })
                            }
                            placeholder="What they said about this product..."
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : isNew ? "Add lead" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
