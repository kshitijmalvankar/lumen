import { getOpenRouter } from "./openrouter";
import { categorizeModel } from "./models";
import type { ReasoningEffort } from "./summarize";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSource {
  position: number;
  title: string;
  domain: string;
  /** Excerpt of the source's full text (may be empty for older articles). */
  content?: string;
}

const CHAT_SYSTEM = `You are Lumen, a research assistant helping a reader dig deeper into an article they just read. Below are the article AND numbered excerpts from each of its sources. Answer the reader's follow-up using BOTH.

Rules:
- Ground every answer in the article and the source excerpts. Cite sources inline as [n] (matching the numbers) whenever you draw on them.
- You MAY use facts found in a source excerpt even if they aren't in the article body — that's encouraged.
- If the article and excerpts still don't cover the question, say so plainly — never invent facts, figures, or sources.
- Be concise and conversational: a few short paragraphs at most. Use Markdown when it aids clarity, but skip headings for short replies.
- Don't restate the whole article; answer the specific question asked.`;

function buildSystem(
  title: string,
  articleMarkdown: string,
  sources: ChatSource[],
): string {
  const src = sources
    .map((s) => {
      const head = `[${s.position}] ${s.title} — ${s.domain}`;
      return s.content ? `${head}\n${s.content}` : head;
    })
    .join("\n\n");
  return `${CHAT_SYSTEM}

ARTICLE TITLE: ${title}

ARTICLE:
${articleMarkdown}

SOURCES (with excerpts):
${src}`;
}

/**
 * Decide whether a follow-up can be answered from the saved article + its
 * sources, or whether a fresh web search is warranted. Cheap model; conservative
 * (defaults to "no search" on any parse/callout failure). Returns a focused
 * query when a search is needed.
 */
export async function classifyFollowup(args: {
  question: string;
  title: string;
  sources: { title: string; domain: string }[];
}): Promise<{ search: boolean; query?: string }> {
  try {
    const client = getOpenRouter();
    const src = args.sources
      .map((s) => `- ${s.title} (${s.domain})`)
      .join("\n");
    const res = await client.chat.completions.create({
      model: categorizeModel(),
      messages: [
        {
          role: "user",
          content: `A reader saved an article titled "${args.title}". Its sources are:\n${src}\n\nTheir follow-up question: "${args.question}"\n\nCan this be answered from that article and those sources, or do we clearly need a fresh web search? Reply with ONLY JSON: {"search": false} if answerable, or {"search": true, "query": "<focused web search query>"} if the article/sources clearly don't cover it.`,
        },
      ],
      max_tokens: 120,
    });
    const text = res.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]) as { search?: boolean; query?: string };
      if (j.search === true && typeof j.query === "string" && j.query.trim()) {
        return { search: true, query: j.query.trim() };
      }
    }
  } catch (err) {
    console.error("classifyFollowup failed:", err);
  }
  return { search: false };
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
