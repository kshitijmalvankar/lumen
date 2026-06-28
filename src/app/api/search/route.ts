import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, cacheGet, cacheSet } from "@/lib/cache/redis";
import {
  normalizeQuery,
  detectInputType,
  gatherSearchSources,
  gatherUrlSource,
  type PreparedSource,
} from "@/lib/search/pipeline";
import { buildMessages } from "@/lib/ai/prompts";
import { streamSummary } from "@/lib/ai/summarize";
import { parseArticle } from "@/lib/ai/parse";
import { selectModel } from "@/lib/ai/models";
import { createSearch, markSearchError, persistResult } from "@/lib/search/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  query: z.string().trim().min(2).max(500),
  // "deep" arrives in a later phase; accept it but treat as quick for now.
  mode: z.enum(["quick", "deep"]).optional().default("quick"),
});

// Source fields we cache (no extracted body) and send to the client.
type SourceMeta = Omit<PreparedSource, "content">;

interface CachedResult {
  title: string;
  markdown: string;
  sources: SourceMeta[];
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h for the "week" freshness window

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a topic or link to search.", 400);
  const { query } = parsed.data;
  const mode = "quick" as const; // deep mode lands in Phase 4

  if (!isSupabaseConfigured()) {
    return jsonError("The app isn't fully configured yet. Add API keys to .env.local.", 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Please sign in to search.", 401);

  const rl = await checkRateLimit(user.id, mode);
  if (!rl.allowed) {
    return jsonError(
      "You've hit the hourly search limit. Try again a bit later.",
      429,
    );
  }

  const inputType = detectInputType(query);
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = `sum:${mode}:${
    inputType === "url" ? query.trim().toLowerCase() : normalizedQuery
  }`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let searchId: string | undefined;
      try {
        searchId = await createSearch(supabase, {
          userId: user.id,
          query,
          normalizedQuery,
          inputType,
          mode,
        });

        const model = selectModel(mode);

        /* ---------- cache hit: re-use generation, persist for user ---------- */
        const cached = await cacheGet<CachedResult>(cacheKey);
        if (cached) {
          send({ type: "status", phase: "cached", message: "Found a recent result" });
          send({ type: "sources", sources: cached.sources });

          // Stream the cached markdown in small chunks for a live feel.
          for (const chunk of chunkString(cached.markdown, 240)) {
            send({ type: "delta", text: chunk });
          }

          const article = parseArticle(cached.markdown, query);
          const summaryId = await persistResult(supabase, {
            userId: user.id,
            searchId,
            article,
            sources: cached.sources.map((s) => ({ ...s, content: "" })),
            modelUsed: model,
          });
          send({
            type: "done",
            summaryId,
            title: article.title,
            lengthKind: article.lengthKind,
            citationCoverage: article.citationCoverage,
          });
          return;
        }

        /* ------------------------- gather sources ------------------------- */
        send({ type: "status", phase: "searching", message: "Searching credible sources" });

        let sources: PreparedSource[];
        if (inputType === "url") {
          sources = await gatherUrlSource(query);
        } else {
          sources = await gatherSearchSources(query, { count: 6 });
        }

        if (sources.length === 0) {
          send({
            type: "error",
            message:
              "Couldn't find usable sources for that. Try rephrasing or a different topic.",
          });
          await markSearchError(supabase, searchId, "no sources found");
          return;
        }

        const sourceMeta: SourceMeta[] = sources.map(toMeta);
        send({ type: "sources", sources: sourceMeta });

        /* --------------------------- summarize ---------------------------- */
        send({ type: "status", phase: "writing", message: "Writing your article" });

        const messages = buildMessages({ query, inputType, sources });
        let markdown = "";
        for await (const delta of streamSummary({ model, messages })) {
          markdown += delta;
          send({ type: "delta", text: delta });
        }

        const article = parseArticle(markdown, query);

        const summaryId = await persistResult(supabase, {
          userId: user.id,
          searchId,
          article,
          sources,
          modelUsed: model,
        });

        await cacheSet<CachedResult>(
          cacheKey,
          { title: article.title, markdown, sources: sourceMeta },
          CACHE_TTL_SECONDS,
        );

        send({
          type: "done",
          summaryId,
          title: article.title,
          lengthKind: article.lengthKind,
          citationCoverage: article.citationCoverage,
        });
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "Something went wrong generating your article.",
        });
        if (searchId) {
          await markSearchError(
            supabase,
            searchId,
            err instanceof Error ? err.message : "unknown error",
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function toMeta(s: PreparedSource): SourceMeta {
  return {
    position: s.position,
    title: s.title,
    url: s.url,
    domain: s.domain,
    publishedAt: s.publishedAt,
    credibilityTier: s.credibilityTier,
    snippet: s.snippet,
  };
}

function* chunkString(str: string, size: number): Generator<string> {
  for (let i = 0; i < str.length; i += size) yield str.slice(i, i + size);
}
