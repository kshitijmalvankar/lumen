"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Send, Loader2, Lock, X, Library } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LibraryMarkdown } from "./library-markdown";
import type { ArticleRef } from "@/lib/library/ask-core";
import type { Tier } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

interface Answer {
  question: string;
  content: string;
  articles: ArticleRef[];
}

const STARTERS = [
  "What themes keep coming up across my reading?",
  "Summarize what I've saved about AI",
  "Where do my sources disagree?",
];

export function AskPanel({ tier }: { tier: Tier }) {
  if (tier === "free") return <AskPanelLocked />;
  return <AskPanelActive />;
}

function AskPanelActive() {
  const [answers, setAnswers] = React.useState<Answer[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState<Answer | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [indexing, setIndexing] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  // On mount, chip through embedding any not-yet-indexed saved articles. Bounded
  // per call; loops a few times so a large library finishes without a huge job.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        try {
          const res = await fetch("/api/library/index", { method: "POST" });
          if (!res.ok) break;
          const data = (await res.json()) as {
            indexed: number;
            remaining: number;
          };
          if (data.remaining > 0) setIndexing(true);
          if (data.remaining <= 0 || data.indexed === 0) break;
        } catch {
          break;
        }
      }
      if (!cancelled) setIndexing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answers, streaming]);

  const ask = React.useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;

      setError("");
      setInput("");
      setBusy(true);
      setStreaming({ question: q, content: "", articles: [] });

      try {
        const res = await fetch("/api/library/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Couldn't get an answer. Please try again.");
          setStreaming(null);
          setBusy(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let content = "";
        let articles: ArticleRef[] = [];

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
            if (evt.type === "articles") {
              articles = (evt.articles as ArticleRef[]) ?? [];
              setStreaming({ question: q, content, articles });
            } else if (evt.type === "delta") {
              content += String(evt.text ?? "");
              setStreaming({ question: q, content, articles });
            } else if (evt.type === "error") {
              setError(String(evt.message ?? "Something went wrong."));
            }
          }
        }

        if (content.trim()) {
          setAnswers((a) => [...a, { question: q, content, articles }]);
        }
      } catch {
        setError("Connection lost. Please try again.");
      } finally {
        setStreaming(null);
        setBusy(false);
      }
    },
    [busy],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const empty = answers.length === 0 && !streaming;

  return (
    <section className="rounded-2xl border bg-card/60 p-4 backdrop-blur-md sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-brand">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Ask your library
        </h2>
        {indexing && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Indexing your library…
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ask a question and Lumen answers across everything you&apos;ve saved,
        citing the articles it drew on.
      </p>

      {!empty && (
        <div className="mt-4 space-y-4" aria-live="polite" aria-busy={busy}>
          {answers.map((a, i) => (
            <QaBlock key={i} answer={a} />
          ))}
          {streaming && <QaBlock answer={streaming} streaming />}
          {busy && !streaming?.content && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              Searching your library…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {empty && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                disabled={busy}
                className="rounded-full border bg-card/50 px-3.5 py-1.5 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/5 hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 text-sm text-destructive"
        >
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="shrink-0 text-destructive/70 transition-colors hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Ask across your saved articles…"
          aria-label="Ask your library a question"
          rows={1}
          disabled={busy}
          className="max-h-40 min-h-11 flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || input.trim().length === 0}
          aria-label="Ask"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </section>
  );
}

function QaBlock({
  answer,
  streaming = false,
}: {
  answer: Answer;
  streaming?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand/10 px-4 py-2.5 text-sm">
          {answer.question}
        </div>
      </div>
      {(answer.content || streaming) && (
        <div className="rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
          <LibraryMarkdown markdown={answer.content} articles={answer.articles} />
          {streaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand align-middle" />
          )}
        </div>
      )}
    </div>
  );
}

/** Locked upsell shown to Free users where the library chat would appear. */
function AskPanelLocked() {
  return (
    <section className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Lock className="h-4 w-4" />
      </span>
      <h2 className="mt-3 flex items-center justify-center gap-2 font-serif text-lg font-semibold tracking-tight">
        <Library className="h-4 w-4 text-brand" />
        Ask your library
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Ask questions across everything you&apos;ve saved — Lumen synthesizes and
        cites the articles it drew on — with Pro.
      </p>
      <Link
        href="/app/upgrade"
        className={cn(buttonVariants({ size: "sm" }), "mt-4")}
      >
        <Sparkles className="h-4 w-4" />
        Unlock with Pro
      </Link>
    </section>
  );
}
