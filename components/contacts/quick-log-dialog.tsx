"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Contact } from "@/lib/types";
import { todayIso, nowIso } from "@/lib/format";
import { isContacted } from "@/lib/insights";
import { generateSlots } from "@/lib/calendar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export type QuickLogMode = "call" | "whatsapp" | "meeting";

const COLD_CALL_SUGGESTIONS = [
  "Contacted",
  "No Answer",
  "Gatekeeper - owner not present",
  "Interested - requested info",
  "Owner-declined",
  "Not Interested",
];

const COPY: Record<QuickLogMode, { title: string; label: string }> = {
  call: { title: "Log a cold call", label: "Call" },
  whatsapp: { title: "Log a WhatsApp touch", label: "WhatsApp" },
  meeting: { title: "Book a meeting 🟢", label: "Meeting" },
};

export function QuickLogDialog({
  open,
  onOpenChange,
  contact,
  mode,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  mode: QuickLogMode;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [date, setDate] = useState(todayIso());
  const [meetingTime, setMeetingTime] = useState("09:00");
  const [outcome, setOutcome] = useState("Contacted");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayIso());
      setMeetingTime(contact?.meeting_time || "09:00");
      setOutcome(
        mode === "call" ? contact?.cold_call_status || "Contacted" : "Contacted"
      );
      setNote("");
    }
  }, [open, mode, contact]);

  if (!contact) return null;
  const copy = COPY[mode];

  async function handleSave() {
    setSaving(true);
    const timestamp = date === todayIso() ? nowIso() : `${date}T09:00:00`;
    const noteEntry = note.trim()
      ? `[${date}] ${copy.label}: ${note.trim()}`
      : "";
    const newNotes = contact
      ? [contact.notes, noteEntry].filter(Boolean).join("\n")
      : noteEntry;

    try {
      if (mode === "call") {
        const wasContacted = isContacted(contact!.cold_call_status);
        await onSave({
          cold_call_status: outcome,
          cold_call_last_contacted_at: date,
          notes: newNotes,
          _changeType: "cold_call_logged",
          _isFirstTouch: !wasContacted,
        });
      } else if (mode === "whatsapp") {
        const wasContacted = isContacted(contact!.whatsapp_status);
        const patch: Record<string, unknown> = {
          whatsapp_status: "Contacted",
          notes: newNotes,
          _changeType: "whatsapp_logged",
          _isFirstTouch: !wasContacted,
        };
        if (!contact!.whatsapp_initial_contacted_at) {
          patch.whatsapp_initial_contacted_at = timestamp;
        } else {
          patch.whatsapp_followup_contacted_at = timestamp;
        }
        await onSave(patch);
      } else {
        await onSave({
          is_meeting_milestone: "Yes",
          meeting_date: date,
          meeting_time: meetingTime,
          notes: newNotes,
          _changeType: "meeting_booked",
        });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{contact.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ql-date">
              {mode === "meeting" ? "Meeting date" : "Date"}
            </Label>
            <Input
              id="ql-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {mode === "call" && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-outcome">Outcome</Label>
              <Input
                id="ql-outcome"
                list="ql-outcome-suggestions"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
              <datalist id="ql-outcome-suggestions">
                {COLD_CALL_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          )}

          {mode === "meeting" && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-time">Time slot</Label>
              <Select value={meetingTime} onValueChange={setMeetingTime}>
                <SelectTrigger id="ql-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateSlots().map((s) => (
                    <SelectItem key={s.time} value={s.time}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ql-note">
              Note {mode === "meeting" ? "" : "(optional)"}
            </Label>
            <Textarea
              id="ql-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "meeting"
                  ? "e.g. Demo call booked for Tuesday 4pm, wants to see pricing"
                  : "What happened, what's next…"
              }
            />
            <p className="text-xs text-muted-foreground">
              Gets appended to this lead's notes with today's date — existing notes are kept.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : mode === "meeting" ? "Book meeting" : "Log it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
