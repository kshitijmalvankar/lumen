import { describe, it, expect } from "vitest";
import { segmentScript } from "@/lib/ai/audio-script";

describe("segmentScript", () => {
  it("returns a single chunk for short scripts", () => {
    const chunks = segmentScript("First sentence. Second sentence.");
    expect(chunks).toEqual(["First sentence. Second sentence."]);
  });

  it("strips [n] citation markers and collapses whitespace", () => {
    const chunks = segmentScript("A claim [1].  Another [23] claim.");
    expect(chunks).toEqual(["A claim . Another claim."]);
  });

  it("keeps every chunk under the max, splitting on sentence boundaries", () => {
    const sentence = `${"word ".repeat(80).trim()}. `;
    const script = sentence.repeat(60); // well over 4,500 chars
    const chunks = segmentScript(script);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(4500);
    // Nothing dropped: total non-space chars are preserved.
    const strip = (s: string) => s.replace(/\s/g, "");
    const joined = chunks.map(strip).join("");
    expect(joined).toBe(strip(script));
  });

  it("hard-splits a single overlong sentence", () => {
    const long = "x".repeat(10000);
    const chunks = segmentScript(long, 4500);
    expect(chunks.length).toBe(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(4500);
  });

  it("returns an empty array for empty input", () => {
    expect(segmentScript("   ")).toEqual([]);
  });
});
