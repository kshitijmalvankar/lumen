"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessagesSquare,
  Send,
  Loader2,
  Lock,
  Sparkles,
  X,
  Minus,
} from "lucide-react";
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

// Persisted dock position as {right, bottom} offsets from the viewport corner.
const POS_KEY = "lumen-chat-dock-pos";
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/**
 * Follow-up chat as a floating, draggable dock so it never lengthens the
 * article scroll. Collapses to a bubble; the expanded panel can be dragged
 * anywhere and remembers where you left it. Free/Pro see a locked upsell.
 */
export function FollowUpChat({
  summaryId,
  initialMessages,
  locked = false,
}: {
  summaryId: string;
  initialMessages: Msg[];
  locked?: boolean;
}) {
  const router = useRouter();

  // false during SSR + the hydration render, true afterwards — lets us portal
  // to <body> (needs `document`) without a hydration mismatch, no effect needed.
  const hydrated = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [open, setOpen] = React.useState(false);
  // Dock position, seeded from localStorage on the client (the initializer runs
  // during the hydration render, where `window` exists; the dock only becomes
  // visible post-hydration, so this can't cause a mismatch).
  const [pos, setPos] = React.useState<{ r: number; b: number }>(() => {
    if (typeof window === "undefined") return { r: 24, b: 24 };
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { r: number; b: number };
        if (typeof p?.r === "number" && typeof p?.b === "number") return p;
      }
    } catch {
      /* ignore malformed storage */
    }
    return { r: 24, b: 24 };
  });
  const dockRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{
    x: number;
    y: number;
    r: number;
    b: number;
    moved: boolean;
  } | null>(null);

  // Chat state.
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const endRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the dock on-screen when the viewport shrinks.
  React.useEffect(() => {
    function onResize() {
      const el = dockRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setPos((p) => ({
        r: clamp(p.r, 8, Math.max(8, window.innerWidth - w - 8)),
        b: clamp(p.b, 8, Math.max(8, window.innerHeight - h - 8)),
      }));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, streaming, open]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const el = dockRef.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, r: pos.r, b: pos.b, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    const el = dockRef.current!;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setPos({
      r: clamp(d.r - dx, 8, Math.max(8, window.innerWidth - w - 8)),
      b: clamp(d.b - dy, 8, Math.max(8, window.innerHeight - h - 8)),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    dockRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (!d.moved) {
      // A tap (not a drag) on the bubble opens the panel.
      if (!open) setOpen(true);
    } else {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    }
  };

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

  if (!hydrated) return null;

  const empty = messages.length === 0 && !streaming;

  const dock = (
    <div
      ref={dockRef}
      className="no-print fixed z-40"
      style={{ right: pos.r, bottom: pos.b }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {!open ? (
        <button
          type="button"
          onPointerDown={onPointerDown}
          aria-label="Open follow-up chat"
          className="glass lift flex h-14 w-14 touch-none items-center justify-center rounded-full text-brand shadow-lg ring-1 ring-brand/25 transition hover:ring-brand/50"
        >
          {locked ? (
            <Lock className="h-5 w-5" />
          ) : (
            <MessagesSquare className="h-5 w-5" />
          )}
        </button>
      ) : (
        <div className="glass flex max-h-[72vh] w-[min(92vw,384px)] flex-col overflow-hidden rounded-2xl shadow-xl ring-1 ring-border/60">
          <div
            onPointerDown={onPointerDown}
            className="flex cursor-grab touch-none items-center gap-2 border-b bg-card/60 px-4 py-2.5 active:cursor-grabbing"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-brand">
              <MessagesSquare className="h-3.5 w-3.5" />
            </span>
            <span className="font-serif text-sm font-semibold tracking-tight">
              Ask a follow-up
            </span>
            <span className="rounded-full border border-brand/30 bg-brand/5 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-brand">
              Max
            </span>
            <button
              data-no-drag
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse chat"
              className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {locked ? (
            <div className="px-5 py-7 text-center">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Lock className="h-4 w-4" />
              </span>
              <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
                Chat with Lumen about this article — ask questions and dig
                deeper, grounded in its sources — with Max.
              </p>
              <Link
                href="/app/upgrade"
                className={cn(buttonVariants({ size: "sm" }), "mt-4")}
              >
                <Sparkles className="h-4 w-4" />
                Unlock with Max
              </Link>
            </div>
          ) : (
            <>
              <div
                className="flex-1 space-y-4 overflow-y-auto px-4 py-3"
                aria-live="polite"
                aria-busy={busy}
              >
                {empty ? (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Ask anything about this article — grounded in its sources.
                      Try one of these:
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {STARTERS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => ask(s)}
                          disabled={busy}
                          className="rounded-full border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/5 hover:text-foreground disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m, i) => (
                      <MessageBubble key={i} role={m.role} content={m.content} />
                    ))}
                    {streaming && (
                      <MessageBubble
                        role="assistant"
                        content={streaming}
                        streaming
                      />
                    )}
                    {busy && !streaming && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-brand" />
                        {note || "Thinking…"}
                      </div>
                    )}
                    <div ref={endRef} />
                  </>
                )}

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 text-sm text-destructive"
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
              </div>

              <form
                onSubmit={onSubmit}
                className="flex items-end gap-2 border-t bg-card/60 p-3"
              >
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
                  className="max-h-32 min-h-11 flex-1 resize-none"
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
            </>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(dock, document.body);
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
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand/10 px-3.5 py-2 text-sm">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2.5">
        <CitationMarkdown markdown={content} variant="compact" />
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand align-middle" />
        )}
      </div>
    </div>
  );
}
