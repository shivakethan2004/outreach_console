"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Contact } from "@/lib/types";
import {
  generateSlots,
  scheduledMeetings,
  unscheduledMeetings,
  todayDateIso,
  addDays,
  formatDateHeading,
} from "@/lib/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { BookSlotDialog } from "./book-slot-dialog";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CalendarView({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [selectedDate, setSelectedDate] = useState(todayDateIso());
  const [bookingSlot, setBookingSlot] = useState<{ time: string; label: string } | null>(
    null
  );

  const slots = useMemo(() => generateSlots(), []);
  const scheduled = useMemo(
    () => scheduledMeetings(contacts, selectedDate),
    [contacts, selectedDate]
  );
  const unscheduled = useMemo(
    () => unscheduledMeetings(contacts, selectedDate),
    [contacts, selectedDate]
  );

  const scheduledByTime = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of scheduled) map.set(c.meeting_time, c);
    return map;
  }, [scheduled]);

  const bookedCount = scheduled.length + unscheduled.length;
  const isToday = selectedDate === todayDateIso();

  async function patchContact(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to save");
    const data = await res.json();
    setContacts((prev) => prev.map((c) => (c.contact_id === id ? data.contact : c)));
    return data.contact as Contact;
  }

  async function handleBook(contact: Contact) {
    if (!bookingSlot) return;
    try {
      await patchContact(contact.contact_id, {
        is_meeting_milestone: "Yes",
        meeting_date: selectedDate,
        meeting_time: bookingSlot.time,
        notes: [
          contact.notes,
          `[${selectedDate}] Meeting: booked for ${bookingSlot.label}`,
        ]
          .filter(Boolean)
          .join("\n"),
        _changeType: "meeting_booked",
      });
      toast.success(`🟢 Booked ${contact.name} at ${bookingSlot.label}`);
      setBookingSlot(null);
    } catch {
      toast.error("Couldn't book that slot");
    }
  }

  async function handleCancel(contact: Contact) {
    if (!confirm(`Cancel the meeting with ${contact.name}?`)) return;
    try {
      await patchContact(contact.contact_id, {
        is_meeting_milestone: "No",
        meeting_time: "",
        _changeType: "field_edit",
      });
      toast.success(`Cancelled meeting with ${contact.name}`);
    } catch {
      toast.error("Couldn't cancel that meeting");
    }
  }

  async function handleAssignTime(contact: Contact, time: string) {
    const slot = slots.find((s) => s.time === time);
    try {
      await patchContact(contact.contact_id, {
        meeting_time: time,
        _changeType: "field_edit",
      });
      toast.success(`Set ${contact.name} to ${slot?.label ?? time}`);
    } catch {
      toast.error("Couldn't set the time");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {bookedCount} meeting{bookedCount === 1 ? "" : "s"} on this day
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) => addDays(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={isToday ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDate(todayDateIso())}
          >
            Today
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm"
          />
          <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium text-foreground">{formatDateHeading(selectedDate)}</p>

      {unscheduled.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Booked this day, no time set yet
            </p>
            <ul className="flex flex-col gap-2">
              {unscheduled.map((c) => (
                <li
                  key={c.contact_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-amber-soft/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.category || "—"} · {c.phone}
                    </p>
                  </div>
                  <Select onValueChange={(v) => handleAssignTime(c, v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Set time slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {slots.map((s) => (
                        <SelectItem key={s.time} value={s.time}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => {
          const booked = scheduledByTime.get(slot.time);
          return (
            <div
              key={slot.time}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border p-3",
                booked
                  ? "border-green/30 bg-green-soft/50"
                  : "border-border bg-card hover:border-navy/30"
              )}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{slot.label}</p>
                {booked ? (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">
                      {booked.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {booked.category || "—"} · {booked.phone}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Open</p>
                )}
              </div>
              {booked ? (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Cancel meeting"
                  onClick={() => handleCancel(booked)}
                >
                  <X className="h-3.5 w-3.5 text-rust" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Book this slot"
                  onClick={() => setBookingSlot(slot)}
                >
                  <Plus className="h-3.5 w-3.5 text-green" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <BookSlotDialog
        open={!!bookingSlot}
        onOpenChange={(open) => !open && setBookingSlot(null)}
        dateLabel={formatDateHeading(selectedDate)}
        slotLabel={bookingSlot?.label ?? ""}
        contacts={contacts}
        onBook={handleBook}
      />
    </div>
  );
}
