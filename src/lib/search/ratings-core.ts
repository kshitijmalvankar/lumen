import type { CredibilityTier, PoliticalLean } from "./credibility";

// Pure, dependency-light rating helpers — no server-only imports, so they're
// safe to unit-test. Server DB/LLM functions live in ./ratings.

export interface SourceRating {
  credibilityTier: CredibilityTier;
  politicalLean: PoliticalLean;
}

export interface DomainRating extends SourceRating {
  domain: string;
  confidence: number;
}

const TIER_RANK: Record<CredibilityTier, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

/** The stronger of two credibility tiers (the hardcoded floor is never downgraded). */
export function maxTier(a: CredibilityTier, b: CredibilityTier): CredibilityTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

const CREDIBILITY_VALUES = new Set<CredibilityTier>([
  "high",
  "medium",
  "low",
  "unknown",
]);
const LEAN_VALUES = new Set<PoliticalLean>([
  "left",
  "lean-left",
  "center",
  "lean-right",
  "right",
  "unknown",
]);

/**
 * Parse the model's reply into validated domain ratings. Tolerant of code fences
 * and surrounding prose; drops anything with an invalid enum. Pure — unit-tested.
 */
export function parseDomainRatings(raw: string): DomainRating[] {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let arr: unknown;
  try {
    arr = JSON.parse(text);
  } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try {
      arr = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];

  const out: DomainRating[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const domain =
      typeof o.domain === "string"
        ? o.domain.trim().toLowerCase().replace(/^www\./, "")
        : "";
    if (!domain || seen.has(domain)) continue;

    const cred = o.credibility as CredibilityTier;
    const lean = o.lean as PoliticalLean;
    if (!CREDIBILITY_VALUES.has(cred) || !LEAN_VALUES.has(lean)) continue;

    const confRaw = typeof o.confidence === "number" ? o.confidence : 0.5;
    const confidence = Math.max(0, Math.min(1, confRaw));

    seen.add(domain);
    out.push({ domain, credibilityTier: cred, politicalLean: lean, confidence });
  }
  return out;
}
