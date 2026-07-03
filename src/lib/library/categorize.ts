import type { SupabaseClient } from "@supabase/supabase-js";
import { pickCategory } from "@/lib/ai/categorize";

// Curated starter taxonomy. The AI classifies into these (or the user's own
// existing categories) and only invents a new one when nothing fits — so the
// set stays consistent but can still grow.
export const STARTER_CATEGORIES = [
  "AI",
  "Technology",
  "Finance",
  "Business",
  "Health",
  "Science",
  "Politics",
  "World",
  "Culture",
  "Sports",
];

interface CategoryRow {
  id: string;
  name: string;
}

function matchExisting(name: string, existing: CategoryRow[]): string | null {
  const n = name.toLowerCase();
  return existing.find((c) => c.name.toLowerCase() === n)?.id ?? null;
}

/**
 * Categorize one completed search: pick a topic, reconcile it against the
 * user's existing categories (reuse or create), link it via `search_categories`,
 * and bump the interest profile. Best-effort — callers ignore failures.
 */
export async function categorizeSearch(
  supabase: SupabaseClient,
  args: { userId: string; searchId: string; title: string; query: string },
): Promise<void> {
  const { userId, searchId, title, query } = args;

  const { data: cats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId);
  const existing = (cats ?? []) as CategoryRow[];

  const candidates = Array.from(
    new Set([...existing.map((c) => c.name), ...STARTER_CATEGORIES]),
  );
  const picked = await pickCategory({ title, query, candidates });
  if (!picked) return;

  // Reuse an existing category (case-insensitive) or create a new one.
  let categoryId = matchExisting(picked, existing);
  if (!categoryId) {
    const { data: created, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name: picked })
      .select("id")
      .single();
    if (error) {
      // Unique (user_id, name) race — fetch the one that won.
      const { data: again } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", picked)
        .maybeSingle();
      categoryId = (again?.id as string | undefined) ?? null;
    } else {
      categoryId = created.id as string;
    }
  }
  if (!categoryId) return;

  await supabase.from("search_categories").upsert(
    { search_id: searchId, category_id: categoryId, user_id: userId, confidence: 1 },
    { onConflict: "search_id,category_id" },
  );

  await bumpInterest(supabase, userId, picked);
}

/** Time-decayed interest bump — skipped when the user disabled personalization. */
async function bumpInterest(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
): Promise<void> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("personalization_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (prof && prof.personalization_enabled === false) return;

  const { data: existing } = await supabase
    .from("interest_profile")
    .select("weight")
    .eq("user_id", userId)
    .eq("topic", topic)
    .maybeSingle();

  const weight = ((existing?.weight as number | undefined) ?? 0) + 1;
  await supabase.from("interest_profile").upsert(
    { user_id: userId, topic, weight, last_seen_at: new Date().toISOString() },
    { onConflict: "user_id,topic" },
  );
}

export interface Interest {
  topic: string;
  score: number; // time-decayed weight (higher = stronger current interest)
}

const INTEREST_HALFLIFE_DAYS = 30;

/** Top interests, weighted with a 30-day half-life so stale ones fade. */
export async function getInterests(
  supabase: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<Interest[]> {
  const { data } = await supabase
    .from("interest_profile")
    .select("topic, weight, last_seen_at")
    .eq("user_id", userId);

  const now = Date.now();
  return (data ?? [])
    .map((r) => {
      const days =
        (now - new Date(r.last_seen_at as string).getTime()) / 86_400_000;
      const decay = Math.pow(0.5, days / INTEREST_HALFLIFE_DAYS);
      return { topic: r.topic as string, score: ((r.weight as number) ?? 0) * decay };
    })
    .filter((i) => i.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Whether the user has personalization (interest tracking) enabled. */
export async function getPersonalizationEnabled(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("personalization_enabled")
    .eq("id", userId)
    .maybeSingle();
  return data?.personalization_enabled !== false;
}

/**
 * One-time backfill: categorize the user's existing summaries that have no
 * category yet. Bounded so a single request stays cheap. Returns how many it
 * processed.
 */
export async function backfillUncategorized(
  supabase: SupabaseClient,
  userId: string,
  max = 25,
): Promise<number> {
  const { data: summaries } = await supabase
    .from("summaries")
    .select("title, searches!inner(id, query)")
    .order("created_at", { ascending: false })
    .limit(60);

  const { data: catRows } = await supabase
    .from("search_categories")
    .select("search_id");
  const done = new Set((catRows ?? []).map((r) => r.search_id as string));

  let count = 0;
  for (const s of summaries ?? []) {
    const row = s as { title: string; searches: unknown };
    const search = (
      Array.isArray(row.searches) ? row.searches[0] : row.searches
    ) as { id: string; query: string } | null;
    if (!search || done.has(search.id)) continue;
    try {
      await categorizeSearch(supabase, {
        userId,
        searchId: search.id,
        title: row.title,
        query: search.query,
      });
    } catch {
      // best-effort; skip failures
    }
    if (++count >= max) break;
  }
  return count;
}
