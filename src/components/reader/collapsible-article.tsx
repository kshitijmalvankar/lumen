"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { CitationMarkdown } from "@/components/search/citation-markdown";
import { splitSections } from "@/lib/reader/sections";
import { cn } from "@/lib/utils";

/**
 * The article body with each "##" section collapsible, so a long report (esp.
 * deep research) can be skimmed by heading. Collapsed sections stay in the DOM
 * (hidden on screen, shown for print) so PDF export still captures everything.
 * Falls back to a plain render when there's nothing worth collapsing.
 */
export function CollapsibleArticle({ markdown }: { markdown: string }) {
  const { intro, sections } = React.useMemo(
    () => splitSections(markdown),
    [markdown],
  );

  // Default = expanded; per-section overrides layer on top of the "all" default.
  const [openAll, setOpenAll] = React.useState(true);
  const [overrides, setOverrides] = React.useState<Record<number, boolean>>({});

  if (sections.length < 2) {
    return <CitationMarkdown markdown={markdown} markUnsourced />;
  }

  const isOpen = (i: number) => overrides[i] ?? openAll;
  const allExpanded = sections.every((_, i) => isOpen(i));

  const toggleAll = () => {
    setOpenAll(!allExpanded);
    setOverrides({});
  };

  return (
    <div>
      {intro && <CitationMarkdown markdown={intro} markUnsourced />}

      <div className="no-print mt-5 flex justify-end">
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="mt-1 divide-y divide-border/60 border-y border-border/60">
        {sections.map((s, i) => {
          const expanded = isOpen(i);
          return (
            <section key={i}>
              <h2 className="m-0">
                <button
                  type="button"
                  onClick={() =>
                    setOverrides((o) => ({ ...o, [i]: !expanded }))
                  }
                  aria-expanded={expanded}
                  className="group flex w-full items-center justify-between gap-3 py-4 text-left"
                >
                  <span className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {s.title}
                  </span>
                  <ChevronDown
                    className={cn(
                      "no-print h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
              </h2>
              <div className={cn("pb-5", !expanded && "hidden print:block")}>
                <CitationMarkdown markdown={s.body} markUnsourced />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
