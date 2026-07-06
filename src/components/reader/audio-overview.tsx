"use client";

import * as React from "react";
import Link from "next/link";
import { Headphones, Loader2, Sparkles, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Seg {
  index: number;
  url: string | null;
}

interface StatusResp {
  status: "none" | "synthesizing" | "ready" | "error";
  total: number;
  ready: number;
  segments: Seg[];
  error?: string;
}

type Phase = "loading" | "idle" | "working" | "ready" | "error";

/**
 * Max-only audio overview. Drives the staged pipeline: POST /overview to build
 * the script, then POST /overview/segment per chunk (each a fresh serverless
 * invocation), then plays the segments as a gapless playlist. Resumes an
 * in-progress or completed generation on reload.
 */
export function AudioOverview({ summaryId }: { summaryId: string }) {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [segs, setSegs] = React.useState<Seg[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const runningRef = React.useRef(false);

  const apply = React.useCallback((data: StatusResp) => {
    setSegs(data.segments);
    if (data.status === "ready") setPhase("ready");
    else if (data.status === "synthesizing") setPhase("working");
    else if (data.status === "error") {
      setPhase("error");
      setError(data.error ?? "Audio generation failed.");
    } else setPhase("idle");
  }, []);

  const synthMissing = React.useCallback(
    async (list: Seg[]) => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const current = [...list];
        for (const seg of current) {
          if (seg.url) continue;
          const res = await fetch("/api/audio/overview/segment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summaryId, index: seg.index }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error ?? "Synthesis failed.");
            setPhase("error");
            return;
          }
          const i = current.findIndex((s) => s.index === seg.index);
          if (i !== -1) current[i] = { index: seg.index, url: data.url };
          setSegs([...current]);
        }
        setPhase("ready");
      } catch {
        setError("Network error while generating audio.");
        setPhase("error");
      } finally {
        runningRef.current = false;
      }
    },
    [summaryId],
  );

  // Load status on mount; auto-resume an in-progress generation.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/audio/overview?summaryId=${summaryId}`);
        if (!res.ok) {
          if (!cancelled) setPhase("idle");
          return;
        }
        const data: StatusResp = await res.json();
        if (cancelled) return;
        apply(data);
        if (data.status === "synthesizing") synthMissing(data.segments);
      } catch {
        if (!cancelled) setPhase("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [summaryId, apply, synthMissing]);

  async function generate() {
    setPhase("working");
    setError(null);
    try {
      const res = await fetch("/api/audio/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't start audio.");
        setPhase("error");
        toast.error(data.error ?? "Couldn't start audio.");
        return;
      }
      apply(data);
      if (data.status !== "ready") await synthMissing(data.segments);
    } catch {
      setError("Network error.");
      setPhase("error");
    }
  }

  const readyCount = segs.filter((s) => s.url).length;
  const total = segs.length;

  return (
    <section className="mt-10 rounded-2xl border border-border/70 bg-card/50 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Headphones className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            Audio overview
          </h2>
          <p className="text-xs text-muted-foreground">
            A narrated summary you can listen to.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {phase === "loading" && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {phase === "idle" && (
          <Button type="button" onClick={generate}>
            <Sparkles className="h-4 w-4" />
            Generate audio overview
          </Button>
        )}

        {phase === "working" && (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {total > 0
              ? `Synthesizing ${Math.min(readyCount + 1, total)} of ${total}…`
              : "Preparing narration…"}
          </div>
        )}

        {phase === "ready" && <Player segs={segs} />}

        {phase === "error" && (
          <div className="flex flex-col items-start gap-2">
            <p className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              {error ?? "Something went wrong."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={generate}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Player({ segs }: { segs: Seg[] }) {
  const urls = segs
    .filter((s) => s.url)
    .map((s) => s.url as string);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const autoPlay = React.useRef(false);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const a = audioRef.current;
    if (a && autoPlay.current) {
      autoPlay.current = false;
      a.play().catch(() => {});
    }
  }, [idx]);

  function onEnded() {
    const next = idx + 1;
    if (next < urls.length) {
      autoPlay.current = true;
      setIdx(next);
    } else {
      setIdx(0);
    }
  }

  if (urls.length === 0) return null;

  return (
    <div className="space-y-2">
      <audio
        ref={audioRef}
        controls
        src={urls[idx]}
        onEnded={onEnded}
        preload="none"
        className="w-full"
      />
      {urls.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Part {idx + 1} of {urls.length}
        </p>
      )}
    </div>
  );
}

/** Free/Pro upsell teaser for the Max-only audio overview. */
export function AudioOverviewLocked() {
  return (
    <section className="mt-10 rounded-2xl border border-dashed border-border/70 bg-card/40 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Headphones className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            Audio overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Turn any article into a narrated overview you can listen to — on Max.
          </p>
        </div>
        <Link
          href="/app/upgrade"
          className={cn(buttonVariants({ size: "sm" }), "ml-auto shrink-0")}
        >
          <Lock className="h-3.5 w-3.5" />
          Upgrade
        </Link>
      </div>
    </section>
  );
}
