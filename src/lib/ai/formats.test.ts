import { describe, it, expect } from "vitest";
import { resolveFormat, DEFAULT_FORMAT, FORMAT_IDS } from "@/lib/ai/formats";

describe("resolveFormat", () => {
  it("falls back to standard for unknown/empty ids", () => {
    expect(resolveFormat(undefined).id).toBe(DEFAULT_FORMAT);
    expect(resolveFormat(null).id).toBe(DEFAULT_FORMAT);
    expect(resolveFormat("nope").id).toBe(DEFAULT_FORMAT);
  });

  it("resolves every known id; standard has no directive, others do", () => {
    for (const id of FORMAT_IDS) expect(resolveFormat(id).id).toBe(id);
    expect(resolveFormat("standard").directive).toBe("");
    expect(resolveFormat("brief").directive.length).toBeGreaterThan(0);
    expect(resolveFormat("deep").maxTokens ?? 0).toBeGreaterThan(8000);
    expect(resolveFormat("brief").maxTokens ?? 99999).toBeLessThan(8000);
  });
});
