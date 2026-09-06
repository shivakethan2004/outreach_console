import { Card, CardContent } from "@/components/ui/card";
import { Phone, MessageCircle, Handshake, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone: "navy" | "teal" | "amber" | "rust" | "green";
}) {
  const toneClasses: Record<string, string> = {
    navy: "bg-navy/10 text-navy",
    teal: "bg-teal-soft text-teal",
    amber: "bg-amber-soft text-amber",
    rust: "bg-rust-soft text-rust",
    green: "bg-green-soft text-green",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
              {value}
            </p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn("rounded-md p-2", toneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCards({
  total,
  coldCallContacted,
  whatsappContacted,
  meetings,
  conversionRate,
}: {
  total: number;
  coldCallContacted: number;
  whatsappContacted: number;
  meetings: number;
  conversionRate: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total leads"
        value={total}
        sub="in the tracker"
        icon={Users}
        tone="navy"
      />
      <StatCard
        label="Cold-called"
        value={coldCallContacted}
        sub={`${total ? Math.round((coldCallContacted / total) * 100) : 0}% of all leads`}
        icon={Phone}
        tone="amber"
      />
      <StatCard
        label="WhatsApp reached"
        value={whatsappContacted}
        sub={`${total ? Math.round((whatsappContacted / total) * 100) : 0}% of all leads`}
        icon={MessageCircle}
        tone="teal"
      />
      <StatCard
        label="Meetings set"
        value={meetings}
        sub={`${conversionRate.toFixed(1)}% of contacted leads`}
        icon={Handshake}
        tone="green"
      />
    </div>
  );
}
