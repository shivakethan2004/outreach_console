"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Contact } from "@/lib/types";
import { Search } from "lucide-react";

export function BookSlotDialog({
  open,
  onOpenChange,
  dateLabel,
  slotLabel,
  contacts,
  onBook,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateLabel: string;
  slotLabel: string;
  contacts: Contact[];
  onBook: (contact: Contact) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? contacts.filter(
          (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
        )
      : contacts;
    return list.slice(0, 30);
  }, [contacts, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book this slot 🟢</DialogTitle>
          <DialogDescription>
            {dateLabel} at {slotLabel} — pick a lead
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No leads match "{search}"
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => (
                <li key={c.contact_id}>
                  <button
                    type="button"
                    onClick={() => onBook(c)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.category || "—"} · {c.phone}
                      </p>
                    </div>
                    {c.is_meeting_milestone?.toLowerCase() === "yes" && (
                      <Badge variant="green" className="shrink-0">
                        already booked
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
