import "server-only";
import { env, requireEnv } from "@/lib/env";

const JINA_EMBED_URL = "https://api.jina.ai/v1/embeddings";

// jina-embeddings-v3 supports task-specific LoRA adapters — use the passage
// adapter when indexing article chunks and the query adapter when embedding a
// user's question, which measurably improves retrieval quality.
export type EmbedTask = "retrieval.passage" | "retrieval.query";

/**
 * Embed one or more texts via Jina (`jina-embeddings-v3`, 1024-dim by default).
 * Provider-agnostic call site: swap this body for OpenAI/Voyage without touching
 * callers. Returns one vector per input, in order.
 */
export async function embed(
  texts: string[],
  task: EmbedTask = "retrieval.passage",
): Promise<number[][]> {
  requireEnv("jinaApiKey");
  if (texts.length === 0) return [];

  const res = await fetch(JINA_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.jinaApiKey}`,
    },
    body: JSON.stringify({
      model: env.jinaEmbedModel,
      task,
      dimensions: env.jinaEmbedDimensions,
      // v3 truncates rather than erroring on over-long inputs.
      truncate: true,
      input: texts,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Jina embeddings ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: { index: number; embedding: number[] }[];
  };
  const rows = json.data ?? [];
  // Order by the returned index so vectors line up with the inputs.
  const out: number[][] = new Array(texts.length);
  for (const r of rows) out[r.index] = r.embedding;
  return out;
}

/** Convenience for embedding a single query string. */
export async function embedQuery(text: string): Promise<number[] | null> {
  const [v] = await embed([text], "retrieval.query");
  return v ?? null;
}
