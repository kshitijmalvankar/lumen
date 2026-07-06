"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Turn bare [n] citation markers into links to the source list.
function linkifyCitations(markdown: string): string {
  return markdown.replace(/\[(\d{1,3})\]/g, "[$1](#source-$1)");
}

// Minimal hast node shape — enough to walk for citation links.
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

// Does this paragraph's rendered subtree contain a [n] → #source-n citation?
function hasCitationLink(node: HastNode | undefined): boolean {
  if (!node?.children) return false;
  return node.children.some((c) => {
    if (c.type !== "element") return false;
    const href = c.properties?.href;
    if (
      c.tagName === "a" &&
      typeof href === "string" &&
      href.startsWith("#source-")
    ) {
      return true;
    }
    return hasCitationLink(c);
  });
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

const citationLink: Components["a"] = ({ href, children }) => {
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
};

// When honest-attribution highlighting is on, flag paragraphs with no citation
// so the reader can see exactly which claims are backed by a source.
const markedParagraph: Components["p"] = ({ node, children }) => {
  const unsourced = !hasCitationLink(node as unknown as HastNode);
  return (
    <p
      className={unsourced ? "unsourced" : undefined}
      title={unsourced ? "No source cited for this paragraph" : undefined}
    >
      {children}
    </p>
  );
};

export function CitationMarkdown({
  markdown,
  markUnsourced = false,
}: {
  markdown: string;
  /** Flag paragraphs with no [n] citation. On for articles, off for chat/analysis. */
  markUnsourced?: boolean;
}) {
  const processed = React.useMemo(() => linkifyCitations(markdown), [markdown]);
  const components = React.useMemo<Components>(
    () => (markUnsourced ? { a: citationLink, p: markedParagraph } : { a: citationLink }),
    [markUnsourced],
  );
  return (
    <div className="article">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
