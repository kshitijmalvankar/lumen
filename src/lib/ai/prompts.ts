import type { PreparedSource } from "@/lib/search/pipeline";
import type { InputType } from "@/lib/search/pipeline";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

const SYSTEM_PROMPT = `You are Lumen, a research assistant that turns sources into one clear, trustworthy article for a general reader.

RULES — follow all of them:
- Use ONLY the information in the provided sources. Never invent facts, figures, or sources.
- After every factual claim, add a citation marker like [1], or [1][3] for multiple. The number is the source's index.
- Do NOT write raw URLs or markdown links inline — the app renders the source list separately.
- Prefer more recent and higher-credibility sources. When sources meaningfully disagree, add a short section "## Where sources disagree" explaining the disagreement instead of blending them.
- Adaptive length: if the sources only support a little, write ONE tight paragraph. If they support more, write a multi-section article using "##" section headings.
- Begin with a single title line in the form "# Title" (a specific, informative title — not the raw query). Then the body in Markdown.
- Voice: clear, neutral, well-edited — like a good Medium explainer. No preamble such as "Here is" or "Based on the sources".
- If the sources do not actually address the topic, say so plainly in one sentence rather than guessing.`;

function formatSource(s: PreparedSource): string {
  const date = s.publishedAt ? ` · ${s.publishedAt.slice(0, 10)}` : "";
  const cred = ` · credibility: ${s.credibilityTier}`;
  return `[${s.position}] ${s.title} — ${s.domain}${date}${cred}\n${s.content}`;
}

export function buildMessages(args: {
  query: string;
  inputType: InputType;
  sources: PreparedSource[];
}): ChatMessage[] {
  const { query, inputType, sources } = args;

  const task =
    inputType === "url"
      ? `Write the article summarizing the following source for a reader who hasn't read it.`
      : `Write the article on this topic: "${query}"`;

  const sourcesBlock = sources.map(formatSource).join("\n\n---\n\n");

  const user = `${task}

Today's date: ${new Date().toISOString().slice(0, 10)}.

SOURCES:

${sourcesBlock}`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
