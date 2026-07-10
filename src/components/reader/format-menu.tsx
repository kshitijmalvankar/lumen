"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Type, Check, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SEARCH_FORMATS } from "@/lib/ai/formats";
import { cn } from "@/lib/utils";

/**
 * Re-generate a saved article under a different output lens (Pro/Max). Posts to
 * the reformat route, then refreshes the reader to show the new body. A format
 * you've used before comes back instantly (server-side per-format cache).
 */
export function FormatMenu({
  summaryId,
  current,
}: {
  summaryId: string;
  current: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const currentDef =
    SEARCH_FORMATS.find((f) => f.id === current) ?? SEARCH_FORMATS[0];

  async function change(formatId: string) {
    if (busy || formatId === current) return;
    setBusy(true);
    const label = SEARCH_FORMATS.find((f) => f.id === formatId)?.label ?? "";
    const t = toast.loading(`Reformatting to ${label}…`);
    try {
      const res = await fetch("/api/article/reformat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryId, format: formatId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't reformat.", { id: t });
        return;
      }
      toast.success("Article reformatted", { id: t });
      router.refresh();
    } catch {
      toast.error("Couldn't reformat — please try again.", { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change article format"
        disabled={busy}
        className={cn(buttonVariants({ variant: "outline", size: "default" }))}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Type className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{currentDef.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Rewrite in this format</DropdownMenuLabel>
        {SEARCH_FORMATS.map((f) => (
          <DropdownMenuItem
            key={f.id}
            onClick={() => change(f.id)}
            disabled={busy}
          >
            <span className="flex flex-1 flex-col">
              <span>{f.label}</span>
              <span className="text-[0.7rem] text-muted-foreground">
                {f.hint}
              </span>
            </span>
            {f.id === current && <Check className="h-4 w-4 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
