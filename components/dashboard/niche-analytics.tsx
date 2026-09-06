import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NicheAnalytics, NicheVerdict } from "@/lib/insights";
import { Phone, MessageCircle, Handshake, Trophy } from "lucide-react";

const VERDICT_COPY: Record<
  NicheVerdict,
  { label: string; variant: "muted" | "green" | "amber" | "rust" }
> = {
  not_enough_data: { label: "Not enough data yet", variant: "muted" },
  working: { label: "Working — keep going", variant: "green" },
  promising: { label: "Promising — meetings, no deals yet", variant: "amber" },
  not_working: { label: "Not working — reconsider this niche", variant: "rust" },
};

function MiniMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function NicheAnalyticsSection({ niches }: { niches: NicheAnalytics[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytical growth</CardTitle>
        <CardDescription>
          Per niche: calls made, WhatsApp outreach sent, meetings booked. A niche needs at
          least 100 calls before it counts — then 5+ meetings and 1+ deal closed says it&apos;s
          working.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {niches.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No categories yet — add some leads to start tracking.
          </p>
        )}
        {niches.map((n) => {
          const verdict = VERDICT_COPY[n.verdict];
          const callProgress = Math.min(100, Math.round((n.totalCalls / 100) * 100));
          return (
            <div
              key={n.category}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{n.category}</p>
                <Badge variant={verdict.variant}>{verdict.label}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-5">
                <MiniMetric icon={Phone} value={n.totalCalls} label="calls" />
                <MiniMetric icon={MessageCircle} value={n.whatsappOutreach} label="WhatsApp" />
                <MiniMetric icon={Handshake} value={n.meetingsBooked} label="meetings" />
                <MiniMetric icon={Trophy} value={n.dealsClosed} label="deals closed" />
              </div>

              {n.verdict === "not_enough_data" && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-navy"
                      style={{ width: `${callProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.totalCalls}/100 calls minimum to judge this niche
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
