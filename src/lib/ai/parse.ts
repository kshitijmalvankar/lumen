export interface ParsedBlock {
  position: number;
  type: "text" | "heading";
  content: string;
  citedPositions: number[]; // source indices referenced in this block
}

export interface ParsedArticle {
  title: string;
  blocks: ParsedBlock[];
  lengthKind: "paragraph" | "article";
  citationCoverage: number; // 0..1 over text blocks
  citedPositions: number[]; // all referenced source indices
}

function findCitations(text: string): number[] {
  const nums = new Set<number>();
  const re = /\[(\d{1,3})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) nums.add(Number(m[1]));
  return [...nums];
}

function deriveTitle(fallback: string): string {
  const words = fallback.trim().split(/\s+/).slice(0, 10).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Parse the model's Markdown into a stored title + ordered blocks + citation map. */
export function parseArticle(markdown: string, fallbackQuery: string): ParsedArticle {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");

  // Extract the leading "# Title" if present.
  let title = "";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      title = h1[1].trim();
      bodyStart = i + 1;
    }
    break;
  }
  if (!title) title = deriveTitle(fallbackQuery);

  const body = lines.slice(bodyStart).join("\n").trim();
  const segments = body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const blocks: ParsedBlock[] = segments.map((seg, i) => {
    const headingMatch = seg.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      return {
        position: i,
        type: "heading",
        content: headingMatch[2].trim(),
        citedPositions: [],
      };
    }
    return {
      position: i,
      type: "text",
      content: seg,
      citedPositions: findCitations(seg),
    };
  });

  const textBlocks = blocks.filter((b) => b.type === "text");
  const cited = textBlocks.filter((b) => b.citedPositions.length > 0);
  const citationCoverage =
    textBlocks.length === 0 ? 0 : cited.length / textBlocks.length;

  const hasHeading = blocks.some((b) => b.type === "heading");
  const lengthKind: "paragraph" | "article" =
    hasHeading || body.length > 900 ? "article" : "paragraph";

  const allCited = new Set<number>();
  blocks.forEach((b) => b.citedPositions.forEach((n) => allCited.add(n)));

  return {
    title,
    blocks,
    lengthKind,
    citationCoverage,
    citedPositions: [...allCited],
  };
}
