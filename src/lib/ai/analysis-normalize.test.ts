import { describe, it, expect } from "vitest";
import { normalizeAnalysis } from "@/lib/ai/analysis-normalize";

describe("normalizeAnalysis", () => {
  it("passes through real content, trimmed", () => {
    expect(normalizeAnalysis("  Real analysis.  ")).toBe("Real analysis.");
  });

  it("treats the NONE sentinel (any wrapping/case) as empty", () => {
    expect(normalizeAnalysis("NONE")).toBe("");
    expect(normalizeAnalysis('"NONE"')).toBe("");
    expect(normalizeAnalysis("none.")).toBe("");
    expect(normalizeAnalysis("  NONE  ")).toBe("");
  });

  it("treats empty/whitespace as empty", () => {
    expect(normalizeAnalysis("")).toBe("");
    expect(normalizeAnalysis("   ")).toBe("");
  });

  it("does not clobber prose that merely contains the word none", () => {
    expect(normalizeAnalysis("There is none left to discuss.")).toBe(
      "There is none left to discuss.",
    );
  });
});
