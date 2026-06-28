const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Format a date as "Jun 28, 2026" deterministically.
 *
 * Uses UTC and a fixed month table so the server and client always produce the
 * exact same string — `toLocaleDateString` varies by locale/timezone and causes
 * React hydration mismatches. Returns "" for null/invalid input.
 */
export function formatDate(
  input: string | number | Date | null | undefined,
): string {
  if (input == null) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
