import { describe, it, expect } from "vitest";
import { credibilityCounts, leanBalance } from "@/lib/reader/trust";

describe("credibilityCounts", () => {
  it("tallies each tier", () => {
    const counts = credibilityCounts([
      { credibilityTier: "high" },
      { credibilityTier: "high" },
      { credibilityTier: "medium" },
      { credibilityTier: "low" },
      { credibilityTier: "unknown" },
    ]);
    expect(counts).toEqual({ high: 2, medium: 1, low: 1, unknown: 1 });
  });

  it("returns all zeros for no sources", () => {
    expect(credibilityCounts([])).toEqual({
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    });
  });
});

describe("leanBalance", () => {
  it("folds lean-left/right into left/right and ignores unknown", () => {
    const b = leanBalance([
      { politicalLean: "left" },
      { politicalLean: "lean-left" },
      { politicalLean: "center" },
      { politicalLean: "lean-right" },
      { politicalLean: "unknown" },
      {},
    ]);
    expect(b.left).toBe(2);
    expect(b.center).toBe(1);
    expect(b.right).toBe(1);
    expect(b.rated).toBe(4);
  });

  it("labels a strong left skew as mostly left-leaning", () => {
    const b = leanBalance([
      { politicalLean: "left" },
      { politicalLean: "left" },
      { politicalLean: "lean-left" },
      { politicalLean: "center" },
    ]);
    expect(b.label).toBe("Mostly left-leaning");
  });

  it("labels an even split as a balanced mix", () => {
    const b = leanBalance([
      { politicalLean: "left" },
      { politicalLean: "right" },
      { politicalLean: "center" },
    ]);
    expect(b.label).toBe("Balanced mix");
  });

  it("reports no rated sources when all are unknown", () => {
    const b = leanBalance([{ politicalLean: "unknown" }, {}]);
    expect(b.rated).toBe(0);
    expect(b.label).toBe("Balanced mix");
  });
});
