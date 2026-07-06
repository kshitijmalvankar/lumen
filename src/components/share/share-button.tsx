"use client";

import * as React from "react";
import { Share2, Copy, Check, Loader2, ExternalLink, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createShareLink, revokeShareLink } from "@/app/app/article/[id]/share-actions";
import { cn } from "@/lib/utils";

export function ShareButton({
  summaryId,
  initialUrl = null,
  className,
}: {
  summaryId: string;
  /** Existing active share URL, if the article is already shared. */
  initialUrl?: string | null;
  className?: string;
}) {
  const [url, setUrl] = React.useState<string | null>(initialUrl);
  const [pending, setPending] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Close the popover on Escape.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  async function onShare() {
    if (open) {
      setOpen(false);
      return;
    }
    if (url) {
      setOpen(true);
      copy(url);
      return;
    }
    setPending(true);
    try {
      const { url: link } = await createShareLink(summaryId);
      setUrl(link);
      setOpen(true);
      copy(link);
    } catch {
      toast.error("Couldn't create a share link. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function onRevoke() {
    setRevoking(true);
    try {
      await revokeShareLink(summaryId);
      setUrl(null);
      setOpen(false);
      toast.success("Sharing stopped — the public link no longer works.");
    } catch {
      toast.error("Couldn't stop sharing. Please try again.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={onShare}
        disabled={pending}
        aria-label="Share this article"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Share</span>
      </Button>

      {open && url && (
        <>
          {/* click-away backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[92vw] rounded-xl border bg-popover p-4 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
            <p className="text-sm font-medium">Public link</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Anyone with this link can read the article — no account needed.
            </p>
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1 pl-2.5">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate bg-transparent text-xs text-muted-foreground outline-none"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => copy(url)}
                aria-label="Copy link"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Preview
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={onRevoke}
                disabled={revoking}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              >
                {revoking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Link2Off className="h-3 w-3" />
                )}
                Stop sharing
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
