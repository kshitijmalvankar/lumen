import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextArticle } from "@/lib/library/ask-core";

interface RetrieveOpts {
  /** Chunks to pull from the vector index. */
  chunks?: number;
  /** Distinct articles to keep. */
  maxArticles?: number;
  /** Passages per article (best chunks). */
  maxPassagesPerArticle?: number;
}

/**
 * Semantic retrieval over the caller's own embedded library. Calls the
 * `match_library_chunks` RPC (RLS-scoped), groups the best chunks by article
 * preserving similarity order, and attaches titles.
 */
export async function retrieveLibrary(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  opts: RetrieveOpts = {},
): Promise<ContextArticle[]> {
  const chunks = opts.chunks ?? 12;
  const maxArticles = opts.maxArticles ?? 5;
  const maxPassages = opts.maxPassagesPerArticle ?? 3;

  const { data, error } = await supabase.rpc("match_library_chunks", {
    query_embedding: queryEmbedding,
    match_count: chunks,
  });
  if (error) throw new Error(`retrieveLibrary: ${error.message}`);

  const rows = (data ?? []) as {
    summary_id: string;
    content: string;
    similarity: number;
  }[];
  if (rows.length === 0) return [];

  // Rows arrive sorted by similarity; group by article, keeping first-seen order.
  const order: string[] = [];
  const byId = new Map<string, string[]>();
  for (const r of rows) {
    let arr = byId.get(r.summary_id);
    if (!arr) {
      arr = [];
      byId.set(r.summary_id, arr);
      order.push(r.summary_id);
    }
    if (arr.length < maxPassages) arr.push(r.content);
  }

  const chosen = order.slice(0, maxArticles);
  const { data: sums } = await supabase
    .from("summaries")
    .select("id, title")
    .in("id", chosen);
  const titleById = new Map(
    (sums ?? []).map((s) => [s.id as string, (s.title as string) ?? "Untitled"]),
  );

  return chosen.map((id) => ({
    summaryId: id,
    title: titleById.get(id) ?? "Untitled",
    passages: byId.get(id) ?? [],
  }));
}
