"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChangeEntry } from "@/lib/changelog-types";
import { dailyActivitySeries } from "@/lib/insights";
import { cn } from "@/lib/utils";

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};
const AXIS_STYLE = { fontSize: 11, fill: "var(--slate)" };

const RANGES = [7, 14, 30] as const;

export function ActivityTrendChart({ changelog }: { changelog: ChangeEntry[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(14);
  const data = useMemo(() => dailyActivitySeries(changelog, range), [changelog, range]);
  const hasActivity = data.some(
    (d) => d.calls || d.whatsapp || d.meetings || d.newLeads
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity over time</CardTitle>
            <CardDescription>
              Calls, WhatsApp touches, and meetings booked, per day
            </CardDescription>
          </div>
          <div className="flex gap-1 rounded-md bg-secondary p-1">
            {RANGES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 px-2.5 text-xs",
                  range === r && "bg-card shadow-sm text-foreground"
                )}
                onClick={() => setRange(r)}
              >
                {r}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasActivity ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_STYLE}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                interval={range > 14 ? Math.ceil(range / 10) : 0}
              />
              <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "var(--ink)", fontSize: 12 }}>{value}</span>
                )}
              />
              <Bar dataKey="calls" name="Cold calls" fill="var(--amber)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="whatsapp" name="WhatsApp" fill="var(--teal)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="meetings" name="Meetings booked" fill="var(--green)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="newLeads" name="New leads" fill="var(--navy)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No logged activity in the last {range} days yet — use the quick-log icons on the Contacts page.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
