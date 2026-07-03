/**
 * Normalize a raw AI-analysis response: trims it, and treats the "NONE"
 * sentinel (possibly wrapped in quotes/punctuation) or an empty string as
 * "nothing to add" → "". Pure and dependency-free so it's unit-testable.
 */
export function normalizeAnalysis(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  // "NONE", possibly wrapped in quotes/punctuation, means "nothing to add".
  if (t.replace(/[^a-z]/gi, "").toUpperCase() === "NONE") return "";
  return t;
}
