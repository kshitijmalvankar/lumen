// Pure article chunking — no server-only imports, so it's unit-testable. Used by
// the embeddings indexer to split an article body into embedding-sized passages.

// ~500 tokens ≈ 2000 chars. Chunk on paragraph/heading boundaries so a chunk is
// a coherent passage, and hard-split any single monster paragraph.
const MAX_CHARS = 2000;
const HEADING_BREAK_MIN = 400;

export interface ArticleChunk {
  index: number;
  content: string;
  tokenCount: number;
}

/**
 * Split an article's Markdown body into embedding-sized chunks. Keeps paragraphs
 * whole where possible and starts a fresh chunk at a heading once the current
 * chunk has meaningful content.
 */
export function chunkArticle(markdown: string): ArticleChunk[] {
  const paras = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };

  for (const p of paras) {
    const isHeading = p.startsWith("#");
    if (
      cur &&
      (cur.length + p.length + 2 > MAX_CHARS ||
        (isHeading && cur.length > HEADING_BREAK_MIN))
    ) {
      flush();
    }
    cur = cur ? `${cur}\n\n${p}` : p;
    // Hard-split a single over-long paragraph so no chunk blows the budget.
    while (cur.length > MAX_CHARS * 1.5) {
      chunks.push(cur.slice(0, MAX_CHARS).trim());
      cur = cur.slice(MAX_CHARS);
    }
  }
  flush();

  return chunks.map((content, index) => ({
    index,
    content,
    tokenCount: Math.ceil(content.length / 4),
  }));
}
