import { env } from "@/lib/env";

/**
 * Use cases map to OpenRouter model slugs. Defaults below are sensible Claude
 * choices; override any of them via OPENROUTER_MODEL_* in .env.local without
 * touching code. Browse current slugs at https://openrouter.ai/models.
 *
 * Tip: set a model to "openrouter/auto" to let OpenRouter route dynamically.
 */
export type UseCase = "quick" | "deep" | "categorize";

const DEFAULTS: Record<UseCase, string> = {
  // Fast + strong, low cost — the default reader experience.
  quick: "anthropic/claude-sonnet-4.5",
  // Highest quality for multi-source deep research.
  deep: "anthropic/claude-opus-4.1",
  // Cheap + fast for background tagging/categorization.
  categorize: "anthropic/claude-haiku-4.5",
};

export function selectModel(useCase: UseCase): string {
  switch (useCase) {
    case "quick":
      return env.openrouterModelQuick || DEFAULTS.quick;
    case "deep":
      return env.openrouterModelDeep || DEFAULTS.deep;
    case "categorize":
      return env.openrouterModelCategorize || DEFAULTS.categorize;
  }
}
