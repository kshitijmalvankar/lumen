import { getOpenRouter } from "./openrouter";
import { categorizeModel } from "./models";

export interface Suggestion {
  /** "topic" = a fresh angle on their interests; "deepen" = go deeper on a read. */
  kind: "topic" | "deepen";
  /** The clickable search query. */
  prompt: string;
  /** Short rationale, e.g. "Because you read about AI". */
  reason: string;
}

const SYSTEM = `You suggest what a curious reader might research next, from their reading history. Return 4-5 suggestions as a JSON array and nothing else.

Each item is an object:
- "kind": "topic" for a fresh angle on their interests, or "deepen" to go deeper on something specific they already read.
- "prompt": a specific, natural search query the reader would actually type (max ~90 characters). Not a headline. No surrounding quotes.
- "reason": a short why, at most 6 words (e.g. "Because you read about AI").

Rules:
- Include a mix of "topic" and "deepen".
- Be specific and varied — no near-duplicates, no vague prompts.
- Reply with ONLY the JSON array. No prose, no code fences.`;

/**
 * Parse the model's reply into clean suggestions. Tolerant of code fences and
 * surrounding prose; drops anything malformed. Pure — unit-tested.
 */
export function parseSuggestions(raw: string): Suggestion[] {
  let text = raw.trim();
  // Strip ```json fences if present.
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let arr: unknown;
  try {
    arr = JSON.parse(text);
  } catch {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try {
      arr = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
    if (!prompt) continue;
    const dedupe = prompt.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const reason = typeof o.reason === "string" ? o.reason.trim() : "";
    const kind = o.kind === "deepen" ? "deepen" : "topic";
    out.push({ kind, prompt: prompt.slice(0, 120), reason: reason.slice(0, 60) });
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * One cheap Haiku call turning a reader's interests + recent reads into a few
 * concrete next-read prompts. Callers cache the result (see getSuggestions).
 */
export async function suggestPrompts(args: {
  interests: string[];
  recentTitles: string[];
}): Promise<Suggestion[]> {
  const { interests, recentTitles } = args;

  const user = `Interests (strongest first): ${
    interests.join(", ") || "(none yet)"
  }
Recently read: ${
    recentTitles
      .slice(0, 6)
      .map((t) => `"${t}"`)
      .join("; ") || "(none)"
  }

JSON:`;

  const res = await getOpenRouter().chat.completions.create({
    model: categorizeModel(),
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    max_tokens: 500,
  });

  return parseSuggestions(res.choices?.[0]?.message?.content ?? "");
}
