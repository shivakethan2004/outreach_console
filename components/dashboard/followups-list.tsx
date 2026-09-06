import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Contact } from "@/lib/types";
import { ArrowUpRight } from "lucide-react";

export function FollowUpsList({ contacts }: { contacts: Contact[] }) {
  const items = contacts.slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Needs follow-up</CardTitle>
            <CardDescription>
              {contacts.length} lead{contacts.length === 1 ? "" : "s"} waiting on the next touch
            </CardDescription>
          </div>
          <Link
            href="/contacts"
            className="flex items-center gap-1 text-xs font-medium text-teal hover:underline"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing needs follow-up right now.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.contact_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.category || "—"} · {c.phone}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {c.next_follow_up_date && (
                    <Badge variant="amber">{c.next_follow_up_date}</Badge>
                  )}
                  {!c.next_follow_up_date && (
                    <Badge variant="muted">flagged in notes</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
