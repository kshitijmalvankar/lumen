import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { isSupabaseConfigured, isHumeConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getArticle } from "@/lib/library/queries";
import { getActiveShareUrl } from "@/lib/share/queries";
import { getMessages } from "@/lib/library/messages";
import {
  listCollections,
  getArticleCollectionIds,
} from "@/lib/library/collections";
import { getUserTier, TIER_LIMITS } from "@/lib/billing/entitlements";
import { CitationMarkdown } from "@/components/search/citation-markdown";
import { TrustPanel } from "@/components/reader/trust-panel";
import { RatingsEnricher } from "@/components/reader/ratings-enricher";
import { SourceList } from "@/components/search/source-list";
import { BookmarkButton } from "@/components/library/bookmark-button";
import { ShareButton } from "@/components/share/share-button";
import { ExportMenu } from "@/components/reader/export-menu";
import { CollectionMenu } from "@/components/library/collection-menu";
import {
  AudioOverview,
  AudioOverviewLocked,
} from "@/components/reader/audio-overview";
import { AiAnalysis, AiAnalysisTeaser } from "@/components/analysis/ai-analysis";
import { FollowUpChat, FollowUpChatLocked } from "@/components/chat/follow-up-chat";
import { ReadingProgress } from "@/components/reader/reading-progress";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tier = user ? await getUserTier(supabase, user.id) : "free";

  // Follow-up chat is Max-only; load its persisted history for that tier.
  const chatHistory =
    tier === "max" ? await getMessages(supabase, article.searchId) : [];

  // If the article is already shared, open the share button straight to the link.
  const shareUrl = await getActiveShareUrl(supabase, article.summaryId);

  // Collections for the "Collect" control.
  const [collections, memberCollectionIds] = await Promise.all([
    listCollections(supabase),
    getArticleCollectionIds(supabase, article.searchId),
  ]);

  const date = formatDate(article.createdAt);

  return (
    <>
      <div className="no-print">
        <ReadingProgress />
      </div>
      <article className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Link
          href="/app/library"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "no-print -ml-2 text-muted-foreground",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Library
        </Link>

        <header className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="min-w-0 text-balance font-serif text-[1.75rem] font-semibold leading-[1.12] tracking-tight sm:text-4xl">
              {article.title}
            </h1>
            <div className="no-print flex shrink-0 flex-wrap items-center justify-end gap-2 sm:mt-1">
              <ExportMenu
                tier={tier}
                article={{
                  title: article.title,
                  query: article.query,
                  date,
                  bodyMarkdown: article.bodyMarkdown,
                  sources: article.sources,
                }}
              />
              <CollectionMenu
                searchId={article.searchId}
                collections={collections}
                initialMemberIds={memberCollectionIds}
                cap={TIER_LIMITS[tier].collections}
              />
              <ShareButton summaryId={article.summaryId} initialUrl={shareUrl} />
              <BookmarkButton
                summaryId={article.summaryId}
                initial={article.bookmarked}
                withLabel
              />
            </div>
          </div>

          {(date || article.query) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {date && <span>{date}</span>}
              {date && article.query && <span aria-hidden>·</span>}
              {article.query && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  {article.inputType === "url" && (
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{article.query}</span>
                </span>
              )}
            </div>
          )}
        </header>

        <TrustPanel
          sources={article.sources}
          citationCoverage={article.citationCoverage}
        />
        <div className="no-print">
          <RatingsEnricher
            summaryId={article.summaryId}
            hasUnrated={article.sources.some(
              (s) => (s.politicalLean ?? "unknown") === "unknown" && !!s.domain,
            )}
          />
        </div>

        <div className="mt-8">
          <CitationMarkdown markdown={article.bodyMarkdown} markUnsourced />
        </div>

        {article.aiAnalysis ? (
          <AiAnalysis markdown={article.aiAnalysis} />
        ) : tier === "free" ? (
          <AiAnalysisTeaser />
        ) : null}

        <SourceList sources={article.sources} />

        {isHumeConfigured() && (
          <div className="no-print">
            {tier === "max" ? (
              <AudioOverview summaryId={article.summaryId} />
            ) : (
              <AudioOverviewLocked />
            )}
          </div>
        )}

        <div className="no-print">
          {tier === "max" ? (
            <FollowUpChat
              summaryId={article.summaryId}
              initialMessages={chatHistory.map((m) => ({
                role: m.role,
                content: m.content,
              }))}
            />
          ) : (
            <FollowUpChatLocked />
          )}
        </div>

        <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">
          Lumen summarizes sources and can be wrong — open the sources to verify
          any claim. Informational only, not professional (medical, legal, or
          financial) advice.
        </p>
      </article>
    </>
  );
}
