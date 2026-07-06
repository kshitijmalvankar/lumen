import { ShieldCheck, ShieldAlert, Scale } from "lucide-react";
import type { SourceMeta } from "@/components/search/source-list";
import { credibilityCounts, leanBalance } from "@/lib/reader/trust";
import { RatingsInfo } from "@/components/reader/ratings-info";
import { cn } from "@/lib/utils";

type Tier = SourceMeta["credibilityTier"];

// Colors mirror the source badge semantics in source-list.tsx.
const DOT: Record<Tier, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground/50",
  unknown: "bg-muted-foreground/40",
};
const LABEL: Record<Tier, string> = {
  high: "High",
  medium: "Medium",
  low: "Unverified",
  unknown: "Unknown",
};
const ORDER: Tier[] = ["high", "medium", "low", "unknown"];

/**
 * Leads the article with a credibility summary: how the sources break down by
 * trust tier + how much of the article is actually backed by citations. This is
 * the "show your work" differentiator — surfaced up front instead of buried.
 */
export function TrustPanel({
  sources,
  citationCoverage,
}: {
  sources: SourceMeta[];
  citationCoverage: number | null;
}) {
  if (sources.length === 0) return null;

  const counts = credibilityCounts(sources);
  const shown = ORDER.filter((t) => counts[t] > 0);

  const pct =
    citationCoverage != null ? Math.round(citationCoverage * 100) : null;
  const limited = pct != null && pct < 50;
  const trusted = counts.high / sources.length >= 0.5 && !limited;

  const balance = leanBalance(sources);

  return (
    <div className="mt-5 flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card/50 px-4 py-2.5 text-sm backdrop-blur-sm">
      {/* Row 1 — credibility + citation coverage */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 font-medium">
          {trusted ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          Source trust
        </span>

        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />

        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {shown.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", DOT[t])} aria-hidden />
              <span className="tabular-nums text-foreground">{counts[t]}</span>
              {LABEL[t]}
            </span>
          ))}
        </span>

        {pct != null && (
          <>
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                limited
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              <span className="tabular-nums text-foreground">{pct}%</span>
              of claims cited
            </span>
          </>
        )}

        <span className="ml-auto">
          <RatingsInfo />
        </span>
      </div>

      {/* Row 2 — political balance meter (only when we have known leans) */}
      {balance.rated > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-2.5">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Scale className="h-4 w-4 text-muted-foreground" />
            {balance.label}
          </span>

          <BalanceBar
            left={balance.left}
            center={balance.center}
            right={balance.right}
          />

          <span className="text-xs tabular-nums text-muted-foreground">
            {balance.left}L · {balance.center}C · {balance.right}R
          </span>
          <span className="text-[0.7rem] text-muted-foreground/70">
            lean — Lumen&apos;s estimate
          </span>
        </div>
      )}
    </div>
  );
}

/** A slim left/center/right stacked bar of the source mix. */
function BalanceBar({
  left,
  center,
  right,
}: {
  left: number;
  center: number;
  right: number;
}) {
  const total = left + center + right || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <span
      className="flex h-2 w-28 overflow-hidden rounded-full bg-muted"
      aria-hidden
    >
      <span className="bg-blue-500/70" style={{ width: pct(left) }} />
      <span className="bg-muted-foreground/40" style={{ width: pct(center) }} />
      <span className="bg-red-500/70" style={{ width: pct(right) }} />
    </span>
  );
}
