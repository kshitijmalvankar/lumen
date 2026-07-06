import type { SupabaseClient } from "@supabase/supabase-js";
import { TIER_LIMITS, type Tier } from "@/lib/billing/entitlements";

/**
 * Collections group saved articles into named buckets. They're stored in the
 * `tags` / `search_tags` tables (a collection = a tag, membership = a search_tag)
 * — repurposing tables that already exist with RLS, so no schema migration.
 * Membership keys on `search_id` (each summary has exactly one search).
 */

export interface Collection {
  id: string;
  name: string;
}

export interface CollectionWithCount extends Collection {
  count: number;
}

/** Raised when a free user hits their collection cap. */
export class CollectionLimitError extends Error {}

/** All of the user's collections with article counts, ordered A→Z. */
export async function listCollections(
  supabase: SupabaseClient,
): Promise<CollectionWithCount[]> {
  const { data: tags, error } = await supabase
    .from("tags")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(`listCollections: ${error.message}`);

  const { data: members } = await supabase.from("search_tags").select("tag_id");
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    const id = m.tag_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return (tags ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    count: counts.get(t.id as string) ?? 0,
  }));
}

/** Map of searchId → collection ids, for filtering the library. */
export async function getCollectionMembership(
  supabase: SupabaseClient,
): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from("search_tags")
    .select("search_id, tag_id");
  const map: Record<string, string[]> = {};
  for (const r of data ?? []) {
    const s = r.search_id as string;
    (map[s] ??= []).push(r.tag_id as string);
  }
  return map;
}

/** Collection ids a single article (by searchId) belongs to. */
export async function getArticleCollectionIds(
  supabase: SupabaseClient,
  searchId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("search_tags")
    .select("tag_id")
    .eq("search_id", searchId);
  return (data ?? []).map((r) => r.tag_id as string);
}

/**
 * Create a collection (or return the existing one with the same name). Enforces
 * the per-tier cap for brand-new collections.
 */
export async function createCollection(
  supabase: SupabaseClient,
  userId: string,
  tier: Tier,
  name: string,
): Promise<Collection> {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error("Enter a collection name.");

  // Reuse an existing same-name collection (case-insensitive) instead of erroring.
  const { data: existing } = await supabase
    .from("tags")
    .select("id, name")
    .ilike("name", clean)
    .limit(1);
  const found = existing?.[0];
  if (found) return { id: found.id as string, name: found.name as string };

  const cap = TIER_LIMITS[tier].collections;
  if (Number.isFinite(cap)) {
    const { count } = await supabase
      .from("tags")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) >= cap) {
      throw new CollectionLimitError(
        `The Free plan is limited to ${cap} collections. Upgrade for unlimited collections.`,
      );
    }
  }

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: userId, name: clean })
    .select("id, name")
    .single();
  if (error) throw new Error(`createCollection: ${error.message}`);
  return { id: data.id as string, name: data.name as string };
}

/** Add an article (by searchId) to a collection. Idempotent. */
export async function addToCollection(
  supabase: SupabaseClient,
  userId: string,
  searchId: string,
  collectionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("search_tags")
    .upsert(
      { user_id: userId, search_id: searchId, tag_id: collectionId },
      { onConflict: "search_id,tag_id" },
    );
  if (error) throw new Error(`addToCollection: ${error.message}`);
}

/** Remove an article (by searchId) from a collection. */
export async function removeFromCollection(
  supabase: SupabaseClient,
  searchId: string,
  collectionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("search_tags")
    .delete()
    .eq("search_id", searchId)
    .eq("tag_id", collectionId);
  if (error) throw new Error(`removeFromCollection: ${error.message}`);
}
