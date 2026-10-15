"use client";

import { FormEvent, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Bold, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CampaignScriptEditorProps = {
  campaignId: string;
  scriptId: string;
  initialTitle: string;
  initialContent: string;
  onCancel: () => void;
  onSaved: () => Promise<void>;
};

function formattedMarkdown(content: string) {
  return content.replace(
    /\[\[(color|bg)=#([0-9a-f]{6})\]\]([\s\S]*?)\[\[\/\1\]\]/gi,
    (_match, kind: string, color: string, text: string) =>
      `[${text}](https://script-style.invalid/${kind.toLowerCase()}/${color.toLowerCase()})`
  );
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-xl font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-base font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-2 whitespace-pre-wrap leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => {
    const styleMatch = href?.match(/^https:\/\/script-style\.invalid\/(color|bg)\/([0-9a-f]{6})$/i);
    if (styleMatch) {
      const [, kind, color] = styleMatch;
      const style =
        kind.toLowerCase() === "color"
          ? { color: `#${color}` }
          : { backgroundColor: `#${color}`, color: "#111827" };
      return <span style={style} className="rounded-sm px-0.5">{children}</span>;
    }
    return <a href={href} className="text-primary underline underline-offset-2">{children}</a>;
  },
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md bg-muted p-3 text-sm">{children}</pre>
  ),
};

export function CampaignScriptPreview({ content }: { content: string }) {
  const markdown = formattedMarkdown(content);
  return (
    <div className="prose max-w-none text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export function CampaignScriptEditor({
  campaignId,
  scriptId,
  initialTitle,
  initialContent,
  onCancel,
  onSaved,
}: CampaignScriptEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  function wrapSelection(opening: string, closing: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? selectionRef.current.start;
    const end = textarea?.selectionEnd ?? selectionRef.current.end;
    const selectedText = content.slice(start, end);
    const placeholder = selectedText || "text";
    const replacement = `${opening}${placeholder}${closing}`;
    const nextContent = `${content.slice(0, start)}${replacement}${content.slice(end)}`;
    const selectionStart = start + opening.length;
    const selectionEnd = selectionStart + placeholder.length;
    setContent(nextContent);
    selectionRef.current = { start: selectionStart, end: selectionEnd };
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function rememberSelection() {
    const textarea = textareaRef.current;
    if (textarea) {
      selectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Script title and text are required.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/scripts/${scriptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save script.");
      await onSaved();
      toast.success("Script saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save script.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-md border border-primary/30 bg-background p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`script-title-${scriptId}`}>Script title</Label>
        <Input
          id={`script-title-${scriptId}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2">
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Markdown</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Bold selected text"
            title="Bold (Markdown)"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => wrapSelection("**", "**")}
          >
            <Bold /> Bold
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Text color
          <input
            type="color"
            aria-label="Text color"
            defaultValue="#b91c1c"
            className="h-9 w-10 cursor-pointer rounded border border-input bg-card p-1"
            onMouseDown={rememberSelection}
            onChange={(event) => wrapSelection(`[[color=${event.target.value}]]`, "[[/color]]")}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Highlight
          <input
            type="color"
            aria-label="Text background color"
            defaultValue="#fef08a"
            className="h-9 w-10 cursor-pointer rounded border border-input bg-card p-1"
            onMouseDown={rememberSelection}
            onChange={(event) => wrapSelection(`[[bg=${event.target.value}]]`, "[[/bg]]")}
          />
        </label>
        <p className="basis-full text-xs text-muted-foreground">
          Select words in the editor before applying formatting. Markdown such as headings, lists, and links is supported.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`script-content-${scriptId}`}>Edit Markdown</Label>
          <Textarea
            ref={textareaRef}
            id={`script-content-${scriptId}`}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              rememberSelection();
            }}
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            onClick={rememberSelection}
            spellCheck
            rows={15}
            className="min-h-[340px] resize-y font-mono text-sm leading-relaxed"
            placeholder={"# Opening\n\nHello **there**..."}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Eye className="h-4 w-4" /> Preview
          </div>
          <div className="prose min-h-[340px] max-w-none overflow-auto rounded-md border bg-card p-3 text-sm">
            {content.trim() ? (
              <CampaignScriptPreview content={content} />
            ) : (
              <p className="text-muted-foreground">Your formatted script preview will appear here.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          <Save /> {saving ? "Saving..." : "Save script"}
        </Button>
      </div>
    </form>
  );
}
