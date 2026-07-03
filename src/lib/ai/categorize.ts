import { getOpenRouter } from "./openrouter";
import { categorizeModel } from "./models";

const SYSTEM = `You label an article with ONE broad topic for a personal reading library.

Rules:
- Prefer a topic from the ALLOWED list when one reasonably fits.
- Only invent a new topic if none fit. Keep new topics broad (like the allowed ones), 1-3 words, Title Case — a subject area, NOT a specific company, person, or event.
- Reply with ONLY the topic name. No punctuation, no explanation.`;

function normalize(raw: string): string {
  return raw
    .replace(/^[\s"'*`-]+|[\s"'*`.-]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

/**
 * Pick a single broad topic for an article, preferring the candidate list.
 * Returns "" when the model gives nothing usable (caller skips categorizing).
 */
export async function pickCategory(args: {
  title: string;
  query: string;
  candidates: string[];
}): Promise<string> {
  const { title, query, candidates } = args;
  const user = `ALLOWED: ${candidates.join(", ")}

Article title: "${title}"
Searched: "${query}"

Topic:`;

  const res = await getOpenRouter().chat.completions.create({
    model: categorizeModel(),
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    max_tokens: 16,
  });
  return normalize(res.choices?.[0]?.message?.content ?? "");
}
