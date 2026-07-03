"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Lock, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import type { Tier } from "@/lib/billing/entitlements";
import type { Suggestion } from "@/lib/ai/suggest";

type State = "loading" | "ready" | "hidden";

export function SuggestedPrompts({
  tier,
  personalizationEnabled,
  onPick,
  className,
}: {
  tier: Tier;
  personalizationEnabled: boolean;
  onPick: (query: string) => void;
  className?: string;
}) {
  const eligible =
    (tier === "pro" || tier === "max") && personalizationEnabled;

  const [state, setState] = React.useState<State>("loading");
  const [items, setItems] = React.useState<Suggestion[]>([]);

  React.useEffect(() => {
    if (!eligible) return;
    let active = true;
    fetch("/api/suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        const list: Suggestion[] = d?.eligible && Array.isArray(d.suggestions)
          ? d.suggestions
          : [];
        if (list.length > 0) {
          setItems(list);
          setState("ready");
        } else {
          setState("hidden");
        }
      })
      .catch(() => active && setState("hidden"));
    return () => {
      active = false;
    };
  }, [eligible]);

  // Non-eligible → a subtle teaser in the same spot.
  if (!eligible) {
    const isFree = tier === "free";
    return (
      <div className={className}>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-dashed bg-card/40 px-4 py-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-brand" />
          {isFree ? (
            <>
              <span>Get reading suggestions from your history</span>
              <Link
                href="/app/upgrade"
                className="font-medium text-brand hover:underline"
              >
                Upgrade to Pro
              </Link>
            </>
          ) : (
            <>
              <span>Turn on personalization for reading suggestions</span>
              <Link
                href="/app/settings"
                className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Settings
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  if (state === "hidden") return null;

  return (
    <div className={className}>
      <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-brand" />
        Suggested for you
      </p>

      {state === "loading" ? (
        <div className="flex flex-wrap justify-center gap-2">
          {[64, 52, 72, 48].map((w, i) => (
            <span
              key={i}
              className="h-8 animate-pulse rounded-full bg-muted"
              style={{ width: `${w * 3}px` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {items.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPick(s.prompt)}
              title={s.reason || undefined}
              className="group inline-flex items-center gap-1.5 rounded-full border bg-card/50 px-3.5 py-1.5 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/5 hover:text-foreground"
            >
              {s.kind === "deepen" ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-brand/70" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-brand/70" />
              )}
              <span className="max-w-[16rem] truncate">{s.prompt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
