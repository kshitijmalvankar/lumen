import "server-only";
import { getOpenRouter } from "@/lib/ai/openrouter";
import { categorizeModel } from "@/lib/ai/models";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import {
  scoreCredibility,
  rootDomain,
  type CredibilityTier,
  type PoliticalLean,
} from "./credibility";
import {
  maxTier,
  parseDomainRatings,
  type SourceRating,
  type DomainRating,
} from "./ratings-core";

// Re-export the pure helpers so existing importers of "@/lib/search/ratings" work.
export { maxTier, parseDomainRatings };
export type { SourceRating, DomainRating };

function adminAvailable(): boolean {
  return Boolean(env.supabaseServiceRoleKey && env.supabaseUrl);
}

/**
 * Fast, **LLM-free** rating for a set of domains: the `source_ratings` table
 * (via the admin client) merged over the hardcoded allowlist floor
 * ([credibility.ts]). Always returns an entry per input domain (floor at minimum),
 * so it's safe to call inline during a search. A known-High outlet is never
 * downgraded by a table/LLM value.
 */
export async function rateSourcesFast(
  domains: string[],
): Promise<Map<string, SourceRating>> {
  const uniq = [...new Set(domains.filter(Boolean))];
  const out = new Map<string, SourceRating>();
  for (const d of uniq) {
    out.set(d, { credibilityTier: scoreCredibility(d), politicalLean: "unknown" });
  }
  if (!adminAvailable() || uniq.length === 0) return out;

  // Look up both the exact domain and its root, so subdomains (edition.cnn.com)
  // still match a seeded root (cnn.com).
  const keys = new Set<string>();
  for (const d of uniq) {
    keys.add(d);
    keys.add(rootDomain(d));
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("source_ratings")
      .select("domain, credibility_tier, political_lean")
      .in("domain", [...keys]);

    const byDomain = new Map<string, SourceRating>();
    for (const r of data ?? []) {
      byDomain.set(r.domain as string, {
        credibilityTier: r.credibility_tier as CredibilityTier,
        politicalLean: r.political_lean as PoliticalLean,
      });
    }

    for (const d of uniq) {
      const hit = byDomain.get(d) ?? byDomain.get(rootDomain(d));
      if (!hit) continue;
      const floor = out.get(d)!.credibilityTier;
      out.set(d, {
        credibilityTier: maxTier(floor, hit.credibilityTier),
        politicalLean: hit.politicalLean,
      });
    }
  } catch (err) {
    console.error("rateSourcesFast: table read failed; using floor only:", err);
  }

  return out;
}

/**
 * Of the given domains, which are NOT yet present in `source_ratings` (by exact
 * or root domain)? Used to decide what still needs an LLM pass — a domain the LLM
 * judged "unknown" (non-political) is still *present*, so it won't be re-classified.
 */
export async function findUnclassifiedDomains(
  domains: string[],
): Promise<string[]> {
  const uniq = [...new Set(domains.filter(Boolean))];
  if (!adminAvailable() || uniq.length === 0) return [];

  const keys = new Set<string>();
  for (const d of uniq) {
    keys.add(d);
    keys.add(rootDomain(d));
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("source_ratings")
      .select("domain")
      .in("domain", [...keys]);
    const present = new Set((data ?? []).map((r) => r.domain as string));
    return uniq.filter((d) => !present.has(d) && !present.has(rootDomain(d)));
  } catch (err) {
    console.error("findUnclassifiedDomains:", err);
    return [];
  }
}

const CLASSIFY_SYSTEM = `You rate news / information source domains. For each domain, estimate:
- "credibility": "high" (established outlets, wire services, peer-reviewed journals, official gov/edu), "medium" (generally reliable but opinion-heavy or mixed), or "low" (tabloid, hyper-partisan, or unreliable).
- "lean": political leaning on a GLOBAL, generic left–right spectrum — one of "left", "lean-left", "center", "lean-right", "right", or "unknown" if it isn't a political/news outlet or is genuinely unclear.
- "confidence": 0.0 to 1.0.
Judge the outlet's typical editorial stance overall, not any single article. Be neutral and consistent. Reply with ONLY a JSON array of {"domain","credibility","lean","confidence"} — no prose, no code fences.`;

/** One batched Haiku call classifying a list of domains. Callers cache the result. */
export async function classifyDomains(
  domains: string[],
): Promise<DomainRating[]> {
  const uniq = [...new Set(domains.filter(Boolean))];
  if (uniq.length === 0) return [];

  const user = `Domains:\n${uniq.map((d) => `- ${d}`).join("\n")}\n\nJSON:`;
  const res = await getOpenRouter().chat.completions.create({
    model: categorizeModel(),
    messages: [
      { role: "system", content: CLASSIFY_SYSTEM },
      { role: "user", content: user },
    ],
    max_tokens: 1000,
  });

  return parseDomainRatings(res.choices?.[0]?.message?.content ?? "");
}

/** Persist LLM ratings into the shared table (never clobbers seed/existing rows). */
export async function upsertRatings(ratings: DomainRating[]): Promise<void> {
  if (!adminAvailable() || ratings.length === 0) return;
  const now = new Date().toISOString();
  const rows = ratings.map((r) => ({
    domain: r.domain,
    credibility_tier: r.credibilityTier,
    political_lean: r.politicalLean,
    confidence: r.confidence,
    rated_by: "llm",
    rated_at: now,
    updated_at: now,
  }));
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("source_ratings")
      .upsert(rows, { onConflict: "domain", ignoreDuplicates: true });
    if (error) console.error("upsertRatings:", error.message);
  } catch (err) {
    console.error("upsertRatings failed:", err);
  }
}
