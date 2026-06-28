"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setBookmark } from "@/app/app/library/actions";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  summaryId: string;
  initial: boolean;
  /** Show a text label next to the icon (reader view); icon-only otherwise. */
  withLabel?: boolean;
  className?: string;
}

export function BookmarkButton({
  summaryId,
  initial,
  withLabel = false,
  className,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  function toggle(e: React.MouseEvent) {
    // Cards wrap a navigation overlay — don't follow it when toggling.
    e.preventDefault();
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next); // optimistic
    startTransition(async () => {
      try {
        await setBookmark(summaryId, next);
      } catch {
        setBookmarked(!next); // revert on failure
      }
    });
  }

  const Icon = bookmarked ? BookmarkCheck : Bookmark;

  return (
    <Button
      type="button"
      variant={withLabel ? "outline" : "ghost"}
      size={withLabel ? "sm" : "icon-sm"}
      onClick={toggle}
      disabled={pending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove from saved" : "Save to library"}
      className={cn(
        bookmarked && "text-primary",
        className,
      )}
    >
      <Icon className={cn(bookmarked && "fill-current")} />
      {withLabel && <span>{bookmarked ? "Saved" : "Save"}</span>}
    </Button>
  );
}
