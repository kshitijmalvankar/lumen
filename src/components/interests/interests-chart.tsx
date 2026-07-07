"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface InterestDatum {
  /** Topic / category name — also the value used to filter the library. */
  label: string;
  /** Relative weight (article count or decayed interest score). */
  value: number;
}

/** Distinct, dark-bg-friendly palette, assigned by rank. */
const PALETTE = [
  "#7c74f2", // brand periwinkle
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#f43f5e", // rose
  "#84cc16", // lime
];
const OTHER_COLOR = "#94a3b8"; // slate — grouped remainder

/** Deterministic slice color for the topic at a given rank. */
export function interestColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

interface Segment {
  label: string;
  value: number;
  fraction: number;
  color: string;
  /** True for the synthetic "Other" bucket — not filterable. */
  isOther?: boolean;
}

function pctLabel(fraction: number): string {
  if (fraction <= 0) return "0%";
  if (fraction < 0.005) return "<1%";
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Interests / topics as an interactive donut + ranked bar legend. Two modes:
 * - `link`: each row links to the library filtered by that topic (settings).
 * - `select`: each row calls `onSelect` to filter in place (library).
 * Dependency-free SVG; respects reduced motion; keyboard-accessible rows.
 */
export function InterestsChart({
  data,
  mode,
  activeLabel = null,
  onSelect,
  hrefBase = "/app/library?topic=",
  size = 168,
  maxItems = 8,
  className,
}: {
  data: InterestDatum[];
  mode: "link" | "select";
  activeLabel?: string | null;
  onSelect?: (label: string | null) => void;
  hrefBase?: string;
  size?: number;
  maxItems?: number;
  className?: string;
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);

  const { segments, topicCount } = React.useMemo(() => {
    const sorted = data
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, d) => s + d.value, 0) || 1;

    let items = sorted;
    let other = 0;
    if (sorted.length > maxItems) {
      items = sorted.slice(0, maxItems - 1);
      other = sorted
        .slice(maxItems - 1)
        .reduce((s, d) => s + d.value, 0);
    }

    const segs: Segment[] = items.map((d, i) => ({
      label: d.label,
      value: d.value,
      fraction: d.value / total,
      color: interestColor(i),
    }));
    if (other > 0) {
      segs.push({
        label: "Other",
        value: other,
        fraction: other / total,
        color: OTHER_COLOR,
        isOther: true,
      });
    }
    return { segments: segs, topicCount: sorted.length };
  }, [data, maxItems]);

  if (segments.length === 0) return null;

  const maxValue = segments[0]?.value || 1;
  const focus = hovered ?? activeLabel;
  const focusSeg = segments.find((s) => s.label === focus) ?? null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7",
        className,
      )}
    >
      <Donut
        segments={segments}
        size={size}
        focus={focus}
        onHover={setHovered}
        centerPrimary={focusSeg ? pctLabel(focusSeg.fraction) : String(topicCount)}
        centerSecondary={
          focusSeg
            ? focusSeg.label
            : topicCount === 1
              ? "topic"
              : "topics"
        }
      />

      <div className="flex w-full min-w-0 flex-col gap-0.5">
        {segments.map((s) => {
          const pct = pctLabel(s.fraction);
          const isActive = activeLabel === s.label;
          const dim = focus != null && focus !== s.label;
          const interactive = !s.isOther;

          const inner = (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="w-20 shrink-0 truncate font-medium sm:w-24">
                {s.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted-foreground/15">
                <span
                  className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${Math.max(6, (s.value / maxValue) * 100)}%`,
                    backgroundColor: s.color,
                  }}
                />
              </span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {pct}
              </span>
            </>
          );

          const rowClass = cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
            dim && "opacity-45",
            isActive
              ? "bg-brand/10 text-brand"
              : interactive && "hover:bg-muted",
          );

          const hoverProps = {
            onMouseEnter: () => setHovered(s.label),
            onMouseLeave: () => setHovered(null),
            onFocus: () => setHovered(s.label),
            onBlur: () => setHovered(null),
          };

          if (!interactive) {
            return (
              <div key={s.label} className={cn(rowClass, "cursor-default")}>
                {inner}
              </div>
            );
          }
          if (mode === "link") {
            return (
              <Link
                key={s.label}
                href={`${hrefBase}${encodeURIComponent(s.label)}`}
                className={rowClass}
                {...hoverProps}
              >
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onSelect?.(isActive ? null : s.label)}
              className={cn(rowClass, "w-full text-left")}
              aria-pressed={isActive}
              {...hoverProps}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Donut({
  segments,
  size,
  focus,
  onHover,
  centerPrimary,
  centerSecondary,
}: {
  segments: Segment[];
  size: number;
  focus: string | null;
  onHover: (label: string | null) => void;
  centerPrimary: string;
  centerSecondary: string;
}) {
  const stroke = Math.round(size * 0.15);
  const cx = size / 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // Precompute each arc's dash + rotational offset so the render map stays pure.
  // The running total lives in the reduce accumulator (no variable reassignment).
  const arcs = React.useMemo(() => {
    const out: { label: string; color: string; dash: number; offset: number }[] =
      [];
    segments.reduce((acc, s) => {
      out.push({
        label: s.label,
        color: s.color,
        dash: Math.max(s.fraction * c - 2, 0),
        offset: -acc * c,
      });
      return acc + s.fraction;
    }, 0);
    return out;
  }, [segments, c]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`Topic breakdown across ${segments.length} topics`}
    >
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-muted-foreground/15"
      />
      <g transform={`rotate(-90 ${cx} ${cx})`}>
        {arcs.map((a) => {
          const dim = focus != null && focus !== a.label;
          return (
            <circle
              key={a.label}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={a.offset}
              className="transition-opacity duration-200 motion-reduce:transition-none"
              style={{ opacity: dim ? 0.25 : 1 }}
              onMouseEnter={() => onHover(a.label)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </g>
      <text
        x={cx}
        y={cx - size * 0.01}
        textAnchor="middle"
        className="fill-current font-serif font-semibold text-foreground"
        style={{ fontSize: size * 0.19 }}
      >
        {centerPrimary}
      </text>
      <text
        x={cx}
        y={cx + size * 0.15}
        textAnchor="middle"
        className="fill-current text-muted-foreground"
        style={{ fontSize: size * 0.08 }}
      >
        {truncate(centerSecondary, 12)}
      </text>
    </svg>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
