import "server-only";
import { getOpenRouter } from "@/lib/ai/openrouter";
import { categorizeModel } from "@/lib/ai/models";
import { gatherSearchSources, type PreparedSource } from "@/lib/search/pipeline";
import { parseQuestions } from "@/lib/ai/research-core";

/**
 * Decompose a topic into a handful of focused, non-overlapping sub-questions
 * that together give comprehensive coverage. Cheap model; robust JSON parsing
 * with a line-based fallback. Returns [] on failure (caller falls back to a
 * single search).
 */
export async function planResearch(topic: string, max = 5): Promise<string[]> {
  try {
    const client = getOpenRouter();
    const res = await client.chat.completions.create({
      model: categorizeModel(),
      messages: [
        {
          role: "user",
          content: `Break this research topic into ${max} focused, non-overlapping sub-questions that together give comprehensive, balanced coverage. Topic: "${topic}".\nReply with ONLY a JSON array of ${max} short question strings, nothing else.`,
        },
      ],
      max_tokens: 400,
    });
    const text = res.choices?.[0]?.message?.content ?? "";
    return parseQuestions(text, max);
  } catch (err) {
    console.error("planResearch failed:", err);
    return [];
  }
}

/**
 * Gather + dedupe sources across the topic and each sub-question (searched in
 * parallel). Dedupes by URL and renumbers. Bounded so the synthesis prompt stays
 * within budget even with many sub-questions.
 */
export async function gatherDeepSources(
  topic: string,
  subQuestions: string[],
  opts: { perQuestion?: number; totalCap?: number } = {},
): Promise<PreparedSource[]> {
  const perQuestion = opts.perQuestion ?? 6;
  const totalCap = opts.totalCap ?? 22;
  // Smaller per-source slice than a normal search — many sources, bounded total.
  const contentBudget = 12000;

  const queries = [topic, ...subQuestions];
  const results = await Promise.all(
    queries.map((q) =>
      gatherSearchSources(q, { count: perQuestion, contentBudget }).catch(
        () => [] as PreparedSource[],
      ),
    ),
  );

  const seen = new Set<string>();
  const out: PreparedSource[] = [];
  for (const list of results) {
    for (const s of list) {
      if (out.length >= totalCap) break;
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push({ ...s, position: out.length + 1 });
    }
  }
  return out;
}
