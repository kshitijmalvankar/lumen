"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ArticleRef } from "@/lib/library/ask-core";

// Turn [A#] citation markers into links to the article they reference.
function linkifyArticleRefs(markdown: string, articles: ArticleRef[]): string {
  const byRef = new Map(articles.map((a) => [a.ref, a.summaryId]));
  return markdown.replace(/\[A(\d{1,3})\]/g, (m, n: string) => {
    const id = byRef.get(Number(n));
    return id ? `[A${n}](/app/article/${id})` : m;
  });
}

const components: Components = {
  a: ({ href, children }) => {
    if (href?.startsWith("/app/article/")) {
      return (
        <a href={href} className="citation">
          {children}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
};

/** Renders a library answer, linkifying [A#] to the cited saved article. */
export function LibraryMarkdown({
  markdown,
  articles,
}: {
  markdown: string;
  articles: ArticleRef[];
}) {
  const processed = React.useMemo(
    () => linkifyArticleRefs(markdown, articles),
    [markdown, articles],
  );
  return (
    <div className="article">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
