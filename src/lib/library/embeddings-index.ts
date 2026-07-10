import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "@/lib/ai/embeddings";
import { blocksToMarkdown } from "@/lib/library/queries";
import { chunkArticle } from "@/lib/library/chunk";

/**
 * (Re)build the embedding rows for one saved article. Idempotent: deletes any
 * existing chunks for the summary, then inserts fresh ones. Runs with the
 * caller's session (RLS scopes writes to the owner). No-op if there's no text.
 */
export async function indexSummary(
  supabase: SupabaseClient,
  userId: string,
  summaryId: string,
): Promise<number> {
  const { data: blocksData } = await supabase
    .from("summary_blocks")
    .select("type, content, position")
    .eq("summary_id", summaryId)
    .order("position", { ascending: true });

  const blocks = (blocksData ?? []) as Array<{
    type: "text" | "heading";
    content: string;
  }>;
  const markdown = blocksToMarkdown(blocks);
  const chunks = chunkArticle(markdown);
  if (chunks.length === 0) return 0;

  const vectors = await embed(
    chunks.map((c) => c.content),
    "retrieval.passage",
  );

  const rows = chunks
    .map((c, i) => ({
      summary_id: summaryId,
      user_id: userId,
      chunk_index: c.index,
      content: c.content,
      embedding: vectors[i],
      token_count: c.tokenCount,
    }))
    .filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0);
  if (rows.length === 0) return 0;

  // Delete-then-insert keeps the (summary_id, chunk_index) unique index happy on
  // re-index and drops stale chunks if the article shrank.
  await supabase.from("summary_embeddings").delete().eq("summary_id", summaryId);
  const { error } = await supabase.from("summary_embeddings").insert(rows);
  if (error) throw new Error(`indexSummary: ${error.message}`);
  return rows.length;
}

/**
 * Bounded backfill: embed the caller's saved articles that aren't indexed yet.
 * Mirrors backfillUncategorized — cheap per run, called when the library opens.
 * Returns { indexed, remaining } so the UI can show progress and re-run.
 */
export async function backfillEmbeddings(
  supabase: SupabaseClient,
  userId: string,
  max = 10,
): Promise<{ indexed: number; remaining: number }> {
  const { data: summaries } = await supabase
    .from("summaries")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(300);

  const { data: indexedRows } = await supabase
    .from("summary_embeddings")
    .select("summary_id");
  const indexed = new Set((indexedRows ?? []).map((r) => r.summary_id as string));

  const pending = (summaries ?? [])
    .map((s) => s.id as string)
    .filter((id) => !indexed.has(id));

  let done = 0;
  for (const id of pending) {
    if (done >= max) break;
    try {
      await indexSummary(supabase, userId, id);
      done++;
    } catch {
      // best-effort; skip failures (e.g. transient embedding errors)
    }
  }
  return { indexed: done, remaining: Math.max(0, pending.length - done) };
}
