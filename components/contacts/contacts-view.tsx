"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Contact, CURRENT_STATUSES, isDeadLead } from "@/lib/types";
import { isContacted } from "@/lib/insights";
import { statusTone, interestTone, currentStatusTone } from "@/lib/badge-tone";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { EditContactDialog } from "./edit-contact-dialog";
import { QuickLogDialog, QuickLogMode } from "./quick-log-dialog";
import { ImportDialog } from "./import-dialog";
import { Plus, Pencil, Trash2, Search, Phone, MessageCircle, Handshake, Upload, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL = "__all";

export function ContactsView({ initialContacts }: { initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [coldCallFilter, setColdCallFilter] = useState(ALL);
  const [whatsappFilter, setWhatsappFilter] = useState(ALL);
  const [interestFilter, setInterestFilter] = useState(ALL);
  const [meetingFilter, setMeetingFilter] = useState(ALL);
  const [currentStatusFilter, setCurrentStatusFilter] = useState(ALL);
  const [showNotInterested, setShowNotInterested] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogMode, setQuickLogMode] = useState<QuickLogMode>("call");
  const [quickLogContact, setQuickLogContact] = useState<Contact | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(contacts.map((c) => c.category?.trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (!showNotInterested && currentStatusFilter === ALL && isDeadLead(c.current_status))
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      }
      if (category !== ALL && c.category !== category) return false;
      if (currentStatusFilter !== ALL && c.current_status !== currentStatusFilter) return false;
      if (coldCallFilter !== ALL) {
        const contacted = isContacted(c.cold_call_status);
        if (coldCallFilter === "contacted" && !contacted) return false;
        if (coldCallFilter === "not_contacted" && contacted) return false;
      }
      if (whatsappFilter !== ALL) {
        const contacted = isContacted(c.whatsapp_status);
        if (whatsappFilter === "contacted" && !contacted) return false;
        if (whatsappFilter === "not_contacted" && contacted) return false;
      }
      if (interestFilter !== ALL) {
        const level = (c.interest_level || "").toLowerCase();
        if (interestFilter === "none" && level) return false;
        if (interestFilter !== "none" && !level.startsWith(interestFilter)) return false;
      }
      if (meetingFilter !== ALL) {
        const isMeeting = c.is_meeting_milestone?.toLowerCase() === "yes";
        if (meetingFilter === "yes" && !isMeeting) return false;
        if (meetingFilter === "no" && isMeeting) return false;
      }
      return true;
    });
  }, [
    contacts,
    search,
    category,
    coldCallFilter,
    whatsappFilter,
    interestFilter,
    meetingFilter,
    currentStatusFilter,
    showNotInterested,
  ]);

  function openAdd() {
    setEditingContact(null);
    setDialogOpen(true);
  }

  function openEdit(c: Contact) {
    setEditingContact(c);
    setDialogOpen(true);
  }

  function openQuickLog(c: Contact, mode: QuickLogMode) {
    setQuickLogContact(c);
    setQuickLogMode(mode);
    setQuickLogOpen(true);
  }

  async function patchContact(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to save changes");
    const data = await res.json();
    setContacts((prev) => prev.map((c) => (c.contact_id === id ? data.contact : c)));
    return data.contact as Contact;
  }

  async function handleSave(form: Contact): Promise<Contact | void> {
    const isNew = !editingContact;
    try {
      let saved: Contact;
      if (isNew) {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Failed to add lead");
        const data = await res.json();
        saved = data.contact as Contact;
        setContacts((prev) => [...prev, saved]);
        toast.success(`Added ${form.name}`);
      } else {
        saved = await patchContact(form.contact_id, form);
        toast.success(`Saved ${form.name}`);
      }
      return saved;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    }
  }

  async function handleQuickLogSave(patch: Record<string, unknown>) {
    if (!quickLogContact) return;
    try {
      await patchContact(quickLogContact.contact_id, patch);
      const verb =
        quickLogMode === "call"
          ? "Logged call with"
          : quickLogMode === "whatsapp"
          ? "Logged WhatsApp touch with"
          : "🟢 Meeting booked with";
      toast.success(`${verb} ${quickLogContact.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    }
  }

  async function handleDelete(c: Contact) {
    if (!confirm(`Remove "${c.name}" from the tracker? You can undo this from the Activity page.`))
      return;
    try {
      const res = await fetch(`/api/contacts/${c.contact_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setContacts((prev) => prev.filter((x) => x.contact_id !== c.contact_id));
      toast.success(`Removed ${c.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function refreshContacts() {
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setContacts(data.contacts);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {contacts.length} leads
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add lead
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={coldCallFilter} onValueChange={setColdCallFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Cold call" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Cold call: any</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="not_contacted">Not contacted</SelectItem>
          </SelectContent>
        </Select>

        <Select value={whatsappFilter} onValueChange={setWhatsappFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="WhatsApp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>WhatsApp: any</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="not_contacted">Not contacted</SelectItem>
          </SelectContent>
        </Select>

        <Select value={interestFilter} onValueChange={setInterestFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Interest" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Interest: any</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="none">Not set</SelectItem>
          </SelectContent>
        </Select>

        <Select value={meetingFilter} onValueChange={setMeetingFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Meeting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Meeting: any</SelectItem>
            <SelectItem value="yes">🟢 Scheduled</SelectItem>
            <SelectItem value="no">Not scheduled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={currentStatusFilter}
          onValueChange={(v) => {
            setCurrentStatusFilter(v);
            if (v !== ALL) setShowNotInterested(true);
          }}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Current status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Current status: any</SelectItem>
            {CURRENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentStatusFilter === ALL && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showNotInterested}
              onChange={(e) => setShowNotInterested(e.target.checked)}
            />
            Show &quot;Not Interested&quot;
          </label>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Cold call</TableHead>
              <TableHead>Last call</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Last WhatsApp</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Meeting</TableHead>
              <TableHead>Current status</TableHead>
              <TableHead className="text-right">Log / Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const isMeeting = c.is_meeting_milestone?.toLowerCase() === "yes";
              const lastWhatsapp =
                c.whatsapp_followup_contacted_at || c.whatsapp_initial_contacted_at;
              return (
                <TableRow
                  key={c.contact_id}
                  className={cn(
                    "cursor-pointer",
                    isMeeting && "bg-green-soft/40 border-l-2 border-l-green"
                  )}
                  onClick={() => openEdit(c)}
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.category || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {c.phone}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusTone(c.cold_call_status)}>
                      {c.cold_call_status || "Not Contacted"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {relativeTime(c.cold_call_last_contacted_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusTone(c.whatsapp_status)}>
                      {c.whatsapp_status || "Not Contacted"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {relativeTime(lastWhatsapp)}
                  </TableCell>
                  <TableCell>
                    {c.interest_level ? (
                      <Badge variant={interestTone(c.interest_level)}>
                        {c.interest_level}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isMeeting ? "green" : "muted"}>
                      {isMeeting ? "🟢 Scheduled" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={currentStatusTone(c.current_status)}>
                      {c.current_status || "Can Call Again"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Log a cold call"
                        onClick={() => openQuickLog(c, "call")}
                      >
                        <Phone className="h-3.5 w-3.5 text-amber" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Log a WhatsApp touch"
                        onClick={() => openQuickLog(c, "whatsapp")}
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-teal" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Book a meeting"
                        onClick={() => openQuickLog(c, "meeting")}
                      >
                        <Handshake className="h-3.5 w-3.5 text-green" />
                      </Button>
                      {isMeeting && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Log meeting outcome"
                          onClick={() => openQuickLog(c, "outcome")}
                        >
                          <Flag className="h-3.5 w-3.5 text-navy" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                        <Trash2 className="h-3.5 w-3.5 text-rust" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  No leads match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EditContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        onSave={handleSave}
      />

      <QuickLogDialog
        open={quickLogOpen}
        onOpenChange={setQuickLogOpen}
        contact={quickLogContact}
        mode={quickLogMode}
        onSave={handleQuickLogSave}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refreshContacts}
      />
    </div>
  );
}
