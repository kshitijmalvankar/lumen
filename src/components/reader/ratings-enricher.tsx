"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Fires the "stacked" `/api/ratings/classify` request (its own fresh serverless
 * budget) when an article has sources we haven't rated yet, then refreshes so the
 * server re-renders the enriched chips + balance meter. Once per article/session.
 * Mirrors the library's optimistic backfill-then-refresh pattern.
 */
export function RatingsEnricher({
  summaryId,
  hasUnrated,
}: {
  summaryId: string;
  hasUnrated: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (!hasUnrated || firedRef.current) return;
    firedRef.current = true;

    const key = `lumen:rated:${summaryId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable — proceed anyway (firedRef still guards re-mounts).
    }

    (async () => {
      setPending(true);
      try {
        const res = await fetch("/api/ratings/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summaryId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.updated > 0) router.refresh();
      } catch {
        // best-effort; ratings just stay as their current estimate
      } finally {
        setPending(false);
      }
    })();
  }, [summaryId, hasUnrated, router]);

  if (!pending) return null;
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Assessing source leanings…
    </p>
  );
}
