export type CredibilityTier = "high" | "medium" | "low" | "unknown";

// Lightweight, transparent heuristic. Not exhaustive — a starting point that
// can be tuned or replaced with a real reputation source later.
const HIGH_DOMAINS = new Set([
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "nytimes.com",
  "wsj.com",
  "washingtonpost.com",
  "theguardian.com",
  "economist.com",
  "ft.com",
  "bloomberg.com",
  "nature.com",
  "science.org",
  "nejm.org",
  "thelancet.com",
  "who.int",
  "nih.gov",
  "cdc.gov",
  "arxiv.org",
  "pubmed.ncbi.nlm.nih.gov",
  "nasa.gov",
  "imf.org",
  "worldbank.org",
]);

const MEDIUM_DOMAINS = new Set([
  "wikipedia.org",
  "techcrunch.com",
  "theverge.com",
  "wired.com",
  "arstechnica.com",
  "cnbc.com",
  "forbes.com",
  "businessinsider.com",
  "medium.com",
  "substack.com",
]);

function rootDomain(domain: string): string {
  const d = domain.replace(/^www\./, "").toLowerCase();
  const parts = d.split(".");
  // Keep the last two labels for the common case (example.com).
  return parts.length > 2 ? parts.slice(-2).join(".") : d;
}

export function scoreCredibility(domain: string): CredibilityTier {
  if (!domain) return "unknown";
  const d = domain.replace(/^www\./, "").toLowerCase();
  const root = rootDomain(d);

  if (HIGH_DOMAINS.has(d) || HIGH_DOMAINS.has(root)) return "high";
  // Government, education, and major intergovernmental TLDs → high.
  if (/\.(gov|edu|int)(\.[a-z]{2})?$/.test(d)) return "high";
  if (/\.ac\.[a-z]{2}$/.test(d)) return "high";

  if (MEDIUM_DOMAINS.has(d) || MEDIUM_DOMAINS.has(root)) return "medium";
  if (/\.org$/.test(d)) return "medium";

  return "low";
}
