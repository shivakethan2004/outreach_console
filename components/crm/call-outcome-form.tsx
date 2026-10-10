"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Lead, Product } from "@/lib/crm-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CallOutcome = "no_answer" | "not_interested" | "follow_up" | "meeting";

export function CallOutcomeForm({
  lead,
  products,
  onDone,
  onCancel,
}: {
  lead: Pick<Lead, "phone" | "name">;
  products: Product[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcome>("no_answer");
  const [followUpType, setFollowUpType] = useState<"call" | "whatsapp" | "meeting">("call");
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingMode, setMeetingMode] = useState<"online" | "offline">("online");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: lead.phone,
          outcome,
          note,
          follow_up_type:
            outcome === "meeting"
              ? "meeting"
              : outcome === "follow_up"
                ? followUpType
                : null,
          scheduled_at:
            outcome === "meeting" || (outcome === "follow_up" && followUpType === "meeting")
              ? scheduledAt
              : scheduledAt || null,
          meeting_mode: meetingMode,
          product_id: productId,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not record this call.");
      toast.success("Call attempt recorded.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record this call.");
    } finally {
      setSaving(false);
    }
  }

  const meetingDetails =
    outcome === "meeting" || (outcome === "follow_up" && followUpType === "meeting");

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold">Log call with {lead.name}</h3>
        <p className="text-xs text-muted-foreground">{lead.phone}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="call-outcome">Outcome</Label>
        <select
          id="call-outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as CallOutcome)}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="no_answer">No Answer</option>
          <option value="not_interested">Not Interested</option>
          <option value="follow_up">Follow-up</option>
          <option value="meeting">Meeting</option>
        </select>
      </div>

      {outcome === "follow_up" && (
        <div className="space-y-1.5">
          <Label htmlFor="follow-up-type">Follow-up type</Label>
          <select
            id="follow-up-type"
            value={followUpType}
            onChange={(event) =>
              setFollowUpType(event.target.value as "call" | "whatsapp" | "meeting")
            }
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="call">Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="meeting">Meeting</option>
          </select>
        </div>
      )}

      {(outcome === "follow_up" || meetingDetails) && (
        <div className="space-y-1.5">
          <Label htmlFor="call-schedule">
            {meetingDetails ? "Meeting date and time" : "Schedule (optional)"}
          </Label>
          <Input
            id="call-schedule"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            required={meetingDetails}
          />
        </div>
      )}

      {meetingDetails && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="meeting-mode">Meeting mode</Label>
            <select
              id="meeting-mode"
              value={meetingMode}
              onChange={(event) => setMeetingMode(event.target.value as "online" | "offline")}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meeting-product">Product discussed</Label>
            <select
              id="meeting-product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {products.filter((product) => product.is_active).map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {(outcome === "follow_up" || meetingDetails) && (
        <div className="space-y-1.5">
          <Label htmlFor="call-note">{meetingDetails ? "Meeting note" : "Follow-up note"}</Label>
          <Textarea
            id="call-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Follow up about website pricing."
            required
            rows={2}
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || (meetingDetails && products.length === 0)}>
          {saving ? "Saving..." : "Save call"}
        </Button>
      </div>
    </form>
  );
}
