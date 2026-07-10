"use client";

import * as React from "react";
import { Eye, Check, Loader2 } from "lucide-react";
import { addWatchAction } from "@/app/app/discover/actions";
import { cn } from "@/lib/utils";

/** One-tap "start watching this topic" — used on search results. */
export function WatchButton({
  query,
  className,
}: {
  query: string;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "busy" | "done">("idle");

  async function track() {
    if (state !== "idle") return;
    setState("busy");
    try {
      await addWatchAction(query);
      setState("done");
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={track}
      disabled={state !== "idle"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-default",
        state === "done"
          ? "border-brand/40 bg-brand/10 text-brand"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {state === "busy" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "done" ? (
        <Check className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
      {state === "done" ? "Tracking" : "Track topic"}
    </button>
  );
}
