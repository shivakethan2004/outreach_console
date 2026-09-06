import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Phone, MessageCircle, Handshake, Sparkles, Repeat, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "navy" | "teal" | "amber" | "green" | "rust";
}) {
  const toneClasses: Record<string, string> = {
    navy: "bg-navy/10 text-navy",
    teal: "bg-teal-soft text-teal",
    amber: "bg-amber-soft text-amber",
    green: "bg-green-soft text-green",
    rust: "bg-rust-soft text-rust",
  };
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div className={cn("rounded-md p-1.5", toneClasses[tone])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function TodayActivity({
  coldCallsToday,
  whatsappToday,
  meetingsBookedToday,
  newOutreachToday,
  followUpsToday,
  newLeadsToday,
}: {
  coldCallsToday: number;
  whatsappToday: number;
  meetingsBookedToday: number;
  newOutreachToday: number;
  followUpsToday: number;
  newLeadsToday: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's activity</CardTitle>
        <CardDescription>What actually happened today, logged as you go</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="Cold calls" value={coldCallsToday} icon={Phone} tone="amber" />
          <MiniStat label="WhatsApp sent" value={whatsappToday} icon={MessageCircle} tone="teal" />
          <MiniStat label="Meetings booked" value={meetingsBookedToday} icon={Handshake} tone="green" />
          <MiniStat label="New outreach" value={newOutreachToday} icon={Sparkles} tone="navy" />
          <MiniStat label="Follow-ups" value={followUpsToday} icon={Repeat} tone="amber" />
          <MiniStat label="New leads added" value={newLeadsToday} icon={UserPlus} tone="navy" />
        </div>
      </CardContent>
    </Card>
  );
}
