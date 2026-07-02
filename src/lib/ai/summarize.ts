import { getOpenRouter } from "./openrouter";
import type { ChatMessage } from "./prompts";

export type ReasoningEffort = "low" | "medium" | "high";

/**
 * Stream an article completion from OpenRouter, yielding text deltas.
 *
 * `reasoningEffort` (set for "thinking" models) caps hidden reasoning via
 * OpenRouter's unified `reasoning` param so they answer quickly. The generous
 * token cap leaves room for both reasoning and the article; Claude models stop
 * when done, so the ceiling doesn't change their length or cost.
 */
export async function* streamSummary(args: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
}): AsyncGenerator<string> {
  const { model, messages, maxTokens = 8000, reasoningEffort } = args;
  const client = getOpenRouter();

  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    max_tokens: maxTokens,
    // SDK-native reasoning control; OpenRouter forwards it to the model. Only
    // set for thinking models, so Claude is unaffected.
    reasoning_effort: reasoningEffort,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
