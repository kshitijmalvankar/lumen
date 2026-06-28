"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Turn bare [n] citation markers into links to the source list.
function linkifyCitations(markdown: string): string {
  return markdown.replace(/\[(\d{1,3})\]/g, "[$1](#source-$1)");
}

function scrollToSource(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (el) {
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1200);
  }
}

const components: Components = {
  a({ href, children }) {
    if (href?.startsWith("#source-")) {
      return (
        <a
          href={href}
          className="citation"
          onClick={(e) => scrollToSource(e, href.slice(1))}
        >
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

export function CitationMarkdown({ markdown }: { markdown: string }) {
  const processed = React.useMemo(() => linkifyCitations(markdown), [markdown]);
  return (
    <div className="article">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
