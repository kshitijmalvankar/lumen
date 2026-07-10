import { getOpenRouter } from "./openrouter";
import type { ReasoningEffort } from "./summarize";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSource {
  position: number;
  title: string;
  domain: string;
}

const CHAT_SYSTEM = `You are Lumen, a research assistant helping a reader dig deeper into ONE specific article they just finished. The article and its numbered sources are given below. Answer the reader's follow-up questions about this material.

Rules:
- Ground every answer in the article and its sources. Cite sources inline as [n] (matching the source numbers) whenever you draw on them.
- If a question goes beyond what the article and sources cover, say so plainly and answer only as far as the material supports — never invent facts, figures, or sources.
- Be concise and conversational: a few short paragraphs at most. Use Markdown when it aids clarity, but skip headings for short replies.
- Don't restate the whole article; answer the specific question asked.`;

function buildSystem(
  title: string,
  articleMarkdown: string,
  sources: ChatSource[],
): string {
  const src = sources
    .map((s) => `[${s.position}] ${s.title} — ${s.domain}`)
    .join("\n");
  return `${CHAT_SYSTEM}

ARTICLE TITLE: ${title}

ARTICLE:
${articleMarkdown}

SOURCES:
${src}`;
}

/**
 * Stream an answer to a follow-up question, grounded in one article and its
 * sources. Prior turns are replayed so the model keeps conversational context.
 * `reasoningEffort` is set for thinking models so they stay within the timeout.
 */
export async function* streamChatAnswer(args: {
  model: string;
  title: string;
  articleMarkdown: string;
  sources: ChatSource[];
  history: ChatTurn[];
  question: string;
  reasoningEffort?: ReasoningEffort;
}): AsyncGenerator<string> {
  const { model, title, articleMarkdown, sources, history, question, reasoningEffort } =
    args;
  const client = getOpenRouter();

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: buildSystem(title, articleMarkdown, sources) },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ],
    stream: true,
    max_tokens: 4000,
    reasoning_effort: reasoningEffort,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

const LIBRARY_SYSTEM = `You are Lumen, helping a reader think across THEIR OWN saved research library. Below are the most relevant passages from their saved articles, each labelled [A1], [A2], … Answer the reader's question using only this material.

Rules:
- Ground every claim in the passages provided and cite the article it came from inline as [A1], [A2], etc. (matching the labels). Cite as you go.
- Synthesize across articles when useful — call out where they agree, disagree, or leave a gap.
- If the library doesn't cover the question, say so plainly. Never invent facts, figures, or articles, and never cite a label that isn't listed.
- Be concise and conversational: a few short paragraphs at most. Use Markdown when it aids clarity.`;

/**
 * Stream an answer grounded in retrieved passages from across the reader's
 * library. Passages are pre-assembled into `contextText` with [A#] labels; the
 * model cites those labels, which the client turns into links to each article.
 */
export async function* streamLibraryAnswer(args: {
  model: string;
  contextText: string;
  question: string;
  reasoningEffort?: ReasoningEffort;
}): AsyncGenerator<string> {
  const { model, contextText, question, reasoningEffort } = args;
  const client = getOpenRouter();

  const stream = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `${LIBRARY_SYSTEM}\n\nLIBRARY PASSAGES:\n${contextText}`,
      },
      { role: "user", content: question },
    ],
    stream: true,
    max_tokens: 2000,
    reasoning_effort: reasoningEffort,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
