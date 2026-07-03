import { describe, it, expect } from "vitest";
import { parseSuggestions } from "@/lib/ai/suggest";

describe("parseSuggestions", () => {
  it("parses a clean JSON array", () => {
    const r = parseSuggestions(
      '[{"kind":"topic","prompt":"AI in India","reason":"You read AI"},' +
        '{"kind":"deepen","prompt":"GLP-1 side effects","reason":"From your reads"}]',
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({
      kind: "topic",
      prompt: "AI in India",
      reason: "You read AI",
    });
    expect(r[1].kind).toBe("deepen");
  });

  it("strips ```json code fences", () => {
    const r = parseSuggestions('```json\n[{"prompt":"Fusion energy status"}]\n```');
    expect(r).toHaveLength(1);
    expect(r[0].prompt).toBe("Fusion energy status");
    expect(r[0].kind).toBe("topic"); // default when kind missing
  });

  it("extracts an array embedded in prose", () => {
    const r = parseSuggestions(
      'Here you go: [{"prompt":"Bond market outlook"}] hope that helps',
    );
    expect(r).toHaveLength(1);
    expect(r[0].prompt).toBe("Bond market outlook");
  });

  it("defaults an unknown kind to topic and drops promptless items", () => {
    const r = parseSuggestions(
      '[{"kind":"weird","prompt":"X"},{"reason":"no prompt"}]',
    );
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe("topic");
  });

  it("dedupes case-insensitively and caps at 5", () => {
    const raw = JSON.stringify([
      ...Array.from({ length: 8 }, (_, i) => ({ prompt: `Topic ${i}` })),
      { prompt: "topic 0" }, // case-insensitive dup
    ]);
    const r = parseSuggestions(raw);
    expect(r.length).toBeLessThanOrEqual(5);
    const lowered = r.map((s) => s.prompt.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });

  it("returns [] for non-array or garbage", () => {
    expect(parseSuggestions('{"prompt":"x"}')).toEqual([]);
    expect(parseSuggestions("not json at all")).toEqual([]);
    expect(parseSuggestions("")).toEqual([]);
  });
});
