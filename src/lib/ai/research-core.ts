// Pure deep-research helpers — no server-only imports, so they're unit-testable.

/** Extract sub-questions from a model reply (JSON array, else line-based). */
export function parseQuestions(text: string, max: number): string[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(arr)) {
        return arr
          .map((q) => String(q).trim())
          .filter(Boolean)
          .slice(0, max);
      }
    } catch {
      // fall through to line parsing
    }
  }
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*\d.)"]+)\s*/, "").trim())
    .filter((l) => l.length > 8 && l.length < 200)
    .slice(0, max);
}
