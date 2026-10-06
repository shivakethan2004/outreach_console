"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ImportIssue = {
  row: number;
  phone: string;
  reason: string;
};

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  skipped: ImportIssue[];
  failed: ImportIssue[];
};

export function ImportLeadsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
}) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.onerror = () => toast.error("Could not read the selected CSV file.");
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText.trim()) {
      toast.error("Choose a CSV file or paste CSV text first.");
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 207) {
        throw new Error(data.error || "Import failed.");
      }
      setResult(data);
      await onImported();
      if (data.failedCount === 0) {
        toast.success(
          `Imported ${data.importedCount} lead${data.importedCount === 1 ? "" : "s"}; skipped ${data.skippedCount}.`
        );
      } else {
        toast.error(`Imported ${data.importedCount}; ${data.failedCount} row(s) need attention.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function closeDialog(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCsvText("");
      setFileName("");
      setResult(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Recognized columns: name, business name, contact name, category, phone, mobile,
            address, rating, reviews, and notes. Other columns are ignored. Existing phone
            numbers are skipped; invalid rows are reported and never imported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Choose CSV file
            </Button>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Or paste CSV content:</p>
            <Textarea
              rows={7}
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setResult(null);
              }}
              placeholder={"name,phone,category,notes\nAcme Clinic,9876543210,Dental Clinic,Call next week"}
              className="font-mono text-xs"
            />
          </div>
          {result && (
            <div role="status" className="max-h-48 space-y-1 overflow-auto rounded-md bg-secondary p-3 text-sm">
              <p>
                Imported {result.importedCount}; skipped {result.skippedCount}; failed {result.failedCount}.
              </p>
              {[...result.failed, ...result.skipped].map((issue, index) => (
                <p key={`${issue.row}-${index}`} className="text-xs text-muted-foreground">
                  Row {issue.row}{issue.phone ? ` (${issue.phone})` : ""}: {issue.reason}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => closeDialog(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={importing}>
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
