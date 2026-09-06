"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChangeEntry, parseSnapshot } from "@/lib/changelog-types";
import { CHANGE_TYPE_LABEL, CHANGE_TYPE_TONE } from "@/lib/changelog-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Undo2 } from "lucide-react";

function diffSummary(entry: ChangeEntry): string | null {
  if (entry.action !== "update") return null;
  const before = parseSnapshot(entry.before);
  const after = parseSnapshot(entry.after);
  if (!before || !after) return null;
  const changed: string[] = [];
  for (const key of Object.keys(after) as (keyof typeof after)[]) {
    if (key === "contact_id") continue;
    if (before[key] !== after[key]) {
      const from = before[key] || "—";
      const to = after[key] || "—";
      changed.push(`${key}: "${from}" → "${to}"`);
    }
  }
  return changed.length ? changed.slice(0, 3).join("  ·  ") : null;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityList({ initialEntries }: { initialEntries: ChangeEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  async function handleUndo(entry: ChangeEntry) {
    if (
      !confirm(
        `Undo "${CHANGE_TYPE_LABEL[entry.change_type]}" for ${entry.contact_name}? This will be logged as a new change.`
      )
    )
      return;
    setUndoingId(entry.id);
    try {
      const res = await fetch(`/api/changelog/${entry.id}/undo`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Undo failed");
      }
      toast.success(`Undid change for ${entry.contact_name}`);
      const refreshed = await fetch("/api/changelog?limit=200").then((r) => r.json());
      setEntries(refreshed.entries);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setUndoingId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No activity yet. Every edit, call log, WhatsApp touch, meeting booked, and
          import will show up here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => {
        const summary = diffSummary(entry);
        const isUndo = entry.change_type === "undo";
        return (
          <Card key={entry.id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={CHANGE_TYPE_TONE[entry.change_type]}>
                    {CHANGE_TYPE_LABEL[entry.change_type]}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {entry.contact_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                {summary && (
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {summary}
                  </p>
                )}
              </div>
              {!isUndo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUndo(entry)}
                  disabled={undoingId === entry.id}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  {undoingId === entry.id ? "Undoing…" : "Undo"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
