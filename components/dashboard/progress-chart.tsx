"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};
const AXIS_STYLE = { fontSize: 11, fill: "var(--slate)" };

const RANGES = [7, 14, 30] as const;

type CallProgressPoint = {
  date: string;
  calls: number;
  target: number;
  percent: number;
};

function barColor(pct: number) {
  if (pct >= 100) return "var(--green)";
  if (pct >= 80) return "var(--amber)";
  return "var(--rust)";
}

export function ProgressChart({
  callProgress,
  initialTarget,
}: {
  callProgress: CallProgressPoint[];
  initialTarget: number;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(14);
  const [limit, setLimit] = useState(initialTarget);
  const [limitInput, setLimitInput] = useState(String(initialTarget));
  const [savingLimit, setSavingLimit] = useState(false);

  const data = useMemo(
    () =>
      callProgress.slice(-range).map((point) => {
        const date = new Date(`${point.date}T12:00:00`);
        const pct = limit > 0 ? Math.round((point.calls / limit) * 100) : 0;
        return {
          ...point,
          label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          pct,
          met: point.calls >= limit,
        };
      }),
    [callProgress, range, limit]
  );

  const todaysCalls = data[data.length - 1]?.calls ?? 0;
  const todaysPct = data[data.length - 1]?.pct ?? 0;
  const daysMet = data.filter((d) => d.met).length;

  async function saveLimit() {
    const n = Number(limitInput);
    if (!Number.isInteger(n) || n <= 0) {
      setLimitInput(String(limit));
      return;
    }
    setSavingLimit(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_call_target: n }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not save the daily call target.");
      setLimit(result.settings.daily_call_target);
      setLimitInput(String(result.settings.daily_call_target));
    } catch (error) {
      setLimitInput(String(limit));
      toast.error(error instanceof Error ? error.message : "Could not save the daily call target.");
    } finally {
      setSavingLimit(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              Today: {todaysCalls}/{limit} calls ({todaysPct}%) · {daysMet}/{range} days hit the
              target
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="daily-limit" className="text-xs text-muted-foreground">
                Daily call limit
              </label>
              <Input
                id="daily-limit"
                type="number"
                min={1}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                onBlur={saveLimit}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                className="h-7 w-16 px-2 text-xs"
                disabled={savingLimit}
              />
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
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
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
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: "var(--muted)" }}
              formatter={(value, _name, item) => [
                `${value} calls (${item.payload.pct}%)`,
                "Calls",
              ]}
            />
            <ReferenceLine
              y={limit}
              stroke="var(--ink)"
              strokeDasharray="4 4"
              label={{ value: `Target: ${limit}`, position: "right", fontSize: 11, fill: "var(--slate)" }}
            />
            <Bar dataKey="calls" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={barColor(d.pct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Green = hit the limit, amber = close (80%+), rust = fell short. Consistency past the limit is what counts — more is always better.
        </p>
      </CardContent>
    </Card>
  );
}
