"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SourceMeta {
  position: number;
  title: string;
  url: string;
  domain: string;
  publishedAt: string | null;
  credibilityTier: "high" | "medium" | "low" | "unknown";
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

function formatDate(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SourceList({ sources }: { sources: SourceMeta[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
        Sources ({sources.length})
      </h2>
      <ol className="mt-3 space-y-2">
        {sources.map((s) => {
          const date = formatDate(s.publishedAt);
          return (
            <li
              key={s.position}
              id={`source-${s.position}`}
              className="scroll-mt-20 rounded-lg border p-3 transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                  {s.position}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex items-start gap-1 font-medium leading-snug hover:underline"
                  >
                    <span className="line-clamp-2">{s.title}</span>
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
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
