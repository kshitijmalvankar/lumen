import { env } from "@/lib/env";

/**
 * Model used for background source discovery (the OpenRouter `web` plugin) and
 * tagging — cheap, fast, tier-agnostic. The user-facing article model is chosen
 * per tier/pick in ./model-catalog.ts.
 *
 * Override via OPENROUTER_MODEL_CATEGORIZE without touching code.
 */
const CATEGORIZE_DEFAULT = "anthropic/claude-haiku-4.5";

export function categorizeModel(): string {
  return env.openrouterModelCategorize || CATEGORIZE_DEFAULT;
}
