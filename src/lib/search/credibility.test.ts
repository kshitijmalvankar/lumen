import { describe, it, expect } from "vitest";
import { scoreCredibility } from "@/lib/search/credibility";

describe("scoreCredibility", () => {
  it("rates established outlets high", () => {
    for (const d of ["reuters.com", "bbc.co.uk", "nature.com"]) {
      expect(scoreCredibility(d)).toBe("high");
    }
  });

  it("rates gov/edu/ac domains high", () => {
    expect(scoreCredibility("cdc.gov")).toBe("high");
    expect(scoreCredibility("some-agency.gov")).toBe("high");
    expect(scoreCredibility("harvard.edu")).toBe("high");
    expect(scoreCredibility("ox.ac.uk")).toBe("high");
    expect(scoreCredibility("pib.gov.in")).toBe("high");
  });

  it("rates curated Indian outlets fairly", () => {
    for (const d of [
      "thehindu.com",
      "livemint.com",
      "business-standard.com",
      "economictimes.indiatimes.com",
      "rbi.org.in",
    ]) {
      expect(scoreCredibility(d)).toBe("high");
    }
    for (const d of [
      "hindustantimes.com",
      "ndtv.com",
      "timesofindia.indiatimes.com",
      "moneycontrol.com",
    ]) {
      expect(scoreCredibility(d)).toBe("medium");
    }
  });

  it("distinguishes ET (high) from TOI (medium) on the shared indiatimes.com root", () => {
    expect(scoreCredibility("economictimes.indiatimes.com")).toBe("high");
    expect(scoreCredibility("timesofindia.indiatimes.com")).toBe("medium");
  });

  it("strips www and handles medium/low/unknown", () => {
    expect(scoreCredibility("www.reuters.com")).toBe("high");
    expect(scoreCredibility("example.org")).toBe("medium");
    expect(scoreCredibility("some-random-blog.xyz")).toBe("low");
    expect(scoreCredibility("")).toBe("unknown");
  });
});
