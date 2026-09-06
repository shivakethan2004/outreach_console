"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const AXIS_STYLE = { fontSize: 12, fill: "var(--slate)" };

export function CategoryBarChart({
  data,
}: {
  data: { category: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads by category</CardTitle>
        <CardDescription>Who's in the pipeline, grouped by business type</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS_STYLE} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="category"
              width={190}
              tick={AXIS_STYLE}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="count" fill="var(--navy)" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const INTEREST_COLORS: Record<string, string> = {
  Hot: "var(--rust)",
  Warm: "var(--amber)",
  Cold: "var(--navy)",
};

export function InterestPieChart({
  data,
}: {
  data: { level: string; count: number }[];
}) {
  const hasData = data.length > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Interest level</CardTitle>
        <CardDescription>Signal strength from calls so far</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="level"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.level}
                    fill={INTEREST_COLORS[entry.level] || "var(--slate)"}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                verticalAlign="bottom"
                height={28}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ color: "var(--ink)", fontSize: 12 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No interest-level data logged yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChannelFunnelChart({
  data,
}: {
  data: { channel: string; Contacted: number; "Not Contacted": number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel reach</CardTitle>
        <CardDescription>Contacted vs. not, per channel</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="channel" tick={AXIS_STYLE} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis allowDecimals={false} tick={AXIS_STYLE} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
            <Legend
              formatter={(value) => (
                <span style={{ color: "var(--ink)", fontSize: 12 }}>{value}</span>
              )}
            />
            <Bar dataKey="Contacted" stackId="a" fill="var(--teal)" radius={[0, 0, 0, 0]} barSize={48} />
            <Bar
              dataKey="Not Contacted"
              stackId="a"
              fill="var(--line)"
              radius={[4, 4, 0, 0]}
              barSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ColdCallOutcomeChart({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cold call outcomes</CardTitle>
        <CardDescription>What's actually happening on the calls</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS_STYLE} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="status"
                width={220}
                tick={{ fontSize: 11, fill: "var(--slate)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="count" fill="var(--amber)" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No calls logged yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
