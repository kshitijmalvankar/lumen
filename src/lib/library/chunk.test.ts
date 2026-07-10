import { describe, it, expect } from "vitest";
import { chunkArticle } from "@/lib/library/chunk";

describe("chunkArticle", () => {
  it("returns one chunk for a short article and reindexes from 0", () => {
    const chunks = chunkArticle("A short paragraph.\n\nAnother one.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toContain("A short paragraph.");
    expect(chunks[0].content).toContain("Another one.");
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("returns nothing for empty/whitespace input", () => {
    expect(chunkArticle("")).toHaveLength(0);
    expect(chunkArticle("\n\n   \n\n")).toHaveLength(0);
  });

  it("splits long content into multiple sequentially-indexed chunks", () => {
    const para = "word ".repeat(120); // ~600 chars
    const md = Array.from({ length: 8 }, () => para).join("\n\n");
    const chunks = chunkArticle(md);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
    // No chunk should wildly exceed the budget.
    chunks.forEach((c) => expect(c.content.length).toBeLessThanOrEqual(3000));
  });

  it("starts a fresh chunk at a heading once content has accumulated", () => {
    const body = "x".repeat(500); // above the heading-break threshold
    const md = `${body}\n\n## New Section\n\nMore text here.`;
    const chunks = chunkArticle(md);
    expect(chunks.length).toBe(2);
    expect(chunks[1].content).toContain("## New Section");
  });
});
