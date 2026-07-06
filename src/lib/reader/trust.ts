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
