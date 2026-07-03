import { env, requireEnv } from "@/lib/env";
import { categorizeModel } from "@/lib/ai/models";
import { scoreCredibility, type CredibilityTier } from "./credibility";
import { extractContent } from "@/lib/extract/jina";

export type InputType = "keyword" | "url";

export interface PreparedSource {
  position: number; // the [n] index, 1-based
  title: string;
  url: string;
  domain: string;
  publishedAt: string | null;
  credibilityTier: CredibilityTier;
  snippet: string;
  content: string; // body used for summarization
}

/** Normalize a query for cache keys and dedup (not for display). */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export function detectInputType(raw: string): InputType {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return "url";
  if (!/\s/.test(t) && /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(t)) return "url";
  return "keyword";
}

function ensureProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const PROMPT_CONTENT_CAP = 3500; // chars per source fed to the model

interface UrlCitation {
  url?: string;
  title?: string;
  content?: string;
}

/**
 * Discover sources via OpenRouter's built-in web search (the `web` plugin).
 * Returns the retrieved set as numbered, credibility-scored sources — no
 * separate search engine or extraction step needed.
 */
export async function gatherSearchSources(
  query: string,
  opts: { count?: number } = {},
): Promise<PreparedSource[]> {
  const { count = 8 } = opts;
  requireEnv("openrouterApiKey");

  const res = await fetch(`${env.openrouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.siteUrl,
      "X-Title": "Lumen",
    },
    body: JSON.stringify({
      model: categorizeModel(), // cheap; just triggers retrieval
      plugins: [{ id: "web", max_results: count }],
      messages: [
        {
          role: "user",
          content: `Search the web for the most relevant and recent (ideally within the last week or two) credible sources about: "${query}". Briefly list what you found, citing each source.`,
        },
      ],
      max_tokens: 600,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`web search ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { annotations?: Array<{ url_citation?: UrlCitation }> };
    }>;
  };
  const annotations = data.choices?.[0]?.message?.annotations ?? [];

  const seen = new Set<string>();
  const out: PreparedSource[] = [];
  for (const a of annotations) {
    const c = a.url_citation;
    if (!c?.url || seen.has(c.url)) continue;
    seen.add(c.url);
    const domain = domainOf(c.url);
    const content = (c.content ?? "").trim();
    out.push({
      position: out.length + 1,
      title: c.title || domain || c.url,
      url: c.url,
      domain,
      publishedAt: null, // web plugin doesn't return a reliable date
      credibilityTier: scoreCredibility(domain),
      snippet: content.slice(0, 200),
      content: (content || c.title || "").slice(0, PROMPT_CONTENT_CAP),
    });
    if (out.length >= count) break;
  }
  return out;
}

/** Prepare a single pasted URL as a source (via Jina Reader; no API key). */
export async function gatherUrlSource(
  rawUrl: string,
): Promise<PreparedSource[]> {
  const url = ensureProtocol(rawUrl.trim());
  const domain = domainOf(url);
  const extracted = await extractContent(url);
  if (!extracted || !extracted.content.trim()) return [];

  return [
    {
      position: 1,
      title: extracted.title || domain || url,
      url,
      domain,
      publishedAt: extracted.publishedAt,
      credibilityTier: scoreCredibility(domain),
      snippet: extracted.content.slice(0, 200),
      content: extracted.content.slice(0, PROMPT_CONTENT_CAP * 2),
    },
  ];
}
