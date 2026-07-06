import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedArticle } from "@/lib/ai/parse";
import type { PreparedSource, InputType } from "@/lib/search/pipeline";

function toIso(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function createSearch(
  supabase: SupabaseClient,
  args: {
    userId: string;
    query: string;
    normalizedQuery: string;
    inputType: InputType;
    mode: "quick" | "deep";
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("searches")
    .insert({
      user_id: args.userId,
      query: args.query,
      normalized_query: args.normalizedQuery,
      input_type: args.inputType,
      mode: args.mode,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw new Error(`createSearch: ${error.message}`);
  return data.id as string;
}

export async function markSearchError(
  supabase: SupabaseClient,
  searchId: string,
  message: string,
) {
  await supabase
    .from("searches")
    .update({ status: "error", error: message.slice(0, 500) })
    .eq("id", searchId);
}

/**
 * Persist a completed generation: summary + sources + blocks + per-block
 * citations, then mark the search done. Returns the new summary id.
 *
 * Inserts run sequentially under the user's session (RLS enforces ownership).
 */
export async function persistResult(
  supabase: SupabaseClient,
  args: {
    userId: string;
    searchId: string;
    article: ParsedArticle;
    sources: PreparedSource[];
    modelUsed: string;
    aiAnalysis?: string | null;
  },
): Promise<string> {
  const { userId, searchId, article, sources, modelUsed, aiAnalysis } = args;

  const { data: summary, error: sumErr } = await supabase
    .from("summaries")
    .insert({
      search_id: searchId,
      user_id: userId,
      title: article.title,
      model_used: modelUsed,
      length_kind: article.lengthKind,
      citation_coverage: article.citationCoverage,
      ai_analysis: aiAnalysis ?? null,
    })
    .select("id")
    .single();
  if (sumErr) throw new Error(`persist summary: ${sumErr.message}`);
  const summaryId = summary.id as string;

  // Sources, ordered by their [n] position.
  const { data: insertedSources, error: srcErr } = await supabase
    .from("sources")
    .insert(
      sources.map((s) => ({
        summary_id: summaryId,
        user_id: userId,
        position: s.position,
        url: s.url,
        title: s.title,
        domain: s.domain,
        published_at: toIso(s.publishedAt),
        credibility_tier: s.credibilityTier,
        political_lean: s.politicalLean,
        snippet: s.snippet,
      })),
    )
    .select("id, position");
  if (srcErr) throw new Error(`persist sources: ${srcErr.message}`);

  const sourceIdByPosition = new Map<number, string>();
  (insertedSources ?? []).forEach((s) =>
    sourceIdByPosition.set(s.position as number, s.id as string),
  );

  // Blocks, in order.
  const { data: insertedBlocks, error: blkErr } = await supabase
    .from("summary_blocks")
    .insert(
      article.blocks.map((b) => ({
        summary_id: summaryId,
        user_id: userId,
        position: b.position,
        type: b.type,
        content: b.content,
      })),
    )
    .select("id, position");
  if (blkErr) throw new Error(`persist blocks: ${blkErr.message}`);

  const blockIdByPosition = new Map<number, string>();
  (insertedBlocks ?? []).forEach((b) =>
    blockIdByPosition.set(b.position as number, b.id as string),
  );

  // Per-block citations (only valid source references).
  const citationRows = article.blocks.flatMap((b) => {
    const blockId = blockIdByPosition.get(b.position);
    if (!blockId) return [];
    return b.citedPositions
      .map((pos) => sourceIdByPosition.get(pos))
      .filter((sid): sid is string => Boolean(sid))
      .map((sourceId) => ({
        block_id: blockId,
        source_id: sourceId,
        user_id: userId,
        cited_text: null as string | null,
      }));
  });

  if (citationRows.length > 0) {
    const { error: citErr } = await supabase
      .from("block_citations")
      .insert(citationRows);
    if (citErr) throw new Error(`persist citations: ${citErr.message}`);
  }

  await supabase.from("searches").update({ status: "done" }).eq("id", searchId);

  return summaryId;
}
