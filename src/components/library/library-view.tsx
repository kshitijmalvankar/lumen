"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Library as LibraryIcon,
  Link2,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookmarkButton } from "./bookmark-button";
import type { LibraryItem } from "@/lib/library/queries";

type Filter = "all" | "saved";

function formatDate(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
      <div className="mt-20 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <LibraryIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Your library is empty
        </h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Every article you research is saved here automatically. Run your first
          search to start building your knowledge library.
        </p>
        <Link href="/app" className={cn(buttonVariants(), "mt-6")}>
          <Search className="h-4 w-4" />
          Start a search
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "article" : "articles"}
            {savedCount > 0 && ` · ${savedCount} saved`}
          </p>
        </div>
        <div className="relative sm:w-64">
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
        <p className="mt-12 text-center text-sm text-muted-foreground">
          {filter === "saved"
            ? "No saved articles yet — tap the bookmark on any article to save it."
            : "Nothing matches that filter."}
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {filtered.map((item) => (
            <LibraryCard key={item.summaryId} item={item} />
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
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const date = formatDate(item.createdAt);
  const coverage =
    item.citationCoverage != null
      ? Math.round(item.citationCoverage * 100)
      : null;
  const limited = coverage != null && coverage < 50;

  return (
    <li className="group relative flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40">
      <Link
        href={`/app/article/${item.summaryId}`}
        className="absolute inset-0 rounded-xl"
        aria-label={item.title}
      />

      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-2 font-medium leading-snug">{item.title}</h2>
        <div className="relative z-10 -mr-1 -mt-1">
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

      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {date && <span>{date}</span>}
        <span>·</span>
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
      </div>
    </li>
  );
}
