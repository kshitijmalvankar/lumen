import type { PreparedSource } from "@/lib/search/pipeline";
import type { InputType } from "@/lib/search/pipeline";
import { resolveFormat } from "@/lib/ai/formats";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

const SYSTEM_PROMPT = `You are Lumen, a research assistant that turns sources into one clear, detailed and trustworthy article for a general reader.

RULES — follow all of them:
- Use ONLY the information in the provided sources. Never invent facts, figures, or sources.
- After every factual claim, add a citation marker like [1], or [1][3] for multiple. The number is the source's index.
- Do NOT write raw URLs or markdown links inline — the app renders the source list separately.
- Prefer more recent and higher-credibility sources. If there are no recent sources, only then look for older sources. When sources meaningfully disagree, add a short section "## Where sources disagree" explaining the disagreement instead of blending them.
- Adaptive length: if the sources only support a little, write ONE tight paragraph. If they support more, write a multi-section article using "##" section headings.
- Begin with a single title line in the form "# Title" (a specific, informative title — not the raw query). Then the body in Markdown.
- Voice: clear, neutral, well-edited — like a good Medium explainer. No preamble such as "Here is" or "Based on the sources".
- If the sources do not actually address the topic, say so plainly in one sentence rather than guessing.
- Do NOT use em dashes in the generated article`;

// Deep research: the caller has already decomposed the topic into sub-questions
// and gathered sources for each. This prompt asks for a genuinely comprehensive,
// plan-driven report — distinct from the standard single-pass explainer, which
// is what makes "Deep research" produce a different result and not just +2 refs.
const DEEP_SYSTEM_PROMPT = `You are Lumen, a research assistant producing a thorough, well-structured research report synthesized from many sources.

RULES — follow all of them:
- Use ONLY the information in the provided sources. Never invent facts, figures, or sources.
- After every factual claim, add a citation marker like [1], or [1][3] for multiple. The number is the source's index.
- Do NOT write raw URLs or markdown links inline — the app renders the source list separately.
- The reader's topic has been broken into the RESEARCH ANGLES listed in the task. Address every angle, each under its own "##" section heading (you may merge or reorder them for flow, but cover them all). Synthesize across sources — never summarize them one at a time.
- Open with a 2–3 sentence executive summary of the overall findings, then the sectioned body.
- Be comprehensive and specific: pull in concrete details, figures, dates, and named examples from across the FULL source set. This is a long-form report, not a brief — aim for real depth on each angle.
- Prefer more recent and higher-credibility sources. When sources meaningfully disagree, add a "## Where sources disagree" section explaining the disagreement rather than blending them.
- Begin with a single title line in the form "# Title" (specific and informative — not the raw query). Then the body in Markdown.
- Voice: clear, neutral, well-edited — like a sharp analyst's briefing. No preamble such as "Here is" or "Based on the sources".
- Do NOT use em dashes in the generated report`;

function formatSource(s: PreparedSource): string {
  const date = s.publishedAt ? ` · ${s.publishedAt.slice(0, 10)}` : "";
  const cred = ` · credibility: ${s.credibilityTier}`;
  return `[${s.position}] ${s.title} — ${s.domain}${date}${cred}\n${s.content}`;
}

export function buildMessages(args: {
  query: string;
  inputType: InputType;
  sources: PreparedSource[];
  /** Output lens (see formats.ts); shapes the article. */
  format?: string;
  /**
   * Deep-research sub-questions. When present, the writer is asked to organize a
   * comprehensive report around these angles, and a deep-specific system prompt
   * replaces the standard one — so a deep run reads differently, not just wider.
   */
  researchPlan?: string[];
}): ChatMessage[] {
  const { query, inputType, sources, format, researchPlan } = args;
  const deep = Boolean(researchPlan && researchPlan.length > 0);

  const task =
    inputType === "url"
      ? `Write the article summarizing the following source for a reader who hasn't read it.`
      : `Write the article on this topic: "${query}"`;

  // In deep mode the dedicated system prompt already prescribes the structure,
  // so the (generic In-depth) format directive is redundant — skip it.
  const directive = resolveFormat(format).directive;
  const formatBlock = !deep && directive ? `\n\nFORMAT: ${directive}` : "";

  const planBlock = deep
    ? `\n\nRESEARCH ANGLES — the reader's topic was decomposed into these; cover every one, synthesizing across sources:\n${researchPlan!
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`
    : "";

  const sourcesBlock = sources.map(formatSource).join("\n\n---\n\n");

  const user = `${task}${formatBlock}${planBlock}

Today's date: ${new Date().toISOString().slice(0, 10)}.

SOURCES:

${sourcesBlock}`;

  return [
    { role: "system", content: deep ? DEEP_SYSTEM_PROMPT : SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
