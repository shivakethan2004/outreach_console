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
import { Contact, deriveCurrentStatus } from "@/lib/types";
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

export type QuickLogMode = "call" | "whatsapp" | "meeting" | "outcome";

const CALL_OUTCOMES = [
  "No Answer",
  "Follow-up Call Needed",
  "Meeting Booked",
  "Follow-up Through WhatsApp",
  "Not Interested",
];

const WHATSAPP_OUTCOMES = [
  { value: "WhatsApp - Ghosted", label: "Ghosted — no response" },
  { value: "WhatsApp - Responded", label: "Responded" },
  { value: "WhatsApp - Meeting Arranged", label: "Meeting arranged" },
];

const MEETING_OUTCOMES = [
  { value: "Rescheduled", label: "Rescheduled" },
  { value: "Deal Closed", label: "Deal closed 🎉" },
  { value: "Follow-up Needed", label: "Follow-up needed" },
  { value: "Not Interested", label: "Not interested — dead end" },
];

const COPY: Record<QuickLogMode, { title: string; label: string }> = {
  call: { title: "Log a cold call", label: "Call" },
  whatsapp: { title: "Log a WhatsApp touch", label: "WhatsApp" },
  meeting: { title: "Book a meeting 🟢", label: "Meeting" },
  outcome: { title: "Log meeting outcome", label: "Outcome" },
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
  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0]);
  const [whatsappOutcome, setWhatsappOutcome] = useState(WHATSAPP_OUTCOMES[0].value);
  const [meetingOutcome, setMeetingOutcome] = useState(MEETING_OUTCOMES[0].value);
  const [followUpDate, setFollowUpDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayIso());
      setMeetingTime(contact?.meeting_time || "09:00");
      setOutcome(CALL_OUTCOMES[0]);
      setWhatsappOutcome(WHATSAPP_OUTCOMES[0].value);
      setMeetingOutcome(MEETING_OUTCOMES[0].value);
      setFollowUpDate(contact?.next_follow_up_date || "");
      setNote("");
    }
  }, [open, mode, contact]);

  if (!contact) return null;
  const copy = COPY[mode];

  function buildNotes(label: string) {
    const noteEntry = note.trim() ? `[${date}] ${label}: ${note.trim()}` : "";
    return contact ? [contact!.notes, noteEntry].filter(Boolean).join("\n") : noteEntry;
  }

  async function handleSave() {
    setSaving(true);
    const timestamp = date === todayIso() ? nowIso() : `${date}T09:00:00`;

    try {
      if (mode === "call") {
        const wasContacted = isContacted(contact!.cold_call_status);
        const currentStatus = deriveCurrentStatus(outcome);
        const patch: Record<string, unknown> = {
          cold_call_status: outcome,
          cold_call_last_contacted_at: date,
          current_status: currentStatus,
          notes: buildNotes("Call"),
          _changeType: outcome === "Meeting Booked" ? "meeting_booked" : "cold_call_logged",
          _isFirstTouch: !wasContacted,
        };
        if (outcome === "Meeting Booked") {
          patch.is_meeting_milestone = "Yes";
          patch.meeting_date = date;
          patch.meeting_time = meetingTime;
        }
        if (outcome === "Follow-up Call Needed" && followUpDate) {
          patch.next_follow_up_date = followUpDate;
        }
        await onSave(patch);
      } else if (mode === "whatsapp") {
        const wasContacted = isContacted(contact!.whatsapp_status);
        const patch: Record<string, unknown> = {
          whatsapp_status: "Contacted",
          current_status: whatsappOutcome,
          notes: buildNotes("WhatsApp"),
          _changeType:
            whatsappOutcome === "WhatsApp - Meeting Arranged" ? "meeting_booked" : "whatsapp_logged",
          _isFirstTouch: !wasContacted,
        };
        if (!contact!.whatsapp_initial_contacted_at) {
          patch.whatsapp_initial_contacted_at = timestamp;
        } else {
          patch.whatsapp_followup_contacted_at = timestamp;
        }
        if (whatsappOutcome === "WhatsApp - Meeting Arranged") {
          patch.cold_call_status = "Meeting Booked";
          patch.is_meeting_milestone = "Yes";
          patch.meeting_date = date;
          patch.meeting_time = meetingTime;
        }
        await onSave(patch);
      } else if (mode === "meeting") {
        await onSave({
          is_meeting_milestone: "Yes",
          cold_call_status: "Meeting Booked",
          current_status: "Meeting Booked",
          meeting_date: date,
          meeting_time: meetingTime,
          notes: buildNotes("Meeting"),
          _changeType: "meeting_booked",
        });
      } else {
        // outcome
        const patch: Record<string, unknown> = {
          current_status: meetingOutcome,
          notes: buildNotes("Outcome"),
          _changeType: "field_edit",
        };
        if (meetingOutcome === "Rescheduled") {
          patch.meeting_date = date;
          patch.meeting_time = meetingTime;
        }
        if (meetingOutcome === "Follow-up Needed" && followUpDate) {
          patch.next_follow_up_date = followUpDate;
        }
        if (meetingOutcome === "Not Interested") {
          patch.cold_call_status = "Not Interested";
          patch.is_meeting_milestone = "No";
        }
        await onSave(patch);
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
          {mode !== "outcome" && (
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
          )}

          {mode === "call" && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-outcome">Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="ql-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_OUTCOMES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "call" && outcome === "Follow-up Call Needed" && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-followup">Call again on</Label>
              <Input
                id="ql-followup"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          )}

          {mode === "whatsapp" && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-wa-outcome">What happened</Label>
              <Select value={whatsappOutcome} onValueChange={setWhatsappOutcome}>
                <SelectTrigger id="ql-wa-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_OUTCOMES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "outcome" && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-meeting-outcome">Meeting outcome</Label>
              <Select value={meetingOutcome} onValueChange={setMeetingOutcome}>
                <SelectTrigger id="ql-meeting-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_OUTCOMES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(mode === "meeting" ||
            (mode === "whatsapp" && whatsappOutcome === "WhatsApp - Meeting Arranged") ||
            (mode === "call" && outcome === "Meeting Booked") ||
            (mode === "outcome" && meetingOutcome === "Rescheduled")) && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-time">
                {mode === "outcome" ? "New meeting date" : "Time slot"}
              </Label>
              {mode === "outcome" && meetingOutcome === "Rescheduled" && (
                <Input
                  id="ql-reschedule-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mb-1.5"
                />
              )}
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

          {mode === "outcome" && meetingOutcome === "Follow-up Needed" && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-outcome-followup">Follow up on</Label>
              <Input
                id="ql-outcome-followup"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
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
