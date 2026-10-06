"use client";

import { useEffect, useState } from "react";
import { Activity, Lead, LeadStatus } from "@/lib/crm-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LeadTimeline = Activity & {
  leads?: { phone: string; name: string } | null;
};

const statusLabels: Record<LeadStatus, string> = {
  not_contacted: "Not Contacted",
  in_progress: "In Progress",
  no_answer: "No Answer",
  deal_closed: "Deal Closed",
};

const activityLabels: Record<Activity["type"], string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
  deal: "Deal",
  note: "Note",
  task: "Task",
  legacy: "Activity",
};

export function LeadTimelineDialog({
  phone,
  onOpenChange,
}: {
  phone: string | null;
  onOpenChange: (phone: string | null) => void;
}) {
  const [timeline, setTimeline] = useState<{
    phone: string;
    lead: Lead;
    activities: LeadTimeline[];
  } | null>(null);
  const [loadError, setLoadError] = useState<{ phone: string; message: string } | null>(null);

  useEffect(() => {
    if (!phone) return;

    let active = true;
    Promise.all([
      fetch(`/api/leads/${encodeURIComponent(phone)}`),
      fetch(`/api/activities?phone=${encodeURIComponent(phone)}`),
    ])
      .then(async ([leadResponse, activityResponse]) => {
        const [leadData, activityData] = await Promise.all([
          leadResponse.json(),
          activityResponse.json(),
        ]);
        if (!leadResponse.ok) throw new Error(leadData.error || "Could not load this lead.");
        if (!activityResponse.ok) {
          throw new Error(activityData.error || "Could not load lead activity.");
        }
        if (!active) return;
        setTimeline({
          phone,
          lead: leadData.lead,
          activities: activityData.activities,
        });
        setLoadError(null);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setLoadError({
            phone,
            message: loadError instanceof Error ? loadError.message : "Could not load lead timeline.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [phone]);

  const currentTimeline = timeline?.phone === phone ? timeline : null;
  const currentError = loadError?.phone === phone ? loadError.message : "";
  const loading = phone !== null && !currentTimeline && !currentError;
  const lead = currentTimeline?.lead;
  const activities = currentTimeline?.activities || [];

  return (
    <Dialog open={phone !== null} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lead?.name || "Lead timeline"}</DialogTitle>
          <DialogDescription>
            {lead
              ? `${lead.phone}${lead.category ? ` · ${lead.category}` : ""} · ${statusLabels[lead.status]}`
              : "Notes and activity history for this lead."}
          </DialogDescription>
        </DialogHeader>
        {currentError && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{currentError}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading lead timeline...</p>
        ) : lead ? (
          <div className="space-y-4">
            {lead.notes && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Lead notes</h3>
                <p className="whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm">{lead.notes}</p>
              </section>
            )}
            {lead.lead_products && lead.lead_products.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Products</h3>
                <p className="text-sm text-muted-foreground">
                  {lead.lead_products
                    .filter((item) => item.is_active !== false)
                    .map((item) => item.products?.name || "Product")
                    .join(", ")}
                </p>
              </section>
            )}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Timeline</h3>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                  {activities.map((activity) => (
                    <li key={activity.id} className="border-l-2 border-border pl-3">
                      <p className="text-sm font-medium">
                        {activityLabels[activity.type]}
                        {activity.outcome ? ` · ${activity.outcome.replaceAll("_", " ")}` : ""}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {new Date(activity.occurred_at).toLocaleString()}
                      </time>
                      {activity.note && (
                        <p className="mt-1 whitespace-pre-wrap text-sm">{activity.note}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
