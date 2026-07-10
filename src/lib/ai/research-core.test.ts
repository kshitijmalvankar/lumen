import { describe, it, expect } from "vitest";
import { parseQuestions } from "@/lib/ai/research-core";

describe("parseQuestions", () => {
  it("parses a JSON array embedded in prose and caps to max", () => {
    const text =
      'Sure! ["What are the health effects?", "What is the market size?", "What are the risks?"] hope that helps';
    expect(parseQuestions(text, 2)).toEqual([
      "What are the health effects?",
      "What is the market size?",
    ]);
  });

  it("falls back to line parsing when there's no JSON array", () => {
    const text = `1. What are the main drivers of adoption?
- How do regulators view it?
* What are the biggest open risks?`;
    const qs = parseQuestions(text, 5);
    expect(qs).toContain("What are the main drivers of adoption?");
    expect(qs).toContain("How do regulators view it?");
    expect(qs.length).toBe(3);
  });

  it("returns [] for empty input", () => {
    expect(parseQuestions("", 5)).toEqual([]);
  });
});
