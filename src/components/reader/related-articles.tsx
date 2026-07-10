import Link from "next/link";
import { Sparkles, ArrowUpRight } from "lucide-react";
import type { RelatedArticle } from "@/lib/library/related";

/** "Related in your library" — semantic neighbours of the current article. */
export function RelatedArticles({ related }: { related: RelatedArticle[] }) {
  if (related.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-brand">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Related in your library
        </h2>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {related.map((r) => (
          <li key={r.summaryId}>
            <Link
              href={`/app/article/${r.summaryId}`}
              className="lift group flex items-start justify-between gap-2 rounded-xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-sm transition-colors hover:border-brand/40"
            >
              <span className="line-clamp-2 min-w-0 text-sm font-medium leading-snug transition-colors group-hover:text-brand">
                {r.title}
              </span>
              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-brand" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
