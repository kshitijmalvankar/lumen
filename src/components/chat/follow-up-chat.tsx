"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessagesSquare, Send, Loader2, Lock, Sparkles, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CitationMarkdown } from "@/components/search/citation-markdown";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Summarize the key takeaways",
  "What are the strongest counterpoints?",
  "Explain this like I'm new to the topic",
];

export function FollowUpChat({
  summaryId,
  initialMessages,
}: {
  summaryId: string;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, streaming]);

  const ask = React.useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;

      setError("");
      setInput("");
      setMessages((m) => [...m, { role: "user", content: q }]);
      setBusy(true);
      setStreaming("");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summaryId, message: q }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Couldn't get an answer. Please try again.");
          setBusy(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let answer = "";
        let refreshNeeded = false;

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
            if (evt.type === "delta") {
              answer += String(evt.text ?? "");
              setStreaming(answer);
            } else if (evt.type === "status") {
              setNote(String(evt.message ?? ""));
            } else if (evt.type === "sources_added") {
              refreshNeeded = true;
            } else if (evt.type === "error") {
              setError(String(evt.message ?? "Something went wrong."));
            }
          }
        }

        if (answer.trim()) {
          setMessages((m) => [...m, { role: "assistant", content: answer }]);
        }
        // New sources were appended to the article — refresh so the Sources
        // list (and citations) reflect them.
        if (refreshNeeded) router.refresh();
      } catch {
        setError("Connection lost. Please try again.");
      } finally {
        setNote("");
        setStreaming("");
        setBusy(false);
      }
    },
    [busy, summaryId, router],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const empty = messages.length === 0 && !streaming;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-brand">
          <MessagesSquare className="h-3.5 w-3.5" />
        </span>
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Ask a follow-up
        </h2>
        <span className="ml-1 rounded-full border border-brand/30 bg-brand/5 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-brand">
          Max
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Chat with Lumen about this article — grounded in the sources above.
      </p>

      {!empty && (
        <div
          className="mt-4 space-y-4"
          aria-live="polite"
          aria-busy={busy}
        >
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {streaming && (
            <MessageBubble role="assistant" content={streaming} streaming />
          )}
          {busy && !streaming && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              {note || "Thinking…"}
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {empty && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Ask anything about this article — try one of these to start:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
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
          placeholder="Ask anything about this article…"
          aria-label="Ask a follow-up question"
          rows={1}
          disabled={busy}
          className="max-h-40 min-h-11 flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || input.trim().length === 0}
          aria-label="Send"
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

function MessageBubble({
  role,
  content,
  streaming = false,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand/10 px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
        <CitationMarkdown markdown={content} />
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand align-middle" />
        )}
      </div>
    </div>
  );
}

/** Locked upsell shown to Free/Pro users where the chat would appear. */
export function FollowUpChatLocked() {
  return (
    <section className="mt-12 rounded-2xl border border-dashed bg-muted/30 p-6 text-center">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Lock className="h-4 w-4" />
      </span>
      <h2 className="mt-3 font-serif text-lg font-semibold tracking-tight">
        Ask a follow-up
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Chat with Lumen about any article — ask questions and dig deeper, grounded
        in its sources — with Max.
      </p>
      <Link
        href="/app/upgrade"
        className={cn(buttonVariants({ size: "sm" }), "mt-4")}
      >
        <Sparkles className="h-4 w-4" />
        Unlock with Max
      </Link>
    </section>
  );
}
