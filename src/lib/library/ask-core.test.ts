import { describe, it, expect } from "vitest";
import { buildLibraryContext } from "@/lib/library/ask-core";

describe("buildLibraryContext", () => {
  it("labels articles [A1..] and maps each ref to its summary", () => {
    const ctx = buildLibraryContext([
      { summaryId: "s1", title: "Tides", passages: ["p1", "p2"] },
      { summaryId: "s2", title: "Moons", passages: ["q1"] },
    ]);

    expect(ctx.articles).toEqual([
      { ref: 1, summaryId: "s1", title: "Tides" },
      { ref: 2, summaryId: "s2", title: "Moons" },
    ]);
    expect(ctx.contextText).toContain("[A1] Tides");
    expect(ctx.contextText).toContain("[A2] Moons");
    // Passages within an article are joined together.
    expect(ctx.contextText).toContain("p1");
    expect(ctx.contextText).toContain("p2");
  });

  it("handles an empty retrieval set", () => {
    const ctx = buildLibraryContext([]);
    expect(ctx.articles).toHaveLength(0);
    expect(ctx.contextText).toBe("");
  });
});
