import { getOpenRouter } from "./openrouter";
import type { ReasoningEffort } from "./summarize";

const SCRIPT_SYSTEM = `You are Lumen's audio producer. Turn the article below into a single-narrator spoken-word "audio overview" — a short, engaging narration a listener can play like a mini-podcast.

Rules:
- Write ONLY the words to be spoken. No stage directions, speaker labels, headings, markdown, bullet points, or citation numbers like [1].
- Natural, conversational spoken English: short sentences, smooth transitions, easy to follow by ear.
- Open with a one-line hook that frames the topic; close with a brief takeaway.
- About 600–850 words. Cover the key points faithfully; do NOT invent facts beyond the article.
- Spell out things that don't read aloud well (say "percent" not "%", "dollars" not "$").`;

/**
 * Produce a spoken-word narration script from a saved article. Cheap + fast
 * (uses whatever model the caller passes — typically the categorize model).
 */
export async function buildAudioScript(args: {
  model: string;
  title: string;
  articleMarkdown: string;
  reasoningEffort?: ReasoningEffort;
}): Promise<string> {
  const { model, title, articleMarkdown, reasoningEffort } = args;
  const client = getOpenRouter();

  const user = `TITLE: ${title}\n\nARTICLE:\n${articleMarkdown}`;

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SCRIPT_SYSTEM },
      { role: "user", content: user },
    ],
    max_tokens: 2000,
    reasoning_effort: reasoningEffort,
  });

  return (res.choices?.[0]?.message?.content ?? "").trim();
}

/**
 * Split a script into ≤maxChars segments on sentence boundaries so each can be
 * synthesized in its own request (Hume caps an utterance at 5,000 chars; we
 * default to 4,500 for headroom). Citation markers are stripped. Pure function.
 */
export function segmentScript(script: string, maxChars = 4500): string[] {
  const clean = script
    .replace(/\[(\d{1,3})\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";

  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;

    // A single overlong sentence: flush and hard-split it.
    if (s.length > maxChars) {
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      for (let i = 0; i < s.length; i += maxChars) {
        chunks.push(s.slice(i, i + maxChars));
      }
      continue;
    }

    if (cur && cur.length + 1 + s.length > maxChars) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }

  if (cur) chunks.push(cur);
  return chunks;
}
