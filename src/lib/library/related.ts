import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RelatedArticle {
  summaryId: string;
  title: string;
  similarity: number;
}

/**
 * Semantic neighbours of an article within the caller's own library, via the
 * `match_related_summaries` RPC (RLS-scoped, excludes the article itself).
 * Returns [] when the library isn't indexed yet — the UI simply hides the strip.
 */
export async function getRelated(
  supabase: SupabaseClient,
  summaryId: string,
  limit = 4,
): Promise<RelatedArticle[]> {
  const { data, error } = await supabase.rpc("match_related_summaries", {
    source_summary_id: summaryId,
    match_count: limit,
  });
  if (error || !data) return [];

  const rows = data as { summary_id: string; similarity: number }[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.summary_id);
  const { data: sums } = await supabase
    .from("summaries")
    .select("id, title")
    .in("id", ids);
  const titleById = new Map(
    (sums ?? []).map((s) => [s.id as string, (s.title as string) ?? "Untitled"]),
  );

  return rows
    .filter((r) => titleById.has(r.summary_id))
    .map((r) => ({
      summaryId: r.summary_id,
      title: titleById.get(r.summary_id) ?? "Untitled",
      similarity: r.similarity,
    }));
}
