import { getOpenRouter } from "./openrouter";
import { normalizeAnalysis } from "./analysis-normalize";
import type { ReasoningEffort } from "./summarize";

const ANALYSIS_SYSTEM = `You are Lumen's analyst. A reader has just finished the cited article below, which was assembled strictly from the numbered sources. Add a brief ANALYSIS that goes BEYOND restating the article: your own interpretation — implications, what to watch next, tensions or caveats, second-order effects, or how the pieces connect.

Rules:
- 2–4 short paragraphs maximum. Be specific and substantive; no generic filler, no summarizing what was already said.
- Ground your interpretation in the article and sources — do not invent facts. You MAY reference sources as [n] where it strengthens a point.
- Where the sources genuinely diverge, contradict each other, or a claim rests on a single weaker source, surface that disagreement plainly — name the differing sources as [n] — instead of flattening it into one confident take. Don't manufacture conflict where the sources broadly agree.
- Plain prose only: no heading, no "Analysis:" label, no preamble like "In summary".
- If you genuinely have nothing valuable to add beyond the article, reply with exactly: NONE`;

function sourcesBlock(
  sources: Array<{ position: number; title: string; domain: string }>,
): string {
  return sources.map((s) => `[${s.position}] ${s.title} — ${s.domain}`).join("\n");
}

/**
 * Generate Lumen's own analysis of a finished article. Returns "" when there's
 * nothing worth adding. Best-effort — callers should treat a throw as "no
 * analysis" rather than failing the whole search.
 */
export async function generateAnalysis(args: {
  model: string;
  query: string;
  articleMarkdown: string;
  sources: Array<{ position: number; title: string; domain: string }>;
  reasoningEffort?: ReasoningEffort;
}): Promise<string> {
  const { model, query, articleMarkdown, sources, reasoningEffort } = args;
  const client = getOpenRouter();

  const user = `Topic: "${query}"

ARTICLE:
${articleMarkdown}

SOURCES:
${sourcesBlock(sources)}`;

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM },
      { role: "user", content: user },
    ],
    // Headroom for thinking models (GPT-5, Gemini) to reason and still answer;
    // the analysis itself is short, so non-thinking models stay cheap.
    max_tokens: 4000,
    reasoning_effort: reasoningEffort,
  });

  return normalizeAnalysis(res.choices?.[0]?.message?.content ?? "");
}
