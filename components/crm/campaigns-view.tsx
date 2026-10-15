"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Pause, Play, Plus, RotateCcw, Square, Timer, Upload } from "lucide-react";
import { Lead, Product } from "@/lib/crm-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CallOutcomeForm } from "@/components/crm/call-outcome-form";
import { CampaignScriptEditor, CampaignScriptPreview } from "@/components/crm/campaign-script-editor";

type CampaignStats = {
  leads: number;
  calls: number;
  answered: number;
  conversations: number;
  meetings: number;
  average_duration_seconds: number;
};
type Campaign = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  started_at: string | null;
  completed_at: string | null;
  active_since: string | null;
  elapsed_seconds: number;
  created_at: string;
  stats: CampaignStats;
};
type CampaignCall = {
  id: string;
  lead_phone: string;
  outcome: string;
  duration_seconds: number;
  answered: boolean;
  is_conversation: boolean;
  called_at: string;
};
type CampaignScript = {
  id: string;
  title: string;
  content: string;
  file_path: string | null;
  file_name: string | null;
  file_url: string | null;
  file_error?: string | null;
};
type CampaignDetail = {
  campaign: Omit<Campaign, "stats">;
  leads: Array<Pick<Lead, "phone" | "name" | "category" | "status" | "is_archived">>;
  calls: CampaignCall[];
  scripts: CampaignScript[];
};
type EligibleLead = Pick<Lead, "phone" | "name" | "category" | "status" | "call_priority">;

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${hours}h ${minutes}m ${remainingSeconds}s`
    : `${minutes}m ${remainingSeconds}s`;
}

function campaignElapsed(campaign: CampaignDetail["campaign"], now: number) {
  const currentSegment =
    campaign.status === "active" && campaign.active_since
      ? Math.max(0, Math.floor((now - new Date(campaign.active_since).getTime()) / 1000))
      : 0;
  return campaign.elapsed_seconds + currentSegment;
}

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [eligibleLeads, setEligibleLeads] = useState<EligibleLead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [selectedLead, setSelectedLead] = useState<Pick<Lead, "phone" | "name"> | null>(null);
  const [recording, setRecording] = useState<{ phone: string; startedAt: number } | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [name, setName] = useState("");
  const [selectionMode, setSelectionMode] = useState<"manual" | "random">("manual");
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [randomCount, setRandomCount] = useState("30");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [expandedScriptIds, setExpandedScriptIds] = useState<Set<string>>(() => new Set());
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const loadCampaigns = useCallback(async () => {
    const response = await fetch("/api/campaigns");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load campaigns.");
    setCampaigns(data.campaigns);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/campaigns/${id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load this campaign.");
    setDetail(data);
    setSelectedLead(null);
    setRecording(null);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/campaigns"),
      fetch("/api/leads"),
      fetch("/api/products"),
    ])
      .then(async ([campaignResponse, leadsResponse, productsResponse]) => {
        const [campaignData, leadsData, productsData] = await Promise.all([
          campaignResponse.json(),
          leadsResponse.json(),
          productsResponse.json(),
        ]);
        const failed = !campaignResponse.ok
          ? campaignData
          : !leadsResponse.ok
            ? leadsData
            : !productsResponse.ok
              ? productsData
              : null;
        if (failed) throw new Error(failed.error || "Could not load campaign data.");
        if (!active) return;
        setCampaigns(campaignData.campaigns);
        setEligibleLeads(
          leadsData.leads.filter(
            (lead: EligibleLead) =>
              lead.status !== "deal_closed" && lead.call_priority !== "not_calling"
          )
        );
        setProducts(productsData.products);
        setProductsLoaded(true);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load campaign data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const update = () => setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recording.startedAt) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  const leadCallCounts = useMemo(() => {
    const counts = new Map<string, { calls: number; answered: number; conversations: number; spokenSeconds: number }>();
    for (const call of detail?.calls || []) {
      const item = counts.get(call.lead_phone) || { calls: 0, answered: 0, conversations: 0, spokenSeconds: 0 };
      item.calls += 1;
      if (call.is_conversation) item.conversations += 1;
      if (call.answered) {
        item.answered += 1;
        item.spokenSeconds += call.duration_seconds;
      }
      counts.set(call.lead_phone, item);
    }
    return counts;
  }, [detail?.calls]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          selection_mode: selectionMode,
          lead_phones: selectionMode === "manual" ? selectedPhones : undefined,
          count: selectionMode === "random" ? Number(randomCount) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create campaign.");
      setName("");
      setSelectedPhones([]);
      await loadCampaigns();
      await loadDetail(data.campaign.id);
      toast.success("Campaign created.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not create campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaign(action: "start" | "pause" | "resume" | "complete" | "reset") {
    if (!detail) return;
    if (recording && ["pause", "complete", "reset"].includes(action)) {
      toast.error("Stop or cancel the current call timer before changing the campaign.");
      return;
    }
    if (
      action === "reset" &&
      !window.confirm("Reset this campaign? This clears its call history and timer but keeps its leads and scripts.")
    ) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${detail.campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update campaign.");
      await Promise.all([loadCampaigns(), loadDetail(detail.campaign.id)]);
      const messages = {
        start: "Campaign started.",
        pause: "Campaign paused.",
        resume: "Campaign resumed.",
        complete: "Campaign completed.",
        reset: "Campaign reset. Its leads and scripts were kept.",
      };
      toast.success(messages[action]);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not update campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function addScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${detail.campaign.id}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: scriptTitle, content: scriptContent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save script.");
      setScriptTitle("");
      setScriptContent("");
      await loadDetail(detail.campaign.id);
      toast.success("Script added to campaign.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save script.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !pdfFile) return;
    const form = new FormData();
    form.set("title", pdfTitle);
    form.set("file", pdfFile);
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${detail.campaign.id}/scripts`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not upload PDF.");
      setPdfTitle("");
      setPdfFile(null);
      await loadDetail(detail.campaign.id);
      toast.success("PDF added to campaign.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not upload PDF.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshAfterCall() {
    if (!detail) return;
    setSelectedLead(null);
    setRecording(null);
    await Promise.all([loadDetail(detail.campaign.id), loadCampaigns()]);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading campaigns...</p>;

  if (detail) {
    const calls = detail.calls;
    const answered = calls.filter((call) => call.answered).length;
    const conversations = calls.filter((call) => call.is_conversation).length;
    const todayCalls = calls.filter((call) => new Date(call.called_at).toDateString() === new Date(now).toDateString());
    const todayAnswered = todayCalls.filter((call) => call.answered).length;
    const todayConversations = todayCalls.filter((call) => call.is_conversation).length;
    const avgSpoken = answered
      ? Math.round(calls.filter((call) => call.answered).reduce((sum, call) => sum + call.duration_seconds, 0) / answered)
      : 0;
    const thisCampaign = campaigns.find((campaign) => campaign.id === detail.campaign.id);
    const stats = thisCampaign?.stats;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Button variant="ghost" className="-ml-3 mb-1" onClick={() => { setDetail(null); setSelectedLead(null); }}>
              <ArrowLeft /> All campaigns
            </Button>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{detail.campaign.name}</h1>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {detail.campaign.status} campaign
              {detail.campaign.started_at && ` · Active time ${formatDuration(campaignElapsed(detail.campaign, now))}`}
            </p>
          </div>
          <div className="flex gap-2">
            {detail.campaign.status === "draft" && (
              <Button disabled={saving || detail.leads.length === 0} onClick={() => void updateCampaign("start")}>
                <Play /> Start campaign
              </Button>
            )}
            {detail.campaign.status === "active" && (
              <Button variant="outline" disabled={saving || Boolean(recording)} onClick={() => void updateCampaign("pause")}>
                <Pause /> Pause
              </Button>
            )}
            {detail.campaign.status === "paused" && (
              <Button disabled={saving} onClick={() => void updateCampaign("resume")}>
                <Play /> Resume campaign
              </Button>
            )}
            {["active", "paused"].includes(detail.campaign.status) && (
              <Button variant="outline" disabled={saving || Boolean(recording)} onClick={() => void updateCampaign("complete")}>
                <Square /> Complete campaign
              </Button>
            )}
            {detail.campaign.status !== "draft" && (
              <Button variant="destructive" disabled={saving || Boolean(recording)} onClick={() => void updateCampaign("reset")}>
                <RotateCcw /> Reset
              </Button>
            )}
          </div>
        </div>

        {error && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{error}</p>}
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          Phone Link audio is not recorded. Start the timer when the prospect answers, then stop it to log the call duration and outcome.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Leads", detail.leads.length],
            ["Calls", calls.length],
            ["Answered", `${answered} / ${calls.length}`],
            ["Conversations (>1 min)", conversations],
            ["Meetings booked", stats?.meetings ?? calls.filter((call) => call.outcome === "meeting").length],
            ["Today: answered / calls", `${todayAnswered} / ${todayCalls.length}`],
            ["Today: conversations", todayConversations],
          ].map(([label, value]) => (
            <Card key={label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="flex flex-wrap gap-6 p-4 text-sm">
          <span>Answer rate: <strong>{calls.length ? Math.round((answered / calls.length) * 100) : 0}%</strong></span>
          <span>Average spoken call: <strong>{formatDuration(avgSpoken)}</strong></span>
          {recording && (
            <span className="flex items-center gap-1 text-destructive"><Timer className="h-4 w-4" /> Live call: {formatDuration(recordingSeconds)}</span>
          )}
        </CardContent></Card>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Campaign leads</h2>
              <span className="text-xs text-muted-foreground">{detail.leads.length} selected</span>
            </div>
            {detail.leads.map((lead) => {
              const leadCalls = leadCallCounts.get(lead.phone) || { calls: 0, answered: 0, conversations: 0, spokenSeconds: 0 };
              const isRecording = recording?.phone === lead.phone;
              return (
                <Card key={lead.phone}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lead.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{lead.phone}{lead.category ? ` · ${lead.category}` : ""}</p>
                    {lead.is_archived && (
                      <p className="mt-1 text-xs text-muted-foreground">Archived</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {leadCalls.calls} attempts · {leadCalls.answered} answered · {leadCalls.conversations} conversations · {formatDuration(leadCalls.spokenSeconds)} spoken
                    </p>
                  </div>
                  {detail.campaign.status === "active" &&
                    !lead.is_archived &&
                    lead.status !== "deal_closed" && (
                    isRecording ? (
                      <Button size="sm" variant="destructive" onClick={() => {
                        setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recording.startedAt) / 1000)));
                        setRecording(null);
                        setSelectedLead(lead);
                      }}>
                        <Square /> Stop & log ({formatDuration(recordingSeconds)})
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => {
                        setSelectedLead(null);
                        setRecording({ phone: lead.phone, startedAt: Date.now() });
                      }}>
                        <Play /> Start timer
                      </Button>
                    )
                  )}
                </CardContent></Card>
              );
            })}
          </section>

          <section className="space-y-4">
            <Card><CardContent className="space-y-3 p-4">
              <div>
                <h2 className="font-semibold">Campaign scripts</h2>
                <p className="text-xs text-muted-foreground">Keep the text scripts and PDFs you use here.</p>
              </div>
              {detail.scripts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scripts or PDFs have been added.</p>
              ) : detail.scripts.map((script) => (
                <div key={script.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-w-0 flex-1 justify-start px-1 py-1 text-left"
                      aria-expanded={expandedScriptIds.has(script.id)}
                      aria-controls={`campaign-script-content-${script.id}`}
                      onClick={() => setExpandedScriptIds((current) => {
                        const next = new Set(current);
                        if (next.has(script.id)) next.delete(script.id);
                        else next.add(script.id);
                        return next;
                      })}
                    >
                      {expandedScriptIds.has(script.id)
                        ? <ChevronDown className="h-4 w-4 shrink-0" />
                        : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{script.title}</span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {script.file_path ? script.file_name || "PDF document" : "Markdown script"}
                        </span>
                      </span>
                    </Button>
                    {expandedScriptIds.has(script.id) && !script.file_path && !script.file_error && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingScriptId(
                          editingScriptId === script.id ? null : script.id
                        )}
                      >
                        {editingScriptId === script.id ? "Close editor" : "Edit script"}
                      </Button>
                    )}
                  </div>
                  <div
                    id={`campaign-script-content-${script.id}`}
                    className={expandedScriptIds.has(script.id) ? "mt-2 border-t pt-2" : "hidden"}
                  >
                    {(expandedScriptIds.has(script.id) || editingScriptId === script.id) && (
                      script.file_url ? (
                        <a className="text-sm text-primary underline" href={script.file_url} target="_blank" rel="noreferrer">
                          Open {script.file_name || "PDF"}
                        </a>
                      ) : script.file_error ? (
                        <p role="alert" className="text-sm text-destructive">{script.file_error}</p>
                      ) : (
                        editingScriptId === script.id ? (
                          <div className="mt-3">
                            <CampaignScriptEditor
                              key={script.id}
                              campaignId={detail.campaign.id}
                              scriptId={script.id}
                              initialTitle={script.title}
                              initialContent={script.content}
                              onCancel={() => setEditingScriptId(null)}
                              onSaved={() => loadDetail(detail.campaign.id)}
                            />
                          </div>
                        ) : (
                          <div className="mt-2">
                            <CampaignScriptPreview content={script.content} />
                          </div>
                        )
                      )
                    )}
                  </div>

                </div>
              ))}
              <form onSubmit={addScript} className="space-y-2 border-t pt-3">
                <Label htmlFor="campaign-script-title">Add text script</Label>
                <Input id="campaign-script-title" value={scriptTitle} onChange={(event) => setScriptTitle(event.target.value)} placeholder="Script title" required />
                <Textarea value={scriptContent} onChange={(event) => setScriptContent(event.target.value)} placeholder="Paste the script here" required rows={4} />
                <Button type="submit" size="sm" disabled={saving}><Plus /> Add script</Button>
              </form>
              <form onSubmit={uploadPdf} className="space-y-2 border-t pt-3">
                <Label htmlFor="campaign-pdf-title">Add PDF</Label>
                <Input id="campaign-pdf-title" value={pdfTitle} onChange={(event) => setPdfTitle(event.target.value)} placeholder="PDF title" required />
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
                  required
                />
                <Button type="submit" size="sm" variant="outline" disabled={saving || !pdfFile}><Upload /> Upload PDF</Button>
              </form>
            </CardContent></Card>
          </section>
        </div>
        <Dialog
          open={selectedLead !== null && !recording}
          onOpenChange={(open) => !open && setSelectedLead(null)}
        >
          <DialogContent>
            {selectedLead && !recording && (
              <>
                <DialogHeader>
                  <DialogTitle>Log call with {selectedLead.name}</DialogTitle>
                  <DialogDescription>
                    {selectedLead.phone} · Recorded duration: {formatDuration(recordingSeconds)}
                  </DialogDescription>
                </DialogHeader>
                <CallOutcomeForm
                  lead={selectedLead}
                  products={products}
                  campaignId={detail.campaign.id}
                  durationSeconds={recordingSeconds}
                  onCancel={() => setSelectedLead(null)}
                  onDone={() => void refreshAfterCall()}
                />
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Call campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a campaign to call only its leads and review its results.</p>
      </header>
      {error && <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">{error}</p>}

      <Card><CardContent className="p-4">
        <form onSubmit={createCampaign} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input id="campaign-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. October follow-up" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="selection-mode">Lead selection</Label>
              <select id="selection-mode" value={selectionMode} onChange={(event) => setSelectionMode(event.target.value as "manual" | "random")} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm">
                <option value="manual">Manually select</option>
                <option value="random">Random leads</option>
              </select>
            </div>
          </div>
          {selectionMode === "manual" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Select campaign leads ({selectedPhones.length} selected)</p>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
                {eligibleLeads.map((lead) => (
                  <label key={lead.phone} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary">
                    <input
                      type="checkbox"
                      checked={selectedPhones.includes(lead.phone)}
                      onChange={(event) => setSelectedPhones((current) => event.target.checked
                        ? [...current, lead.phone]
                        : current.filter((phone) => phone !== lead.phone))}
                    />
                    <span className="min-w-0 flex-1 truncate">{lead.name} · {lead.phone}</span>
                  </label>
                ))}
                {eligibleLeads.length === 0 && <p className="p-2 text-sm text-muted-foreground">No eligible leads available.</p>}
              </div>
            </div>
          ) : (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="random-count">Number of random leads (up to 500)</Label>
              <Input id="random-count" type="number" min="1" max="500" value={randomCount} onChange={(event) => setRandomCount(event.target.value)} required />
            </div>
          )}
          <Button type="submit" disabled={saving || !productsLoaded || (selectionMode === "manual" && selectedPhones.length === 0)}>
            <Plus /> {saving ? "Creating..." : "Create campaign"}
          </Button>
        </form>
      </CardContent></Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your campaigns</h2>
          <span className="text-xs text-muted-foreground">{campaigns.length} campaigns</span>
        </div>
        {campaigns.length === 0 ? (
          <Card><CardContent className="p-5 text-sm text-muted-foreground">Create a campaign to organize a set of leads and track its calls.</CardContent></Card>
        ) : campaigns.map((campaign) => (
          <button key={campaign.id} type="button" onClick={() => {
            loadDetail(campaign.id).catch((loadError: unknown) =>
              setError(loadError instanceof Error ? loadError.message : "Could not load this campaign.")
            );
          }} className="block w-full text-left">
            <Card className="transition-colors hover:border-primary"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{campaign.name}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{campaign.status} · {campaign.stats.leads} leads · {campaign.stats.calls} calls · {campaign.stats.meetings} meetings</p>
              </div>
              <span className="text-xs text-muted-foreground">Answered {campaign.stats.answered}/{campaign.stats.calls} · {campaign.stats.conversations} conversations</span>
            </CardContent></Card>
          </button>
        ))}
      </section>
    </div>
  );
}
