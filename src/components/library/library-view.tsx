"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Library as LibraryIcon,
  Link2,
  FileText,
  ShieldAlert,
  ArrowUpRight,
  Loader2,
  Folder,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { BookmarkButton } from "./bookmark-button";
import { SuggestedPrompts } from "@/components/suggestions/suggested-prompts";
import { backfillCategories } from "@/app/app/library/actions";
import type { LibraryItem } from "@/lib/library/queries";
import type { CollectionWithCount } from "@/lib/library/collections";
import type { Tier } from "@/lib/billing/entitlements";

type Filter = "all" | "saved";

export function LibraryView({
  items,
  tier,
  personalizationEnabled,
  collections,
  membership,
}: {
  items: LibraryItem[];
  tier: Tier;
  personalizationEnabled: boolean;
  collections: CollectionWithCount[];
  /** searchId → collection ids, for the collection filter. */
  membership: Record<string, string[]>;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [collectionId, setCollectionId] = React.useState<string | null>(null);
  const [organizing, setOrganizing] = React.useState(false);

  const savedCount = React.useMemo(
    () => items.filter((i) => i.bookmarked).length,
    [items],
  );

  // Topic chips: each category with its count, most-used first.
  const categories = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) {
      if (i.category) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  // One-time backfill: categorize any existing articles that have no topic yet.
  const backfilledRef = React.useRef(false);
  React.useEffect(() => {
    if (backfilledRef.current || !items.some((i) => !i.category)) return;
    backfilledRef.current = true;
    setOrganizing(true);
    backfillCategories()
      .then((n) => {
        if (n > 0) router.refresh();
      })
      .finally(() => setOrganizing(false));
  }, [items, router]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "saved" && !i.bookmarked) return false;
      if (category && i.category !== category) return false;
      if (
        collectionId &&
        !(membership[i.searchId] ?? []).includes(collectionId)
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        i.title.toLowerCase().includes(needle) ||
        i.query.toLowerCase().includes(needle)
      );
    });
  }, [items, filter, q, category, collectionId, membership]);

  if (items.length === 0) {
    return (
      <div className="mt-20 flex animate-in flex-col items-center text-center fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 ring-1 ring-brand/20">
          <LibraryIcon className="h-6 w-6 text-brand" />
        </div>
        <h1 className="mt-5 font-serif text-2xl font-semibold tracking-tight">
          Your library is empty
        </h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Every article you research is saved here automatically. Run your first
          search to start building your knowledge library.
        </p>
        <Link href="/app" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          <Search className="h-4 w-4" />
          Start a search
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "article" : "articles"}
            {savedCount > 0 && (
              <>
                {" · "}
                <span className="text-brand">{savedCount} saved</span>
              </>
            )}
          </p>
        </div>
        <div className="focus-glow relative rounded-lg sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter your library…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterPill>
        <FilterPill
          active={filter === "saved"}
          onClick={() => setFilter("saved")}
        >
          Saved{savedCount > 0 ? ` (${savedCount})` : ""}
        </FilterPill>
      </div>

      {(categories.length > 0 || organizing) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {categories.length > 0 && (
            <CategoryChip active={category === null} onClick={() => setCategory(null)}>
              All topics
            </CategoryChip>
          )}
          {categories.map(([name, count]) => (
            <CategoryChip
              key={name}
              active={category === name}
              onClick={() => setCategory(name)}
            >
              {name} <span className="opacity-50">{count}</span>
            </CategoryChip>
          ))}
          {organizing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Organizing by topic…
            </span>
          )}
        </div>
      )}

      {collections.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Folder className="h-3.5 w-3.5" />
            Collections
          </span>
          <CategoryChip
            active={collectionId === null}
            onClick={() => setCollectionId(null)}
          >
            All
          </CategoryChip>
          {collections.map((c) => (
            <CategoryChip
              key={c.id}
              active={collectionId === c.id}
              onClick={() =>
                setCollectionId((cur) => (cur === c.id ? null : c.id))
              }
            >
              {c.name} <span className="opacity-50">{c.count}</span>
            </CategoryChip>
          ))}
        </div>
      )}

      <SuggestedPrompts
        tier={tier}
        personalizationEnabled={personalizationEnabled}
        onPick={(query) => router.push(`/app?q=${encodeURIComponent(query)}`)}
        className="mt-6 border-t pt-6"
      />

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          {filter === "saved"
            ? "No saved articles yet — tap the bookmark on any article to save it."
            : "Nothing matches that filter."}
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {filtered.map((item, i) => (
            <LibraryCard key={item.summaryId} item={item} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand/40 bg-brand/10 text-brand"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LibraryCard({ item, index }: { item: LibraryItem; index: number }) {
  const date = formatDate(item.createdAt);
  const coverage =
    item.citationCoverage != null
      ? Math.round(item.citationCoverage * 100)
      : null;
  const limited = coverage != null && coverage < 50;

  return (
    <li
      className="lift group relative flex min-w-0 animate-in flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-5 backdrop-blur-md fade-in slide-in-from-bottom-1 fill-mode-both hover:border-brand/40"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <Link
        href={`/app/article/${item.summaryId}`}
        className="absolute inset-0 rounded-xl"
        aria-label={item.title}
      />

      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-2 min-w-0 font-serif text-lg font-medium leading-snug tracking-tight transition-colors group-hover:text-brand">
          {item.title}
        </h2>
        <div className="relative z-10 -mr-1.5 -mt-1.5 flex items-center">
          <BookmarkButton
            summaryId={item.summaryId}
            initial={item.bookmarked}
          />
        </div>
      </div>

      {item.query && (
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {item.inputType === "url" ? (
            <Link2 className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
          ) : null}
          {item.query}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        {item.category && (
          <Badge
            variant="outline"
            className="h-5 border-brand/30 px-1.5 text-[0.65rem] font-medium text-brand"
          >
            {item.category}
          </Badge>
        )}
        {date && <span>{date}</span>}
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {item.sourceCount} {item.sourceCount === 1 ? "source" : "sources"}
        </span>
        {limited && (
          <Badge
            variant="outline"
            className="h-5 gap-1 border-amber-600/30 px-1.5 text-[0.65rem] text-amber-700 dark:text-amber-400"
          >
            <ShieldAlert className="h-3 w-3" />
            {coverage}% cited
          </Badge>
        )}
        <ArrowUpRight className="ml-auto h-4 w-4 translate-y-0.5 text-muted-foreground/0 transition-all group-hover:translate-y-0 group-hover:text-brand" />
      </div>
    </li>
  );
}
