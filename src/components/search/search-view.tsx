"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  AlertCircle,
  BookOpen,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CitationMarkdown } from "./citation-markdown";
import { CoverageNote } from "./coverage-note";
import { SourceList, type SourceMeta } from "./source-list";
import { BookmarkButton } from "@/components/library/bookmark-button";

type Status = "idle" | "running" | "done" | "error";

interface DoneInfo {
  summaryId: string;
  title: string;
  lengthKind: "paragraph" | "article";
  citationCoverage: number;
}

const EXAMPLES = [
  "AI landscape in India",
  "Latest on GLP-1 weight-loss drugs",
  "Is now a good time to buy bonds?",
  "What is the state of fusion energy?",
];

const PHASES = ["searching", "reading", "writing"] as const;
const PHASE_LABEL: Record<string, string> = {
  searching: "Searching credible sources",
  reading: "Reading the sources",
  writing: "Writing your article",
  cached: "Found a recent result",
};

export function SearchView() {
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [phase, setPhase] = React.useState<string>("");
  const [markdown, setMarkdown] = React.useState("");
  const [sources, setSources] = React.useState<SourceMeta[]>([]);
  const [info, setInfo] = React.useState<DoneInfo | null>(null);
  const [error, setError] = React.useState("");
  const [exampleIdx, setExampleIdx] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);

  // Gently rotate the placeholder example while the field is idle + empty.
  React.useEffect(() => {
    if (status !== "idle" || input) return;
    const id = setInterval(
      () => setExampleIdx((i) => (i + 1) % EXAMPLES.length),
      2800,
    );
    return () => clearInterval(id);
  }, [status, input]);

  const run = React.useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setQuery(trimmed);
    setStatus("running");
    setPhase("searching");
    setMarkdown("");
    setSources([]);
    setInfo(null);
    setError("");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Search failed. Please try again.");
        setStatus("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          switch (evt.type) {
            case "status":
              setPhase(String(evt.phase ?? ""));
              break;
            case "sources":
              setSources((evt.sources as SourceMeta[]) ?? []);
              setPhase("writing");
              break;
            case "delta":
              setMarkdown((m) => m + String(evt.text ?? ""));
              break;
            case "done":
              setInfo(evt as unknown as DoneInfo);
              setStatus("done");
              break;
            case "error":
              setError(String(evt.message ?? "Something went wrong."));
              setStatus("error");
              break;
          }
        }
      }
      // If the stream closed without an explicit done/error, settle gracefully.
      setStatus((s) => (s === "running" ? "done" : s));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Connection lost. Please try again.");
      setStatus("error");
    }
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(input);
  }

  const showResult = status === "running" || status === "done";
  const isRunning = status === "running";
  const isIdle = status === "idle";

  return (
    <div>
      {isIdle && (
        <div className="relative mb-8 flex flex-col items-center pt-10 text-center sm:pt-16">
          {/* soft brand aurora behind the hero */}
          <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 mx-auto h-64 max-w-2xl">
            <div className="aurora-blob animate-float-slow left-4 top-0 h-44 w-44 bg-brand/40" />
            <div className="aurora-blob animate-float-slower right-6 top-6 h-40 w-40 bg-violet-400/40" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Research, distilled
          </span>
          <h1 className="mt-5 max-w-2xl text-balance font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            What do you want to understand?
          </h1>
          <p className="mt-3 max-w-md text-balance text-muted-foreground">
            Lumen reads credible sources and writes one clear, cited article —
            with links to verify every claim.
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="focus-glow relative mx-auto flex max-w-2xl items-center rounded-2xl border bg-card shadow-sm transition-shadow"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isIdle ? `e.g. ${EXAMPLES[exampleIdx]}` : "Search a topic or paste a URL…"
          }
          className="h-14 border-0 bg-transparent pl-12 pr-32 text-base shadow-none focus-visible:ring-0"
          autoFocus
        />
        <Button
          type="submit"
          size="lg"
          disabled={isRunning || input.trim().length < 2}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Search <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {isIdle && (
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => {
                setInput(e);
                run(e);
              }}
              className="rounded-full border bg-card/50 px-3.5 py-1.5 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/5 hover:text-foreground"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {showResult && (
        <div className="mx-auto mt-10 max-w-2xl animate-in fade-in duration-300">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {query}
          </p>

          {isRunning && <PhaseIndicator phase={phase} />}

          {markdown && (
            <div className="mt-5">
              <CitationMarkdown markdown={markdown} />
            </div>
          )}

          {status === "done" && info && (
            <CoverageNote coverage={info.citationCoverage} />
          )}

          <SourceList sources={sources} />

          {status === "done" && info && (
            <>
              <div className="mt-10 flex items-center gap-2 rounded-xl border bg-muted/40 p-3 pl-4">
                <Sparkles className="h-4 w-4 text-brand" />
                <span className="text-sm text-muted-foreground">
                  Saved to your library
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <BookmarkButton
                    summaryId={info.summaryId}
                    initial={false}
                    withLabel
                  />
                  <Link
                    href={`/app/article/${info.summaryId}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    <BookOpen className="h-4 w-4" />
                    Open reader
                  </Link>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Lumen summarizes sources and can be wrong — open the sources to
                verify any claim. Informational only, not professional (medical,
                legal, or financial) advice.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: string }) {
  const activeIdx = PHASES.indexOf(phase as (typeof PHASES)[number]);
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        {PHASE_LABEL[phase] ?? "Working"}…
      </div>
      <div className="flex gap-1.5">
        {PHASES.map((p, i) => {
          const reached = phase === "cached" || i <= Math.max(activeIdx, 0);
          return (
            <span
              key={p}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                reached ? "bg-brand" : "bg-muted",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
