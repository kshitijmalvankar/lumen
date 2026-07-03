import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { tierAtLeast, type Tier } from "@/lib/billing/entitlements";
import { suggestPrompts, type Suggestion } from "@/lib/ai/suggest";
import { getInterests } from "./categorize";

export type { Suggestion };

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_SECONDS = 24 * 60 * 60;
const HOUR_SECONDS = 60 * 60;

/** Personalized suggestions are a Pro/Max perk, and only when personalization is on. */
export function suggestionsEligible(
  tier: Tier,
  personalizationEnabled: boolean,
): boolean {
  return tierAtLeast(tier, "pro") && personalizationEnabled;
}

type SuggestionRow = {
  type: string | null;
  title: string;
  reason: string | null;
  created_at: string;
};

function rowToSuggestion(r: SuggestionRow): Suggestion {
  return {
    kind: r.type === "article" ? "deepen" : "topic",
    prompt: r.title,
    reason: r.reason ?? "",
  };
}

/**
 * The user's personalized next-read prompts. Layered cache keeps generation
 * cheap: Redis (hot) → the `suggestions` table (durable, caps generation at
 * once per 24h even without Redis) → one Haiku call only when both are stale.
 * Callers must gate on suggestionsEligible() first.
 */
export async function getSuggestions(
  supabase: SupabaseClient,
  userId: string,
): Promise<Suggestion[]> {
  const key = `sug:v1:${userId}`;

  const cached = await cacheGet<Suggestion[]>(key);
  if (cached) return cached;

  const { data } = await supabase
    .from("suggestions")
    .select("type, title, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  const rows = (data ?? []) as SuggestionRow[];

  // Durable daily cap: reuse yesterday's rows if they're under 24h old.
  if (rows.length > 0) {
    const newest = new Date(rows[0].created_at).getTime();
    if (Date.now() - newest < DAY_MS) {
      const list = rows.map(rowToSuggestion);
      await cacheSet(key, list, DAY_SECONDS);
      return list;
    }
  }

  // Stale or empty → regenerate (this is the only path that spends an API call).
  let generated: Suggestion[];
  try {
    generated = await generate(supabase, userId);
  } catch (err) {
    console.error("getSuggestions: generation failed:", err);
    return rows.map(rowToSuggestion); // fall back to stale rows (may be empty)
  }

  if (generated.length === 0) {
    // No history yet — cache an empty result briefly so we don't retry per visit.
    await cacheSet(key, [], HOUR_SECONDS);
    return [];
  }

  // Replace the user's cached suggestions.
  await supabase.from("suggestions").delete().eq("user_id", userId);
  await supabase.from("suggestions").insert(
    generated.map((s) => ({
      user_id: userId,
      type: s.kind === "deepen" ? "article" : "topic",
      title: s.prompt,
      reason: s.reason,
    })),
  );
  await cacheSet(key, generated, DAY_SECONDS);
  return generated;
}

async function generate(
  supabase: SupabaseClient,
  userId: string,
): Promise<Suggestion[]> {
  const interests = await getInterests(supabase, userId, 6);
  const { data: recent } = await supabase
    .from("summaries")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(6);
  const recentTitles = (recent ?? [])
    .map((r) => r.title as string)
    .filter(Boolean);

  // Nothing to personalize from yet.
  if (interests.length === 0 && recentTitles.length === 0) return [];

  return suggestPrompts({
    interests: interests.map((i) => i.topic),
    recentTitles,
  });
}
