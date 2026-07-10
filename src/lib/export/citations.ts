import type { SourceMeta } from "@/components/search/source-list";

// Build citation-manager exports (BibTeX / RIS) from an article's sources. Pure
// — unit tested. Each source becomes a web/misc entry keyed by domain + index.

function escapeBibtex(s: string): string {
  return s.replace(/[{}]/g, "").replace(/\\/g, "");
}

function citationKey(s: SourceMeta): string {
  const base = (s.domain || "source")
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9]/g, "");
  return `${base || "source"}${s.position}`;
}

function yearOf(s: SourceMeta): string | null {
  if (!s.publishedAt) return null;
  const y = s.publishedAt.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

/** A BibTeX `@misc` bibliography for the article's sources. */
export function buildBibTeX(sources: SourceMeta[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return sources
    .map((s) => {
      const fields = [
        `  title = {${escapeBibtex(s.title || s.domain || s.url)}}`,
        `  howpublished = {\\url{${s.url}}}`,
        `  note = {Accessed ${today}}`,
      ];
      const year = yearOf(s);
      if (year) fields.push(`  year = {${year}}`);
      if (s.domain) fields.push(`  publisher = {${escapeBibtex(s.domain)}}`);
      return `@misc{${citationKey(s)},\n${fields.join(",\n")}\n}`;
    })
    .join("\n\n");
}

/** An RIS bibliography (importable by Zotero/EndNote/Mendeley). */
export function buildRIS(sources: SourceMeta[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return sources
    .map((s) => {
      const lines = ["TY  - ELEC", `TI  - ${s.title || s.domain || s.url}`];
      const year = yearOf(s);
      if (year) lines.push(`PY  - ${year}`);
      if (s.domain) lines.push(`PB  - ${s.domain}`);
      lines.push(`UR  - ${s.url}`, `Y2  - ${today}`, "ER  - ");
      return lines.join("\n");
    })
    .join("\n\n");
}
