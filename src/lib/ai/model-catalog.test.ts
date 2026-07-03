import { describe, it, expect } from "vitest";
import {
  resolveModelId,
  defaultModelId,
  isThinkingSlug,
  modelSlug,
} from "@/lib/ai/model-catalog";

describe("resolveModelId", () => {
  it("clamps a choice above the tier to the tier default", () => {
    expect(resolveModelId("free", "claude-opus")).toBe("claude-haiku");
    expect(resolveModelId("pro", "claude-opus")).toBe("claude-sonnet");
  });

  it("keeps a choice the tier is allowed to use", () => {
    expect(resolveModelId("pro", "gpt-5")).toBe("gpt-5");
    expect(resolveModelId("max", "claude-sonnet")).toBe("claude-sonnet");
  });

  it("falls back to the tier default for missing/invalid choices", () => {
    expect(resolveModelId("free", undefined)).toBe("claude-haiku");
    expect(resolveModelId("pro", "not-a-model")).toBe(defaultModelId("pro"));
    expect(resolveModelId("max", null)).toBe("claude-opus");
  });
});

describe("isThinkingSlug", () => {
  it("flags GPT-5 and Gemini as thinking models, not Claude", () => {
    expect(isThinkingSlug(modelSlug("gpt-5"))).toBe(true);
    expect(isThinkingSlug(modelSlug("gemini-pro"))).toBe(true);
    expect(isThinkingSlug(modelSlug("claude-opus"))).toBe(false);
    expect(isThinkingSlug("some/unknown-slug")).toBe(false);
  });
});
