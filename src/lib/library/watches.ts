import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TopicWatch {
  id: string;
  query: string;
  createdAt: string;
}

/** The signed-in user's watched topics, newest first (RLS-scoped). */
export async function listWatches(
  supabase: SupabaseClient,
): Promise<TopicWatch[]> {
  const { data } = await supabase
    .from("topic_watches")
    .select("id, query, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    query: r.query as string,
    createdAt: r.created_at as string,
  }));
}

/**
 * Start watching a topic. Idempotent: the unique (user_id, lower(query)) index
 * rejects case-insensitive duplicates, which we swallow.
 */
export async function addWatch(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<void> {
  const q = query.trim().slice(0, 500);
  if (q.length < 2) return;
  const { error } = await supabase
    .from("topic_watches")
    .insert({ user_id: userId, query: q });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(`addWatch: ${error.message}`);
  }
}

/** Stop watching a topic (RLS scopes the delete to the owner). */
export async function removeWatch(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from("topic_watches").delete().eq("id", id);
}
