import OpenAI from "openai";
import { env, requireEnv } from "@/lib/env";

let _client: OpenAI | undefined;

/**
 * OpenAI-compatible client pointed at OpenRouter. One key, many models;
 * the model is chosen per request via selectModel() (see ./models.ts).
 */
export function getOpenRouter(): OpenAI {
  requireEnv("openrouterApiKey");
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.openrouterApiKey,
      baseURL: env.openrouterBaseUrl,
      defaultHeaders: {
        // Optional attribution headers OpenRouter uses for rankings.
        "HTTP-Referer": env.siteUrl,
        "X-Title": "Lumen",
      },
    });
  }
  return _client;
}
