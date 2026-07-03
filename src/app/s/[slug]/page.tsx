import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { env } from "@/lib/env";
import { getSharedArticle } from "@/lib/share/queries";
import { CitationMarkdown } from "@/components/search/citation-markdown";
import { CoverageNote } from "@/components/search/coverage-note";
import { SourceList } from "@/components/search/source-list";
import { ShareNav, LockedAnalysis, SignupCta } from "@/components/share/share-cta";
import { SiteFooter } from "@/components/site-footer";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** First ~160 chars of plain text from the article body, for link previews. */
function excerpt(markdown: string): string {
  const text = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(\d{1,3})\]/g, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getSharedArticle(slug);
  if (!article) return { title: "Article not found · Lumen" };

  const title = `${article.title} · Lumen`;
  const description = excerpt(article.bodyMarkdown);
  const url = `${env.siteUrl}/s/${slug}`;

  return {
    title,
    description,
    // Shared research can be sensitive (health, finance, personal). Keep public
    // links out of search results — they're for direct sharing, not indexing.
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description,
      url,
      siteName: "Lumen",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
  };
}

export default async function SharedArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getSharedArticle(slug);
  if (!article) notFound();

  const date = formatDate(article.createdAt);

  return (
    <div className="relative flex min-h-full flex-col">
      <ShareNav />

      <main className="mx-auto w-full max-w-3xl px-6 pb-16">
        <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <header>
            <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight">
              {article.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {date && <span>{date}</span>}
              {date && <span>·</span>}
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {article.sources.length}{" "}
                {article.sources.length === 1 ? "source" : "sources"}
              </span>
            </div>
          </header>

          <div className="mt-6">
            <CitationMarkdown markdown={article.bodyMarkdown} />
          </div>

          {article.citationCoverage != null && (
            <CoverageNote coverage={article.citationCoverage} />
          )}

          {article.hasAnalysis && <LockedAnalysis />}

          <SourceList sources={article.sources} />

          <SignupCta />

          <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            Lumen summarizes sources and can be wrong — open the sources to verify
            any claim. Informational only, not professional (medical, legal, or
            financial) advice.
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
