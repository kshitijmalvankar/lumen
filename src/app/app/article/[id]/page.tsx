import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2, FileText } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getArticle } from "@/lib/library/queries";
import { CitationMarkdown } from "@/components/search/citation-markdown";
import { CoverageNote } from "@/components/search/coverage-note";
import { SourceList } from "@/components/search/source-list";
import { BookmarkButton } from "@/components/library/bookmark-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatDate(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const article = await getArticle(supabase, id);
  if (!article) notFound();

  const date = formatDate(article.createdAt);

  return (
    <article>
      <Link
        href="/app/library"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 text-muted-foreground",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Library
      </Link>

      <header className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            {article.title}
          </h1>
          <BookmarkButton
            summaryId={article.summaryId}
            initial={article.bookmarked}
            withLabel
            className="mt-1 shrink-0"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {date && <span>{date}</span>}
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {article.sources.length}{" "}
            {article.sources.length === 1 ? "source" : "sources"}
          </span>
          {article.query && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                {article.inputType === "url" && (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                <span className="max-w-xs truncate">{article.query}</span>
              </span>
            </>
          )}
        </div>
      </header>

      <div className="mt-6">
        <CitationMarkdown markdown={article.bodyMarkdown} />
      </div>

      {article.citationCoverage != null && (
        <CoverageNote coverage={article.citationCoverage} />
      )}

      <SourceList sources={article.sources} />

      <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        Lumen summarizes sources and can be wrong — open the sources to verify
        any claim. Informational only, not professional (medical, legal, or
        financial) advice.
      </p>
    </article>
  );
}
