import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { SourceMeta } from "@/components/search/source-list";
import { credibilityCounts } from "@/lib/reader/trust";
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

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-card/50 px-4 py-2.5 text-sm backdrop-blur-sm">
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
            <span
              className={cn("h-2 w-2 rounded-full", DOT[t])}
              aria-hidden
            />
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
    </div>
  );
}
