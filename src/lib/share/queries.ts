import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { blocksToMarkdown } from "@/lib/library/queries";
import type { SourceMeta } from "@/components/search/source-list";

/**
 * The owner's current active (non-revoked) share URL for an article, or null if
 * it isn't shared. Uses the caller's RLS-scoped client — the reader page passes
 * this to the share button so it opens straight to the live link.
 */
export async function getActiveShareUrl(
  supabase: SupabaseClient,
  summaryId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("shares")
    .select("public_slug")
    .eq("summary_id", summaryId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const slug = data?.[0]?.public_slug as string | undefined;
  return slug ? `${env.siteUrl}/s/${slug}` : null;
}

export interface SharedArticle {
  title: string;
  query: string;
  createdAt: string;
  bodyMarkdown: string;
  citationCoverage: number | null;
  /** True when the owner is Pro/Max and an AI Analysis exists — we lock it. */
  hasAnalysis: boolean;
  sources: SourceMeta[];
}

// Supabase to-one embeds can widen to an array — normalize either shape.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Load a publicly-shared article by its slug for anonymous visitors. Reads via
 * the service-role admin client (bypasses RLS) because the visitor has no
 * session — access is gated purely by possession of the (unguessable) slug and
 * the share not being revoked. The AI Analysis text is intentionally NOT
 * returned (only a boolean), so the paid analysis never leaks on a public page.
 *
 * Wrapped in React.cache so generateMetadata and the page share one query.
 */
export const getSharedArticle = cache(
  async (slug: string): Promise<SharedArticle | null> => {
    // Admin client needs the service-role key; degrade to "not found" without it.
    if (!env.supabaseServiceRoleKey) return null;

    const admin = createAdminClient();

    const { data: share } = await admin
      .from("shares")
      .select("summary_id, revoked_at")
      .eq("public_slug", slug)
      .maybeSingle();
    if (!share || share.revoked_at) return null;

    const summaryId = share.summary_id as string;

    const { data: summary } = await admin
      .from("summaries")
      .select("id, title, created_at, citation_coverage, ai_analysis, searches!inner(query)")
      .eq("id", summaryId)
      .maybeSingle();
    if (!summary) return null;

    const [blocksRes, sourcesRes] = await Promise.all([
      admin
        .from("summary_blocks")
        .select("type, content, position")
        .eq("summary_id", summaryId)
        .order("position", { ascending: true }),
      admin
        .from("sources")
        .select("position, title, url, domain, published_at, credibility_tier, snippet")
        .eq("summary_id", summaryId)
        .order("position", { ascending: true }),
    ]);

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
        snippet: (row.snippet as string | undefined) ?? undefined,
      };
    });

    const s = summary as Record<string, unknown>;
    const search = one(s.searches as { query?: string } | null);

    return {
      title: (s.title as string) ?? "Untitled",
      query: search?.query ?? "",
      createdAt: s.created_at as string,
      bodyMarkdown: blocksToMarkdown(blocks),
      citationCoverage: (s.citation_coverage as number | null) ?? null,
      hasAnalysis: Boolean(s.ai_analysis),
      sources,
    };
  },
);
