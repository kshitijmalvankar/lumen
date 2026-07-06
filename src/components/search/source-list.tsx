"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/url";

export type PoliticalLean =
  | "left"
  | "lean-left"
  | "center"
  | "lean-right"
  | "right"
  | "unknown";

export interface SourceMeta {
  position: number;
  title: string;
  url: string;
  domain: string;
  publishedAt: string | null;
  credibilityTier: "high" | "medium" | "low" | "unknown";
  politicalLean?: PoliticalLean;
  snippet?: string;
}

const TIER_LABEL: Record<SourceMeta["credibilityTier"], string> = {
  high: "High credibility",
  medium: "Medium credibility",
  low: "Unverified",
  unknown: "Unknown",
};

function tierClass(tier: SourceMeta["credibilityTier"]): string {
  switch (tier) {
    case "high":
      return "border-emerald-600/30 text-emerald-700 dark:text-emerald-400";
    case "medium":
      return "border-amber-600/30 text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

const LEAN_LABEL: Record<PoliticalLean, string> = {
  left: "Left",
  "lean-left": "Lean left",
  center: "Center",
  "lean-right": "Lean right",
  right: "Right",
  unknown: "Unknown",
};

function leanClass(lean: PoliticalLean): string {
  switch (lean) {
    case "left":
    case "lean-left":
      return "border-blue-600/30 text-blue-700 dark:text-blue-400";
    case "right":
    case "lean-right":
      return "border-red-600/30 text-red-700 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

export function SourceList({ sources }: { sources: SourceMeta[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-serif text-lg font-semibold tracking-tight">
        Sources{" "}
        <span className="text-muted-foreground">({sources.length})</span>
      </h2>
      <ol className="mt-4 space-y-2.5">
        {sources.map((s) => {
          const date = formatDate(s.publishedAt);
          const safe = isSafeHttpUrl(s.url);
          return (
            <li
              key={s.position}
              id={`source-${s.position}`}
              className="scroll-mt-24 rounded-xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-brand/40"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-xs font-semibold text-brand">
                  {s.position}
                </span>
                <div className="min-w-0 flex-1">
                  {safe ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group flex items-start gap-1 font-medium leading-snug hover:underline"
                    >
                      <span className="line-clamp-2">{s.title}</span>
                      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    // Non-http(s) URL — show the title without a clickable link.
                    <span className="line-clamp-2 font-medium leading-snug">
                      {s.title}
                    </span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{s.domain}</span>
                    {date && <span>· {date}</span>}
                    <Badge
                      variant="outline"
                      className={`h-5 px-1.5 text-[0.65rem] ${tierClass(
                        s.credibilityTier,
                      )}`}
                    >
                      {TIER_LABEL[s.credibilityTier]}
                    </Badge>
                    {s.politicalLean && s.politicalLean !== "unknown" && (
                      <Badge
                        variant="outline"
                        title="Lumen's estimate of the outlet's typical leaning"
                        className={`h-5 px-1.5 text-[0.65rem] ${leanClass(
                          s.politicalLean,
                        )}`}
                      >
                        {LEAN_LABEL[s.politicalLean]}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
