import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparedSource } from "@/lib/search/pipeline";
import { isEmbeddingsConfigured } from "@/lib/env";
import { indexSummary } from "@/lib/library/embeddings-index";
import { buildMessages } from "@/lib/ai/prompts";
import { streamSummary } from "@/lib/ai/summarize";
import { parseArticle } from "@/lib/ai/parse";
import { resolveFormat } from "@/lib/ai/formats";
import { modelSlug, isThinkingSlug } from "@/lib/ai/model-catalog";
import { writeArticleBlocks } from "@/lib/search/persist";
import { cacheGet, cacheSet } from "@/lib/cache/redis";

export interface ReformatResult {
  ok: boolean;
  error?: string;
}

// Cache a reformatted body per (summary, format) so switching back is instant.
const reformatKey = (summaryId: string, formatId: string) =>
  `reformat:${summaryId}:${formatId}`;
const REFORMAT_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Re-generate a saved article's body under a new output lens, over its stored
 * source text, and replace the body in place. Reuses a per-format cache so
 * switching back to a format you've used is instant + free. Returns a friendly
 * error (rather than throwing) for the common failure cases.
 */
export async function reformatArticle(
  supabase: SupabaseClient,
  userId: string,
  summaryId: string,
  formatId: string,
): Promise<ReformatResult> {
  const fmt = resolveFormat(formatId);

  const { data: summary } = await supabase
    .from("summaries")
    .select(
      "id, model_used, format, search_id, searches!inner(query, input_type)",
    )
    .eq("id", summaryId)
    .maybeSingle();
  if (!summary) return { ok: false, error: "Article not found." };
  if ((summary.format as string | null) === fmt.id) return { ok: true };

  const search = Array.isArray(summary.searches)
    ? summary.searches[0]
    : summary.searches;
  const query = (search?.query as string) ?? "";
  const inputType = (search?.input_type as "keyword" | "url") ?? "keyword";
  const model = (summary.model_used as string) || modelSlug("claude-sonnet");

  const { data: srcRows } = await supabase
    .from("sources")
    .select(
      "id, position, title, url, domain, published_at, credibility_tier, political_lean, snippet, content",
    )
    .eq("summary_id", summaryId)
    .order("position", { ascending: true });
  const rows = srcRows ?? [];
  if (rows.length === 0) {
    return { ok: false, error: "This article has no sources to reformat from." };
  }
  if (!rows.some((r) => (r.content as string | null)?.trim())) {
    return {
      ok: false,
      error:
        "This article predates full-text storage — re-run the search to enable reformatting.",
    };
  }

  const sources: PreparedSource[] = rows.map((r) => ({
    position: r.position as number,
    title: (r.title as string) ?? "",
    url: r.url as string,
    domain: (r.domain as string) ?? "",
    publishedAt: (r.published_at as string | null) ?? null,
    credibilityTier:
      (r.credibility_tier as PreparedSource["credibilityTier"]) ?? "unknown",
    politicalLean:
      (r.political_lean as PreparedSource["politicalLean"]) ?? "unknown",
    snippet: (r.snippet as string) ?? "",
    content: (r.content as string | null) || (r.snippet as string) || "",
  }));
  const sourceIdByPosition = new Map<number, string>();
  rows.forEach((r) =>
    sourceIdByPosition.set(r.position as number, r.id as string),
  );

  // Reuse a cached reformat of this format if we have one; else regenerate.
  let markdown = await cacheGet<string>(reformatKey(summaryId, fmt.id));
  if (!markdown) {
    const messages = buildMessages({ query, inputType, sources, format: fmt.id });
    const reasoningEffort = isThinkingSlug(model) ? ("low" as const) : undefined;
    let md = "";
    for await (const d of streamSummary({
      model,
      messages,
      maxTokens: fmt.maxTokens,
      reasoningEffort,
    })) {
      md += d;
    }
    markdown = md;
  }

  const article = parseArticle(markdown, query);
  if (!article.blocks.some((b) => b.type === "text")) {
    return { ok: false, error: "Reformatting came back empty. Please try again." };
  }

  // Replace the body: delete old blocks (cascades their citations), write new.
  await supabase.from("summary_blocks").delete().eq("summary_id", summaryId);
  await writeArticleBlocks(supabase, {
    summaryId,
    userId,
    article,
    sourceIdByPosition,
  });
  await supabase
    .from("summaries")
    .update({
      format: fmt.id,
      length_kind: article.lengthKind,
      citation_coverage: article.citationCoverage,
    })
    .eq("id", summaryId);

  await cacheSet(reformatKey(summaryId, fmt.id), markdown, REFORMAT_TTL);

  // Body changed → re-index embeddings so "Ask your library" stays accurate.
  if (isEmbeddingsConfigured()) {
    try {
      await indexSummary(supabase, userId, summaryId);
    } catch (err) {
      console.error("reformat reindex failed:", err);
    }
  }

  return { ok: true };
}
