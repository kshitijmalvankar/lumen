// Pure library-answer context assembly + shared types — no server-only imports,
// so it's unit-testable and safe to import from client components (types only).

/** A saved article contributing passages to an answer, in relevance order. */
export interface ContextArticle {
  summaryId: string;
  title: string;
  passages: string[];
}

/** [A#] → article mapping the client uses to linkify citations. */
export interface ArticleRef {
  ref: number;
  summaryId: string;
  title: string;
}

export interface LibraryContext {
  contextText: string;
  articles: ArticleRef[];
}

/**
 * Assemble retrieved passages into a labelled grounding block for the model plus
 * the [A#]→article map for the client.
 */
export function buildLibraryContext(articles: ContextArticle[]): LibraryContext {
  const refs: ArticleRef[] = articles.map((a, i) => ({
    ref: i + 1,
    summaryId: a.summaryId,
    title: a.title,
  }));
  const contextText = articles
    .map((a, i) => `[A${i + 1}] ${a.title}\n${a.passages.join("\n\n…\n\n")}`)
    .join("\n\n---\n\n");
  return { contextText, articles: refs };
}
