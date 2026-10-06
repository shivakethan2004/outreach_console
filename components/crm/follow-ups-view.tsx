"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FollowUp, Lead, Product, Task, Meeting } from "@/lib/crm-types";
import { addDaysToDate, dateInTimeZone, formatRelativeSchedule } from "@/lib/crm-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LeadTimelineDialog } from "@/components/crm/lead-timeline-dialog";

type View =
  | "today"
  | "upcoming"
  | "overdue"
  | "whatsapp"
  | "meetings"
  | "reengagement"
  | "tasks"
  | "schedule";
type ScheduleRange = "7" | "30" | "90";
type FollowUpRow = FollowUp & {
  leads?: Pick<Lead, "phone" | "name" | "category" | "status"> | null;
  meetings?: Meeting | null;
};
type MeetingRow = Meeting & {
  leads?: Pick<Lead, "phone" | "name" | "category"> | null;
  products?: Pick<Product, "id" | "name"> | null;
};
type TaskRow = Task & { leads?: Pick<Lead, "phone" | "name"> | null };
type ReengagementLead = Pick<Lead, "phone" | "name" | "category" | "status"> & {
  updated_at: string;
};

const views: { id: View; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "whatsapp", label: "WhatsApp queue" },
  { id: "meetings", label: "Meetings" },
  { id: "reengagement", label: "Re-engagement" },
  { id: "tasks", label: "Other tasks" },
  { id: "schedule", label: "Schedule" },
];

export function FollowUpsView() {
  const [view, setView] = useState<View>("today");
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reengagement, setReengagement] = useState<ReengagementLead[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [timelinePhone, setTimelinePhone] = useState<string | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [type, setType] = useState<"call" | "whatsapp" | "meeting">("call");
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingMode, setMeetingMode] = useState<"online" | "offline">("online");
  const [productId, setProductId] = useState("");
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [rescheduleValues, setRescheduleValues] = useState<Record<string, string>>({});
  const [scheduleRange, setScheduleRange] = useState<ScheduleRange>("7");
  const [today, setToday] = useState(dateInTimeZone(new Date(), "Asia/Kolkata"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectableLeads = leads.filter((lead) => lead.status !== "deal_closed");
  const filteredLeads = selectableLeads.filter((lead) => {
    const search = leadSearch.trim().toLowerCase();
    return (
      search.length > 0 &&
      (lead.name.toLowerCase().includes(search) ||
        lead.phone.toLowerCase().includes(search) ||
        lead.category.toLowerCase().includes(search))
    );
  });
  const selectedLead = selectableLeads.find((lead) => lead.phone === phone);
  const scheduleDays = Number(scheduleRange);
  const scheduleEnd = addDaysToDate(today, scheduleDays - 1);

  const load = useCallback(async () => {
    try {
      const [followUpResponse, meetingResponse, taskResponse, leadResponse, productResponse, reengagementResponse] =
        await Promise.all([
          fetch("/api/follow-ups"),
          fetch("/api/meetings"),
          fetch("/api/tasks"),
          fetch("/api/leads"),
          fetch("/api/products"),
          fetch("/api/reengagement"),
        ]);
      const [followUpData, meetingData, taskData, leadData, productData, reengagementData] =
        await Promise.all([
          followUpResponse.json(),
          meetingResponse.json(),
          taskResponse.json(),
          leadResponse.json(),
          productResponse.json(),
          reengagementResponse.json(),
        ]);
      const failedResponse = [
        followUpResponse,
        meetingResponse,
        taskResponse,
        leadResponse,
        productResponse,
        reengagementResponse,
      ].find((response) => !response.ok);
      if (failedResponse) {
        const result = [
          followUpData,
          meetingData,
          taskData,
          leadData,
          productData,
          reengagementData,
        ].find((_item, index) => [
          followUpResponse,
          meetingResponse,
          taskResponse,
          leadResponse,
          productResponse,
          reengagementResponse,
        ][index].status >= 400);
        throw new Error(result?.error || "Could not load follow-ups.");
      }
      setFollowUps(followUpData.follow_ups);
      setMeetings(meetingData.meetings);
      setTasks(taskData.tasks);
      setLeads(leadData.leads);
      setProducts(productData.products.filter((item: Product) => item.is_active));
      setReengagement(reengagementData.leads);
      setToday(reengagementData.today);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load follow-ups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/follow-ups"),
      fetch("/api/meetings"),
      fetch("/api/tasks"),
      fetch("/api/leads"),
      fetch("/api/products"),
      fetch("/api/reengagement"),
    ])
      .then(async ([followUpResponse, meetingResponse, taskResponse, leadResponse, productResponse, reengagementResponse]) => {
        const [followUpData, meetingData, taskData, leadData, productData, reengagementData] =
          await Promise.all([
            followUpResponse.json(),
            meetingResponse.json(),
            taskResponse.json(),
            leadResponse.json(),
            productResponse.json(),
            reengagementResponse.json(),
          ]);
        if (!followUpResponse.ok) throw new Error(followUpData.error || "Could not load follow-ups.");
        if (!meetingResponse.ok) throw new Error(meetingData.error || "Could not load meetings.");
        if (!taskResponse.ok) throw new Error(taskData.error || "Could not load tasks.");
        if (!leadResponse.ok) throw new Error(leadData.error || "Could not load leads.");
        if (!productResponse.ok) throw new Error(productData.error || "Could not load products.");
        if (!reengagementResponse.ok) {
          throw new Error(reengagementData.error || "Could not load re-engagement leads.");
        }
        if (!active) return;
        setFollowUps(followUpData.follow_ups);
        setMeetings(meetingData.meetings);
        setTasks(taskData.tasks);
        setLeads(leadData.leads);
        setProducts(productData.products.filter((item: Product) => item.is_active));
        setReengagement(reengagementData.leads);
        setToday(reengagementData.today);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load follow-ups.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pending = followUps.filter((item) => item.status === "pending");
  const scheduleByDate = new Map<
    string,
    { meetings: MeetingRow[]; calls: FollowUpRow[]; whatsapp: FollowUpRow[] }
  >();
  for (let offset = 0; offset < scheduleDays; offset += 1) {
    const date = addDaysToDate(today, offset);
    scheduleByDate.set(date, { meetings: [], calls: [], whatsapp: [] });
  }
  for (const meeting of meetings) {
    if (meeting.status !== "scheduled" || !meeting.scheduled_at) continue;
    const date = meeting.scheduled_at.slice(0, 10);
    scheduleByDate.get(date)?.meetings.push(meeting);
  }
  for (const followUp of pending) {
    if (!followUp.scheduled_at || followUp.type === "meeting") continue;
    const day = scheduleByDate.get(followUp.scheduled_at.slice(0, 10));
    if (!day) continue;
    if (followUp.type === "call") day.calls.push(followUp);
    if (followUp.type === "whatsapp") day.whatsapp.push(followUp);
  }
  const visibleFollowUps = (() => {
    if (view === "whatsapp") return pending.filter((item) => item.type === "whatsapp");
    if (view === "today") {
      return pending.filter((item) => item.scheduled_at?.slice(0, 10) === today);
    }
    if (view === "upcoming") {
      return pending.filter((item) => item.scheduled_at && item.scheduled_at.slice(0, 10) > today);
    }
    if (view === "overdue") {
      return pending.filter((item) => item.scheduled_at && item.scheduled_at.slice(0, 10) < today);
    }
    return [];
  })();

  async function createFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone) {
      toast.error("Search for and select a lead first.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          type,
          scheduled_at: scheduledAt || null,
          note,
          meeting_mode: type === "meeting" ? meetingMode : null,
          product_id: type === "meeting" ? productId : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create follow-up.");
      toast.success("Follow-up created.");
      setShowCreate(false);
      setPhone("");
      setLeadSearch("");
      setScheduledAt("");
      setNote("");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not create follow-up.");
    } finally {
      setSaving(false);
    }
  }

  async function updateFollowUp(id: string, action: string, newDateTime?: string) {
    if (action === "close_not_interested" && !confirm("Close this lead as not interested and cancel its remaining scheduled follow-ups?")) {
      return;
    }
    try {
      const response = await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scheduled_at: newDateTime }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update follow-up.");
      toast.success(action === "cancel" ? "Follow-up cancelled. The lead remains open." : "Follow-up updated.");
      await load();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Could not update follow-up.");
    }
  }

  async function updateMeeting(id: string, action: string, newDateTime?: string) {
    if (
      action === "close_not_interested" &&
      !confirm("Close this lead as not interested and cancel its remaining scheduled follow-ups?")
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scheduled_at: newDateTime }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update meeting.");
      const message =
        action === "complete"
          ? "Meeting completed."
          : action === "reschedule"
            ? "Meeting rescheduled."
            : action === "cancel"
              ? "Meeting cancelled. The lead remains open."
              : "Lead closed as not interested.";
      toast.success(message);
      await load();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Could not update meeting.");
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, note: taskNote, due_at: taskDueAt || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create task.");
      setTaskTitle("");
      setTaskNote("");
      setTaskDueAt("");
      setShowTaskForm(false);
      toast.success("Task added.");
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not create task.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, action: string) {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update task.");
      await load();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Could not update task.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Meetings first, then calls, WhatsApp, and other tasks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTaskForm((open) => !open)}>+ Task</Button>
          <Button onClick={() => setShowCreate((open) => !open)}>+ Follow-up</Button>
        </div>
      </header>

      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={createFollowUp} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="followup-lead">Lead</Label>
                <Input
                  id="followup-lead"
                  type="search"
                  autoComplete="off"
                  placeholder="Search by lead name, phone, or category"
                  value={leadSearch}
                  aria-required="true"
                  onChange={(event) => {
                    setLeadSearch(event.target.value);
                    setPhone("");
                  }}
                  aria-controls="followup-lead-results"
                  aria-autocomplete="list"
                />
                {selectedLead && !leadSearch && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{selectedLead.name}</span>
                      <span className="text-muted-foreground"> · {selectedLead.phone}</span>
                    </span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPhone("")}>
                      Change
                    </Button>
                  </div>
                )}
                {leadSearch.trim() && (
                  <div
                    id="followup-lead-results"
                    role="listbox"
                    aria-label="Matching leads"
                    className="max-h-56 overflow-y-auto rounded-md border border-border bg-card shadow-sm"
                  >
                    {filteredLeads.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No matching open leads.</p>
                    ) : (
                      filteredLeads.slice(0, 50).map((lead) => (
                        <button
                          key={lead.phone}
                          type="button"
                          role="option"
                          aria-selected={phone === lead.phone}
                          onClick={() => {
                            setPhone(lead.phone);
                            setLeadSearch("");
                          }}
                          className="flex w-full flex-col items-start border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                        >
                          <span className="text-sm font-medium">{lead.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {lead.phone}{lead.category ? ` · ${lead.category}` : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="followup-type">Type</Label>
                <select id="followup-type" value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm">
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="followup-date">{type === "meeting" ? "Meeting date and time" : "Schedule (optional)"}</Label>
                <Input id="followup-date" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required={type === "meeting"} />
              </div>
              {type === "meeting" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="followup-mode">Mode</Label>
                    <select id="followup-mode" value={meetingMode} onChange={(event) => setMeetingMode(event.target.value as typeof meetingMode)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm">
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="followup-product">Product discussed</Label>
                    <select id="followup-product" value={productId} onChange={(event) => setProductId(event.target.value)} required className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm">
                      <option value="">Select product</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="followup-note">Short note</Label>
                <Textarea id="followup-note" value={note} onChange={(event) => setNote(event.target.value)} required placeholder="e.g. Follow up about website pricing." rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button disabled={saving || (type === "meeting" && products.length === 0)}>{saving ? "Saving..." : "Save follow-up"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showTaskForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={createTask} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-title">Task</Label>
                <Input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required placeholder="Prepare a proposal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-date">Due date and time (optional)</Label>
                <Input id="task-date" type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="task-note">Note (optional)</Label>
                <Textarea id="task-note" rows={2} value={taskNote} onChange={(event) => setTaskNote(event.target.value)} />
              </div>
              <div className="sm:col-span-2"><Button disabled={saving}>{saving ? "Saving..." : "Add task"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{error}</p>}

      <LeadTimelineDialog phone={timelinePhone} onOpenChange={setTimelinePhone} />

      <nav aria-label="Follow-up views" className="flex gap-1 overflow-x-auto border-b border-border">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm ${
              view === item.id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your follow-ups...</p>
      ) : view === "schedule" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Schedule availability</h2>
              <p className="text-sm text-muted-foreground">
                See free days and move a meeting or follow-up earlier while keeping its scheduled time.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="schedule-range">Show range</Label>
              <select
                id="schedule-range"
                value={scheduleRange}
                onChange={(event) => setScheduleRange(event.target.value as ScheduleRange)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="7">Next 7 days</option>
                <option value="30">Next 30 days</option>
                <option value="90">Next 3 months</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Scheduled work legend">
            <span className="rounded-full bg-navy/10 px-2.5 py-1">Meetings</span>
            <span className="rounded-full bg-teal-soft px-2.5 py-1">Call follow-ups</span>
            <span className="rounded-full bg-amber-soft px-2.5 py-1">WhatsApp follow-ups</span>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {[...scheduleByDate].map(([date, day]) => {
              const eventCount = day.meetings.length + day.calls.length + day.whatsapp.length;
              return (
                <Card key={date} className={eventCount === 0 ? "border-green/30 bg-green-soft/30" : ""}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{formatRelativeSchedule(date, today)}</h3>
                      {eventCount === 0 ? (
                        <span className="rounded-full bg-green-soft px-2.5 py-1 text-xs font-medium text-green">
                          Free day
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {eventCount} scheduled item{eventCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {eventCount === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No meetings, call follow-ups, or WhatsApp follow-ups scheduled.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {day.meetings.map((meeting) => (
                          <div key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium uppercase text-muted-foreground">Meeting</p>
                              <p className="truncate text-sm font-medium">
                                {meeting.leads?.name || "Lead"} · {meeting.scheduled_at ? formatRelativeSchedule(meeting.scheduled_at, today) : ""}
                              </p>
                              {meeting.note && <p className="truncate text-xs text-muted-foreground">{meeting.note}</p>}
                            </div>
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="space-y-1">
                                <Label htmlFor={`schedule-meeting-${meeting.id}`} className="text-xs">New time</Label>
                                <Input
                                  id={`schedule-meeting-${meeting.id}`}
                                  type="datetime-local"
                                  value={rescheduleValues[`meeting-${meeting.id}`] || meeting.scheduled_at?.slice(0, 16) || ""}
                                  onChange={(event) => setRescheduleValues((current) => ({
                                    ...current,
                                    [`meeting-${meeting.id}`]: event.target.value,
                                  }))}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!rescheduleValues[`meeting-${meeting.id}`]}
                                onClick={() => void updateMeeting(meeting.id, "reschedule", rescheduleValues[`meeting-${meeting.id}`])}
                              >
                                Reschedule
                              </Button>
                            </div>
                          </div>
                        ))}
                        {[...day.calls, ...day.whatsapp].map((followUp) => (
                          <div key={followUp.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5">
                            <div className="min-w-0">
                              <p className={`text-xs font-medium uppercase ${followUp.type === "call" ? "text-teal" : "text-amber"}`}>
                                {followUp.type === "call" ? "Call follow-up" : "WhatsApp follow-up"}
                              </p>
                              <p className="truncate text-sm font-medium">
                                {followUp.leads?.name || "Lead"} · {followUp.scheduled_at ? formatRelativeSchedule(followUp.scheduled_at, today) : ""}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{followUp.note}</p>
                            </div>
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="space-y-1">
                                <Label htmlFor={`schedule-followup-${followUp.id}`} className="text-xs">New time</Label>
                                <Input
                                  id={`schedule-followup-${followUp.id}`}
                                  type="datetime-local"
                                  value={rescheduleValues[`followup-${followUp.id}`] || followUp.scheduled_at?.slice(0, 16) || ""}
                                  onChange={(event) => setRescheduleValues((current) => ({
                                    ...current,
                                    [`followup-${followUp.id}`]: event.target.value,
                                  }))}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!rescheduleValues[`followup-${followUp.id}`]}
                                onClick={() => void updateFollowUp(followUp.id, "reschedule", rescheduleValues[`followup-${followUp.id}`])}
                              >
                                Reschedule
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {today} through {scheduleEnd}. Unscheduled WhatsApp items are in the WhatsApp queue and are not counted as scheduled work.
          </p>
        </section>
      ) : view === "meetings" ? (
        <div className="space-y-2">
          {meetings.filter((meeting) => meeting.status === "scheduled" || meeting.legacy_date).length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No meetings recorded.</p>
          ) : meetings.filter((meeting) => meeting.status === "scheduled" || meeting.legacy_date).map((meeting) => (
            <Card key={meeting.id}>
              <CardContent className="flex flex-wrap justify-between gap-3 p-4">
                <div>
                  {meeting.leads?.phone ? (
                    <button
                      type="button"
                      onClick={() => meeting.leads?.phone && setTimelinePhone(meeting.leads.phone)}
                      className="text-left font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`View notes and timeline for ${meeting.leads.name}`}
                    >
                      {meeting.leads.name}
                    </button>
                  ) : (
                    <p className="font-medium">{meeting.leads?.name || "Legacy meeting"}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {meeting.products?.name || "Product not recorded"} · {meeting.mode || "Mode needs review"}
                  </p>
                  <p className="text-sm">
                    {meeting.scheduled_at
                      ? formatRelativeSchedule(meeting.scheduled_at, today)
                      : meeting.legacy_date
                        ? formatRelativeSchedule(
                            `${meeting.legacy_date}${meeting.legacy_time ? `T${meeting.legacy_time}` : ""}`,
                            today
                          )
                        : "Date needs review"}
                  </p>
                  {meeting.note && <p className="mt-1 text-sm">{meeting.note}</p>}
                </div>
                {meeting.status === "scheduled" && (
                  <div className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3">
                    <div className="min-w-52 flex-1 space-y-1">
                      <Label htmlFor={`meeting-reschedule-${meeting.id}`} className="text-xs">
                        Reschedule
                      </Label>
                      <Input
                        id={`meeting-reschedule-${meeting.id}`}
                        type="datetime-local"
                        value={
                          rescheduleValues[meeting.id] ||
                          meeting.scheduled_at?.slice(0, 16) ||
                          ""
                        }
                        onChange={(event) =>
                          setRescheduleValues((current) => ({
                            ...current,
                            [meeting.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!rescheduleValues[meeting.id]}
                      onClick={() =>
                        void updateMeeting(
                          meeting.id,
                          "reschedule",
                          rescheduleValues[meeting.id]
                        )
                      }
                    >
                      Save new time
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void updateMeeting(meeting.id, "complete")}
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateMeeting(meeting.id, "cancel")}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void updateMeeting(meeting.id, "close_not_interested")
                      }
                    >
                      Close as not interested
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : view === "reengagement" ? (
        <div className="space-y-2">
          {reengagement.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No re-engagement leads right now.</p>
          ) : reengagement.map((lead) => (
            <Card key={lead.phone}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setTimelinePhone(lead.phone)}
                    className="text-left font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`View notes and timeline for ${lead.name}`}
                  >
                    {lead.name}
                  </button>
                  <p className="text-sm text-muted-foreground">{lead.phone} · {lead.category || "No category"}</p>
                </div>
                <Button size="sm" onClick={() => {
                  setPhone(lead.phone);
                  setType("call");
                  setShowCreate(true);
                }}>Create follow-up</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : view === "tasks" ? (
        <div className="space-y-2">
          {tasks.filter((task) => task.status === "pending").length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No pending tasks.</p>
          ) : tasks.filter((task) => task.status === "pending").map((task) => (
            <Card key={task.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{task.title}</p>
                  {task.leads?.phone && (
                    <button
                      type="button"
                      onClick={() => task.leads?.phone && setTimelinePhone(task.leads.phone)}
                      className="text-left text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`View notes and timeline for ${task.leads.name}`}
                    >
                      {task.leads.name}
                    </button>
                  )}
                  {task.note && <p className="text-sm text-muted-foreground">{task.note}</p>}
                  {task.due_at && <p className="text-xs text-muted-foreground">{formatRelativeSchedule(task.due_at, today)}</p>}
                </div>
                <Button size="sm" onClick={() => void updateTask(task.id, "complete")}>Complete</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleFollowUps.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nothing in this follow-up view.</p>
          ) : visibleFollowUps.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {item.leads?.phone ? (
                      <button
                        type="button"
                        onClick={() => item.leads?.phone && setTimelinePhone(item.leads.phone)}
                        className="text-left font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`View notes and timeline for ${item.leads.name}`}
                      >
                        {item.leads.name}
                      </button>
                    ) : (
                      <p className="font-medium">Lead</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {item.type === "whatsapp" ? "WhatsApp" : item.type === "meeting" ? "Meeting" : "Call"}
                      {item.scheduled_at ? ` · ${formatRelativeSchedule(item.scheduled_at, today)}` : " · Unscheduled"}
                    </p>
                    <p className="mt-1 text-sm">{item.note}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void updateFollowUp(item.id, "complete")}>Complete</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateFollowUp(item.id, "cancel")}>Cancel</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateFollowUp(item.id, "close_not_interested")}>Close as not interested</Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                  <div className="min-w-56 space-y-1">
                    <Label htmlFor={`reschedule-${item.id}`} className="text-xs">Reschedule</Label>
                    <Input
                      id={`reschedule-${item.id}`}
                      type="datetime-local"
                      value={rescheduleValues[item.id] || item.scheduled_at?.slice(0, 16) || ""}
                      onChange={(event) => setRescheduleValues((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!rescheduleValues[item.id]}
                    onClick={() => void updateFollowUp(item.id, "reschedule", rescheduleValues[item.id])}
                  >
                    Save new time
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
