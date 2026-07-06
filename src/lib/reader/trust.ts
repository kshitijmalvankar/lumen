import type { PoliticalLean } from "@/lib/search/credibility";

export type CredibilityTier = "high" | "medium" | "low" | "unknown";

export interface CredibilityCounts {
  high: number;
  medium: number;
  low: number;
  unknown: number;
}

/** Tally sources by credibility tier — the Trust Panel's histogram. */
export function credibilityCounts(
  sources: { credibilityTier: CredibilityTier }[],
): CredibilityCounts {
  const counts: CredibilityCounts = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const s of sources) counts[s.credibilityTier] += 1;
  return counts;
}

export interface LeanBalance {
  left: number;
  center: number;
  right: number;
  /** Sources with a known lean (left + center + right). */
  rated: number;
  /** One-line characterization of the source mix. */
  label: string;
}

/**
 * Collapse per-source lean into a left/center/right balance for the meter.
 * lean-left folds into left, lean-right into right; unknown is uncounted.
 */
export function leanBalance(
  sources: { politicalLean?: PoliticalLean }[],
): LeanBalance {
  let left = 0;
  let center = 0;
  let right = 0;
  for (const s of sources) {
    const l = s.politicalLean;
    if (l === "left" || l === "lean-left") left += 1;
    else if (l === "right" || l === "lean-right") right += 1;
    else if (l === "center") center += 1;
  }
  const rated = left + center + right;

  let label = "Balanced mix";
  if (rated > 0) {
    if (left > center + right) label = "Mostly left-leaning";
    else if (right > left + center) label = "Mostly right-leaning";
    else if (left > right) label = "Leans left";
    else if (right > left) label = "Leans right";
  }

  return { left, center, right, rated, label };
}
