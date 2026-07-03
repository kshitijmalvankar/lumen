import { describe, it, expect } from "vitest";
import { parseArticle } from "@/lib/ai/parse";

describe("parseArticle", () => {
  it("extracts a leading # title", () => {
    const a = parseArticle("# The Real Title\n\nSome body [1].", "fallback query");
    expect(a.title).toBe("The Real Title");
  });

  it("derives a title from the query when none is present", () => {
    const a = parseArticle("Just one paragraph, no heading.", "climate change news");
    expect(a.title).toBe("Climate change news");
  });

  it("computes citation coverage over text blocks", () => {
    const a = parseArticle("# T\n\nCited claim [1].\n\nUncited claim.", "q");
    expect(a.citationCoverage).toBeCloseTo(0.5);
  });

  it("detects headings and marks multi-section output as an article", () => {
    const a = parseArticle("# T\n\n## Section\n\nBody [1][2].", "q");
    expect(a.blocks.find((b) => b.type === "heading")?.content).toBe("Section");
    expect(a.lengthKind).toBe("article");
  });

  it("collects all cited positions across blocks", () => {
    const a = parseArticle("# T\n\nA [1].\n\nB [3][1].", "q");
    expect([...a.citedPositions].sort((x, y) => x - y)).toEqual([1, 3]);
  });

  it("returns no blocks for empty output (guards the empty-article check)", () => {
    const a = parseArticle("", "q");
    expect(a.blocks).toHaveLength(0);
    expect(a.blocks.some((b) => b.type === "text")).toBe(false);
  });

  it("treats a title-only response as having no text blocks", () => {
    const a = parseArticle("# Only a title", "q");
    expect(a.blocks.some((b) => b.type === "text")).toBe(false);
  });
});
