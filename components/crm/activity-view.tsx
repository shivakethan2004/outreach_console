"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Activity } from "@/lib/crm-types";
import { LeadTimelineDialog } from "@/components/crm/lead-timeline-dialog";

type ActivityItem = Activity & {
  leads?: { phone: string; name: string } | null;
};

const activityLabels: Record<Activity["type"], string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
  deal: "Deal",
  note: "Note",
  task: "Task",
  legacy: "Imported history",
};

export function ActivityView() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [timelinePhone, setTimelinePhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/activities")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load activity history.");
        if (active) setActivities(result.activities);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load activity history.");
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
        <h1 className="text-2xl font-semibold tracking-tight">Activity history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An append-only record of calls and CRM events. Historical entries are never undone or overwritten.
        </p>
      </header>
      {error && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{error}</p>}
      <LeadTimelineDialog phone={timelinePhone} onOpenChange={setTimelinePhone} />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading activity...</p>
          ) : activities.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No activity has been recorded yet.</p>
          ) : (
            activities.map((activity) => (
              <article key={activity.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-medium">
                    {activityLabels[activity.type]}
                    {activity.outcome ? ` · ${activity.outcome.replaceAll("_", " ")}` : ""}
                    {activity.leads?.name && (
                      <>
                        {" — "}
                        <button
                          type="button"
                          onClick={() =>
                            activity.leads?.phone && setTimelinePhone(activity.leads.phone)
                          }
                          className="text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`View notes and timeline for ${activity.leads.name}`}
                        >
                          {activity.leads.name}
                        </button>
                      </>
                    )}
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {activity.occurred_at.replace("T", " ")}
                  </time>
                </div>
                {activity.leads?.phone && (
                  <p className="text-xs text-muted-foreground">{activity.leads.phone}</p>
                )}
                {activity.note && <p className="whitespace-pre-wrap text-sm">{activity.note}</p>}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
