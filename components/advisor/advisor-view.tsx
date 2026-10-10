"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { ADVISOR_MODELS, DEFAULT_ADVISOR_MODEL } from "@/lib/advisor-models";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  truncated?: boolean;
};

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => (
    <code
      className={`rounded bg-background/70 px-1 py-0.5 font-mono text-[0.9em] ${
        className || ""
      }`}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md bg-background p-3 text-xs">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-background px-2 py-1.5 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1.5">{children}</td>,
};

const MAX_MEMORY_LENGTH = 20_000;
const MAX_MESSAGE_LENGTH = 4_000;
const suggestedQuestions = [
  "What should I focus on today?",
  "How many calls have I made today, and how many remain?",
  "Find my latest notes and follow-ups for a lead.",
];

export function AdvisorView() {
  const [memory, setMemory] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_ADVISOR_MODEL);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memorySaving, setMemorySaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [memoryError, setMemoryError] = useState("");
  const [chatError, setChatError] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/advisor/memory")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load advisor memory.");
        if (active) setMemory(result.memory);
      })
      .catch((error: unknown) => {
        if (active) {
          setMemoryError(error instanceof Error ? error.message : "Could not load advisor memory.");
        }
      })
      .finally(() => {
        if (active) setMemoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, asking, pendingQuestion]);

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemorySaving(true);
    setMemoryError("");
    try {
      const response = await fetch("/api/advisor/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memory }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save advisor memory.");
      setMemory(result.memory);
      toast.success("Advisor memory saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save advisor memory.";
      setMemoryError(message);
      toast.error(message);
    } finally {
      setMemorySaving(false);
    }
  }

  async function askAdvisor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    const nextMessages = [...messages, { role: "user" as const, content: trimmedQuestion }];
    setAsking(true);
    setPendingQuestion(trimmedQuestion);
    setChatError("");
    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-12),
          model: selectedModel,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not get an advisor response.");
      setMessages([
        ...nextMessages,
        { role: "assistant", content: result.answer, truncated: result.truncated },
      ]);
      setQuestion("");
    } catch (error) {
      setQuestion((current) => current || trimmedQuestion);
      setChatError(error instanceof Error ? error.message : "Could not get an advisor response.");
    } finally {
      setPendingQuestion("");
      setAsking(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">AI Advisor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask for read-only help with your schedule, calls, notes, and any type of follow-up.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Ask about your outreach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={conversationRef}
            aria-live="polite"
            className="max-h-[28rem] space-y-3 overflow-y-auto rounded-md border border-border bg-background p-3"
          >
            {messages.length === 0 ? (
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  The advisor can read all of your CRM leads, call/activity notes, tasks, meetings,
                  and completed or pending call, WhatsApp, and meeting follow-ups.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuestion(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "ml-auto bg-navy text-white"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold opacity-75">
                    {message.role === "user" ? "You" : "Advisor"}
                  </p>
                  {message.role === "assistant" ? (
                    <div className="break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                      {message.truncated && (
                        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-foreground">
                          This answer reached the model&apos;s output limit and may be incomplete.
                          Try asking for a shorter answer.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </div>
              ))
            )}
            {asking && (
              <>
                <div className="ml-auto max-w-[90%] rounded-lg bg-navy px-3 py-2 text-sm text-white">
                  <p className="mb-1 text-xs font-semibold opacity-75">You</p>
                  <p className="whitespace-pre-wrap break-words">{pendingQuestion}</p>
                </div>
                <div
                  role="status"
                  aria-label="Advisor is thinking"
                  className="flex max-w-[90%] items-center gap-3 rounded-lg bg-secondary px-3 py-3 text-sm"
                >
                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-muted-foreground">
                      Checking your outreach and preparing an answer
                    </p>
                    <div className="flex gap-1" aria-hidden="true">
                      <span className="h-1.5 w-8 animate-pulse rounded-full bg-primary/70" />
                      <span className="h-1.5 w-8 animate-pulse rounded-full bg-primary/50 [animation-delay:150ms]" />
                      <span className="h-1.5 w-8 animate-pulse rounded-full bg-primary/30 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {chatError && (
            <p role="alert" className="rounded-md bg-rust-soft p-3 text-sm">
              {chatError}
            </p>
          )}
          <form onSubmit={askAdvisor} className="space-y-2">
            <div className="max-w-md space-y-1.5">
              <Label htmlFor="advisor-model">Model</Label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={asking}
              >
                <SelectTrigger id="advisor-model" aria-label="Choose AI model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVISOR_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} · {model.description} ·{" "}
                      {model.priceLabel
                        ? model.priceLabel
                        : `${model.inputPrice === "Free" ? "Free" : `${model.inputPrice} input`} / ${
                            model.outputPrice === "Free"
                              ? "Free"
                              : `${model.outputPrice} output`
                          } per 1M tokens`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Approximate input / output prices per 1 million tokens. Free Ternary Bonsai 27B is
                selected by default. Models marked Experimental may be less reliable.
              </p>
            </div>
            <Textarea
              aria-label="Ask the AI Advisor"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="What do I need to do today?"
              rows={3}
              disabled={asking}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Your CRM data and question are sent to Together AI to generate the answer.
              </p>
              <Button disabled={asking || !question.trim()} className="min-w-24">
                {asking ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Sparkles />
                    Ask
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Context memory</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveMemory} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Write durable instructions, goals, targets, and response preferences. This private
              document is included with each question and can be updated any time.
            </p>
            <Textarea
              aria-label="Advisor context memory"
              value={memory}
              onChange={(event) => setMemory(event.target.value)}
              maxLength={MAX_MEMORY_LENGTH}
              placeholder={"Example:\n- Keep answers concise and use bullet points.\n- My monthly revenue goal is ..."}
              rows={9}
              disabled={memoryLoading}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {memory.length.toLocaleString()} / {MAX_MEMORY_LENGTH.toLocaleString()} characters
              </p>
              <Button disabled={memoryLoading || memorySaving}>
                {memorySaving ? "Saving..." : "Save memory"}
              </Button>
            </div>
          </form>
          {memoryError && (
            <p role="alert" className="mt-3 rounded-md bg-rust-soft p-3 text-sm">
              {memoryError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
