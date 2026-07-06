import { describe, it, expect } from "vitest";
import {
  maxTier,
  parseDomainRatings,
  sanitizeLlmRating,
} from "@/lib/search/ratings-core";

describe("maxTier", () => {
  it("keeps the stronger tier regardless of order", () => {
    expect(maxTier("high", "low")).toBe("high");
    expect(maxTier("low", "high")).toBe("high");
    expect(maxTier("unknown", "medium")).toBe("medium");
  });

  it("never downgrades a hardcoded-High floor", () => {
    expect(maxTier("high", "medium")).toBe("high");
    expect(maxTier("high", "unknown")).toBe("high");
  });
});

describe("parseDomainRatings", () => {
  it("parses a clean JSON array", () => {
    const out = parseDomainRatings(
      '[{"domain":"nytimes.com","credibility":"high","lean":"lean-left","confidence":0.8}]',
    );
    expect(out).toEqual([
      {
        domain: "nytimes.com",
        credibilityTier: "high",
        politicalLean: "lean-left",
        confidence: 0.8,
      },
    ]);
  });

  it("tolerates code fences and normalizes the domain", () => {
    const out = parseDomainRatings(
      '```json\n[{"domain":"WWW.Foo.COM","credibility":"medium","lean":"center"}]\n```',
    );
    expect(out).toHaveLength(1);
    expect(out[0].domain).toBe("foo.com");
    expect(out[0].confidence).toBe(0.5); // default when omitted
  });

  it("drops entries with an invalid enum", () => {
    const out = parseDomainRatings(
      '[{"domain":"a.com","credibility":"amazing","lean":"center"},{"domain":"b.com","credibility":"low","lean":"sideways"}]',
    );
    expect(out).toEqual([]);
  });

  it("clamps confidence to 0..1 and dedupes by domain", () => {
    const out = parseDomainRatings(
      '[{"domain":"a.com","credibility":"low","lean":"right","confidence":9},{"domain":"a.com","credibility":"high","lean":"left"}]',
    );
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(1);
  });

  it("returns [] for non-array or garbage", () => {
    expect(parseDomainRatings("not json")).toEqual([]);
    expect(parseDomainRatings('{"domain":"a.com"}')).toEqual([]);
  });
});

describe("sanitizeLlmRating", () => {
  it("caps an LLM-asserted 'high' credibility at 'medium'", () => {
    const r = sanitizeLlmRating({
      domain: "sketchy.example",
      credibilityTier: "high",
      politicalLean: "center",
      confidence: 0.9,
    });
    expect(r.credibilityTier).toBe("medium");
  });

  it("keeps medium/low credibility unchanged", () => {
    expect(
      sanitizeLlmRating({
        domain: "a.com",
        credibilityTier: "low",
        politicalLean: "right",
        confidence: 0.9,
      }).credibilityTier,
    ).toBe("low");
  });

  it("drops a low-confidence lean to unknown", () => {
    const r = sanitizeLlmRating({
      domain: "a.com",
      credibilityTier: "medium",
      politicalLean: "left",
      confidence: 0.3,
    });
    expect(r.politicalLean).toBe("unknown");
  });

  it("keeps a confident lean", () => {
    const r = sanitizeLlmRating({
      domain: "a.com",
      credibilityTier: "medium",
      politicalLean: "lean-right",
      confidence: 0.8,
    });
    expect(r.politicalLean).toBe("lean-right");
  });
});
