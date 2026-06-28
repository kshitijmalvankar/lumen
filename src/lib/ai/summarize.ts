import { getOpenRouter } from "./openrouter";
import type { ChatMessage } from "./prompts";

/**
 * Stream an article completion from OpenRouter, yielding text deltas.
 */
export async function* streamSummary(args: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): AsyncGenerator<string> {
  const { model, messages, maxTokens = 2000 } = args;
  const client = getOpenRouter();

  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    max_tokens: maxTokens,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
