"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Library as LibraryIcon,
  Link2,
  FileText,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { BookmarkButton } from "./bookmark-button";
import type { LibraryItem } from "@/lib/library/queries";

type Filter = "all" | "saved";

export function LibraryView({ items }: { items: LibraryItem[] }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");

  const savedCount = React.useMemo(
    () => items.filter((i) => i.bookmarked).length,
    [items],
  );

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "saved" && !i.bookmarked) return false;
      if (!needle) return true;
      return (
        i.title.toLowerCase().includes(needle) ||
        i.query.toLowerCase().includes(needle)
      );
    });
  }, [items, filter, q]);

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

function LibraryCard({ item, index }: { item: LibraryItem; index: number }) {
  const date = formatDate(item.createdAt);
  const coverage =
    item.citationCoverage != null
      ? Math.round(item.citationCoverage * 100)
      : null;
  const limited = coverage != null && coverage < 50;

  return (
    <li
      className="lift group relative flex animate-in flex-col gap-3 rounded-xl border bg-card p-5 fade-in slide-in-from-bottom-1 fill-mode-both hover:border-brand/40"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <Link
        href={`/app/article/${item.summaryId}`}
        className="absolute inset-0 rounded-xl"
        aria-label={item.title}
      />

      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-2 font-serif text-lg font-medium leading-snug tracking-tight transition-colors group-hover:text-brand">
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
