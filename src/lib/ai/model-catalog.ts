import type { Tier } from "@/lib/billing/entitlements";

/**
 * The curated set of article models users can pick from. Only models that
 * reliably follow our citation/grounding prompt belong here — Lumen's whole
 * promise is cited, trustworthy articles, so a model that ignores [n] citations
 * would break the brand. Add others only after testing them against the prompt.
 *
 * NOTE: `slug` values are OpenRouter model ids — VERIFY them on
 * https://openrouter.ai/models and edit here if a slug is wrong; an invalid
 * slug makes that model's searches fail.
 */
export type ModelId =
  | "claude-haiku"
  | "claude-sonnet"
  | "claude-opus"
  | "gpt-5"
  | "gemini-pro";

export interface ModelMeta {
  id: ModelId;
  slug: string;
  label: string;
  provider: string;
  hint: string;
  /**
   * "Thinking" models (GPT-5, Gemini 2.5 Pro) spend output tokens on hidden
   * reasoning. We cap their reasoning effort to "low" so they answer quickly
   * instead of blowing past the request timeout; Claude models don't reason by
   * default, so they're left alone.
   */
  thinking?: boolean;
}

export const MODEL_CATALOG: Record<ModelId, ModelMeta> = {
  "claude-haiku": {
    id: "claude-haiku",
    slug: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku",
    provider: "Anthropic",
    hint: "Fastest",
  },
  "claude-sonnet": {
    id: "claude-sonnet",
    slug: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet",
    provider: "Anthropic",
    hint: "Balanced",
  },
  "claude-opus": {
    id: "claude-opus",
    slug: "anthropic/claude-opus-4.1",
    label: "Claude Opus",
    provider: "Anthropic",
    hint: "Deepest reasoning",
  },
  "gpt-5": {
    id: "gpt-5",
    slug: "openai/gpt-5",
    label: "GPT-5",
    provider: "OpenAI",
    hint: "Versatile",
    thinking: true,
  },
  "gemini-pro": {
    id: "gemini-pro",
    slug: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    hint: "Long-context",
    thinking: true,
  },
};

/**
 * Which models each tier may use. The FIRST id in each list is that tier's
 * default. Pricier/frontier models are reserved for higher tiers.
 */
export const TIER_PICKABLE: Record<Tier, ModelId[]> = {
  free: ["claude-haiku"],
  pro: ["claude-sonnet", "gpt-5", "gemini-pro"],
  max: ["claude-opus", "claude-sonnet", "gpt-5", "gemini-pro"],
};

export function pickableModels(tier: Tier): ModelMeta[] {
  return TIER_PICKABLE[tier].map((id) => MODEL_CATALOG[id]);
}

export function defaultModelId(tier: Tier): ModelId {
  return TIER_PICKABLE[tier][0];
}

/**
 * Clamp a (possibly client-supplied) model choice to what the tier is allowed
 * to use. Anything not on the tier's allowlist falls back to the default — so
 * the client can never request a model above its tier or an arbitrary slug.
 */
export function resolveModelId(tier: Tier, chosen?: string | null): ModelId {
  const allowed = TIER_PICKABLE[tier];
  if (chosen && (allowed as string[]).includes(chosen)) return chosen as ModelId;
  return allowed[0];
}

export function modelSlug(id: ModelId): string {
  return MODEL_CATALOG[id].slug;
}

export function isThinkingModel(id: ModelId): boolean {
  return Boolean(MODEL_CATALOG[id].thinking);
}
