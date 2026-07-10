"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, X, Plus, Loader2, ArrowUpRight, Compass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuggestedPrompts } from "@/components/suggestions/suggested-prompts";
import { addWatchAction, removeWatchAction } from "@/app/app/discover/actions";
import type { TopicWatch } from "@/lib/library/watches";
import type { Tier } from "@/lib/billing/entitlements";

export function DiscoverView({
  initialWatches,
  tier,
  personalizationEnabled,
  emailConfigured,
}: {
  initialWatches: TopicWatch[];
  tier: Tier;
  personalizationEnabled: boolean;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [watches, setWatches] = React.useState(initialWatches);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    try {
      setWatches(await addWatchAction(q));
      setInput("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setWatches((w) => w.filter((x) => x.id !== id));
    try {
      setWatches(await removeWatchAction(id));
    } catch {
      // optimistic removal stands; a refresh will reconcile
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
          <Compass className="h-4 w-4" />
        </span>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Discover
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Track topics you care about. {emailConfigured
          ? "You'll get a weekly email digest of what's worth a fresh look."
          : "Revisit them any time to research the latest."}
      </p>

      <section className="mt-6 rounded-2xl border bg-card/60 p-5 backdrop-blur-md">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight">
          <Eye className="h-4 w-4 text-brand" />
          Topics you&apos;re tracking
        </h2>

        <form onSubmit={add} className="mt-4 flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a topic to watch — e.g. GLP-1 drugs"
            aria-label="Add a topic to watch"
            disabled={busy}
          />
          <Button type="submit" disabled={busy || input.trim().length < 2}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Watch</span>
          </Button>
        </form>

        {watches.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No topics yet. Add one above, or tap “Track topic” after any search.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {watches.map((w) => (
              <li
                key={w.id}
                className="group flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 p-2.5 pl-4"
              >
                <Link
                  href={`/app?q=${encodeURIComponent(w.query)}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium transition-colors hover:text-brand"
                >
                  <span className="truncate">{w.query}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-brand" />
                </Link>
                <button
                  type="button"
                  onClick={() => remove(w.id)}
                  aria-label={`Stop watching ${w.query}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SuggestedPrompts
        tier={tier}
        personalizationEnabled={personalizationEnabled}
        onPick={(q) => router.push(`/app?q=${encodeURIComponent(q)}`)}
        className="mt-8 border-t pt-8"
      />
    </div>
  );
}
