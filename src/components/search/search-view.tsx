"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Loader2, AlertCircle, BookOpen } from "lucide-react";
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
];

const PHASE_LABEL: Record<string, string> = {
  searching: "Searching credible sources…",
  reading: "Reading the sources…",
  writing: "Writing your article…",
  cached: "Found a recent result…",
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
  const abortRef = React.useRef<AbortController | null>(null);

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

  return (
    <div>
      <form onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search a topic or paste a URL…"
          className="h-12 pl-10 pr-28 text-base"
          autoFocus
        />
        <Button
          type="submit"
          disabled={isRunning || input.trim().length < 2}
          className="absolute right-1.5 top-1/2 -translate-y-1/2"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {status === "idle" && (
        <div className="mt-16 flex flex-col items-center text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            What do you want to understand?
          </h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            Lumen reads credible sources and writes one clear, cited article.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => {
                  setInput(e);
                  run(e);
                }}
                className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="mt-8 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {showResult && (
        <div className="mt-8">
          <p className="text-sm text-muted-foreground">
            {query}
          </p>

          {isRunning && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {PHASE_LABEL[phase] ?? "Working…"}
            </div>
          )}

          {markdown && (
            <div className="mt-4">
              <CitationMarkdown markdown={markdown} />
            </div>
          )}

          {status === "done" && info && <CoverageNote coverage={info.citationCoverage} />}

          <SourceList sources={sources} />

          {status === "done" && info && (
            <>
              <div className="mt-8 flex items-center gap-2 border-t pt-4">
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
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
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
