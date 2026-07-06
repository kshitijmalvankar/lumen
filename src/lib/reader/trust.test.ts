import { describe, it, expect } from "vitest";
import { credibilityCounts } from "@/lib/reader/trust";

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
