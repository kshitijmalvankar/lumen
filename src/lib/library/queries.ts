import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceMeta } from "@/components/search/source-list";

export interface LibraryItem {
  summaryId: string;
  searchId: string;
  query: string;
  title: string;
  inputType: "keyword" | "url";
  createdAt: string;
  lengthKind: "paragraph" | "article";
  citationCoverage: number | null;
  sourceCount: number;
  bookmarked: boolean;
  category: string | null;
}

export interface ArticleData {
  summaryId: string;
  searchId: string;
  title: string;
  query: string;
  inputType: "keyword" | "url";
  createdAt: string;
  lengthKind: "paragraph" | "article";
  citationCoverage: number | null;
  modelUsed: string | null;
  format: string;
  bookmarked: boolean;
  bodyMarkdown: string;
  aiAnalysis: string | null;
  sources: SourceMeta[];
}

// Supabase returns to-one embeds as an object, but type inference can widen to
// an array — normalize either shape.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Rebuild a Markdown body from stored, ordered blocks (title lives separately). */
export function blocksToMarkdown(
  blocks: Array<{ type: "text" | "heading"; content: string }>,
): string {
  return blocks
    .map((b) => (b.type === "heading" ? `## ${b.content}` : b.content))
    .join("\n\n");
}

/**
 * All of the signed-in user's saved articles, newest first. RLS scopes every
 * row to the caller, so no explicit user filter is needed.
 */
export async function listLibrary(
  supabase: SupabaseClient,
): Promise<LibraryItem[]> {
  const { data, error } = await supabase
    .from("summaries")
    .select(
      "id, title, created_at, length_kind, citation_coverage, searches!inner(id, query, input_type), sources(count)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listLibrary: ${error.message}`);

  const { data: bm, error: bmErr } = await supabase
    .from("bookmarks")
    .select("summary_id");
  if (bmErr) throw new Error(`listLibrary bookmarks: ${bmErr.message}`);
  const bookmarked = new Set((bm ?? []).map((b) => b.summary_id as string));

  // Category per search, fetched separately (robust vs. a deep nested embed).
  const { data: catData } = await supabase
    .from("search_categories")
    .select("search_id, categories(name)");
  const categoryBySearch = new Map<string, string>();
  for (const r of catData ?? []) {
    const name = one(
      (r as { categories?: { name?: string } | { name?: string }[] }).categories,
    )?.name;
    if (name) categoryBySearch.set(r.search_id as string, name);
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const search = one(
      r.searches as { id?: string; query?: string; input_type?: string } | null,
    );
    const sourceCount =
      one(r.sources as { count?: number } | null)?.count ?? 0;
    const category = search?.id
      ? (categoryBySearch.get(search.id) ?? null)
      : null;
    return {
      summaryId: r.id as string,
      searchId: search?.id ?? "",
      title: (r.title as string) ?? "Untitled",
      query: search?.query ?? "",
      inputType: (search?.input_type as "keyword" | "url") ?? "keyword",
      createdAt: r.created_at as string,
      lengthKind: (r.length_kind as "paragraph" | "article") ?? "article",
      citationCoverage: (r.citation_coverage as number | null) ?? null,
      sourceCount,
      bookmarked: bookmarked.has(r.id as string),
      category,
    };
  });
}

/**
 * One saved article with its reconstructed body and ordered sources, or null
 * if it doesn't exist / isn't owned by the caller (RLS).
 */
export async function getArticle(
  supabase: SupabaseClient,
  summaryId: string,
): Promise<ArticleData | null> {
  const { data: summary, error } = await supabase
    .from("summaries")
    .select(
      "id, search_id, title, created_at, length_kind, citation_coverage, model_used, format, ai_analysis, searches!inner(query, input_type)",
    )
    .eq("id", summaryId)
    .maybeSingle();
  if (error) throw new Error(`getArticle: ${error.message}`);
  if (!summary) return null;

  const [blocksRes, sourcesRes, bmRes] = await Promise.all([
    supabase
      .from("summary_blocks")
      .select("position, type, content")
      .eq("summary_id", summaryId)
      .order("position", { ascending: true }),
    supabase
      .from("sources")
      .select(
        "position, title, url, domain, published_at, credibility_tier, political_lean, snippet",
      )
      .eq("summary_id", summaryId)
      .order("position", { ascending: true }),
    supabase
      .from("bookmarks")
      .select("summary_id")
      .eq("summary_id", summaryId)
      .maybeSingle(),
  ]);

  if (blocksRes.error) throw new Error(`getArticle blocks: ${blocksRes.error.message}`);
  if (sourcesRes.error) throw new Error(`getArticle sources: ${sourcesRes.error.message}`);

  const blocks = (blocksRes.data ?? []) as Array<{
    type: "text" | "heading";
    content: string;
  }>;
  const sources: SourceMeta[] = (sourcesRes.data ?? []).map((s) => {
    const row = s as Record<string, unknown>;
    return {
      position: row.position as number,
      title: (row.title as string) ?? "",
      url: row.url as string,
      domain: (row.domain as string) ?? "",
      publishedAt: (row.published_at as string | null) ?? null,
      credibilityTier:
        (row.credibility_tier as SourceMeta["credibilityTier"]) ?? "unknown",
      politicalLean:
        (row.political_lean as SourceMeta["politicalLean"]) ?? "unknown",
      snippet: (row.snippet as string | undefined) ?? undefined,
    };
  });

  const s = summary as Record<string, unknown>;
  const search = one(
    s.searches as { query?: string; input_type?: string } | null,
  );

  return {
    summaryId: s.id as string,
    searchId: s.search_id as string,
    title: (s.title as string) ?? "Untitled",
    query: search?.query ?? "",
    inputType: (search?.input_type as "keyword" | "url") ?? "keyword",
    createdAt: s.created_at as string,
    lengthKind: (s.length_kind as "paragraph" | "article") ?? "article",
    citationCoverage: (s.citation_coverage as number | null) ?? null,
    modelUsed: (s.model_used as string | null) ?? null,
    format: (s.format as string | null) ?? "standard",
    bookmarked: Boolean(bmRes.data),
    bodyMarkdown: blocksToMarkdown(blocks),
    aiAnalysis: (s.ai_analysis as string | null) ?? null,
    sources,
  };
}
