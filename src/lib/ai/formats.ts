// Output "lenses" for a search — each is a prompt directive that shapes the
// generated article. Client-safe (no server-only): the picker uses the labels,
// the prompt builder uses the directive. Rendering is unchanged (Markdown tables
// etc. render via remark-gfm).

export type SearchFormat =
  | "standard"
  | "brief"
  | "deep"
  | "comparison"
  | "pros_cons"
  | "eli5";

export interface FormatDef {
  id: SearchFormat;
  label: string;
  hint: string;
  /** Appended to the generation prompt; empty for the default. */
  directive: string;
  /** Optional generation ceiling override (deep = longer, brief = shorter). */
  maxTokens?: number;
}

export const DEFAULT_FORMAT: SearchFormat = "standard";

export const SEARCH_FORMATS: FormatDef[] = [
  {
    id: "standard",
    label: "Standard",
    hint: "Balanced explainer",
    directive: "",
  },
  {
    id: "brief",
    label: "Brief",
    hint: "A tight TL;DR",
    directive:
      "Keep it very short: a single tight paragraph (2–4 sentences) capturing only the essentials. No section headings.",
    maxTokens: 1200,
  },
  {
    id: "deep",
    label: "In-depth",
    hint: "Longer & thorough",
    directive:
      'Write a thorough, multi-section article: cover context, the key details, competing views, and implications, each under its own "##" heading.',
    maxTokens: 12000,
  },
  {
    id: "comparison",
    label: "Comparison",
    hint: "Compare the options",
    directive:
      "Structure the answer as a comparison. Include a Markdown comparison table across the key dimensions of the options, then a short prose takeaway.",
  },
  {
    id: "pros_cons",
    label: "Pros & cons",
    hint: "Weigh both sides",
    directive:
      'Weigh the topic even-handedly: a "## Pros" (or benefits) section and a "## Cons" (or risks) section, then a short balanced takeaway.',
  },
  {
    id: "eli5",
    label: "Explain simply",
    hint: "Plain language",
    directive:
      "Explain in plain, simple language a curious beginner can follow. Avoid jargon; when a technical term is unavoidable, define it in a few words.",
  },
];

const BY_ID = new Map(SEARCH_FORMATS.map((f) => [f.id, f]));
export const FORMAT_IDS = SEARCH_FORMATS.map((f) => f.id);

/** Resolve a (possibly untrusted) format id to its definition; falls back to standard. */
export function resolveFormat(id: string | undefined | null): FormatDef {
  return (
    (id ? BY_ID.get(id as SearchFormat) : undefined) ?? BY_ID.get(DEFAULT_FORMAT)!
  );
}
