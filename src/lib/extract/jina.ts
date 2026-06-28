import { env } from "@/lib/env";

export interface ExtractedContent {
  url: string;
  title: string | null;
  content: string;
  publishedAt: string | null;
}

const MAX_CHARS = 12_000; // keep prompts bounded; enough for a strong summary

/**
 * Extract clean main content from a URL using Jina Reader (r.jina.ai).
 * Works for articles and PDFs. The API key is optional but raises rate limits.
 * Returns null on failure so callers can skip a bad source without aborting.
 */
export async function extractContent(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<ExtractedContent | null> {
  const { timeoutMs = 20_000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Return-Format": "markdown",
    };
    if (env.jinaApiKey) headers.Authorization = `Bearer ${env.jinaApiKey}`;

    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: {
        title?: string;
        content?: string;
        publishedTime?: string;
      };
    };

    const data = json.data;
    if (!data?.content) return null;

    return {
      url,
      title: data.title ?? null,
      content: data.content.slice(0, MAX_CHARS),
      publishedAt: data.publishedTime ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract several URLs concurrently, dropping any that fail. */
export async function extractMany(
  urls: string[],
  opts: { timeoutMs?: number } = {},
): Promise<ExtractedContent[]> {
  const results = await Promise.all(urls.map((u) => extractContent(u, opts)));
  return results.filter((r): r is ExtractedContent => r !== null);
}
