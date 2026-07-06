"use client";

import * as React from "react";
import { Info } from "lucide-react";

const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;

/**
 * Small "how we rate sources" affordance for the Trust Panel — makes clear that
 * credibility + lean are Lumen's own estimates (not third-party ratings),
 * explains the generic left–right axis + colours, and offers a correction path
 * when a feedback address is configured.
 */
export function RatingsInfo() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="How we rate sources"
        aria-expanded={open}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-6 z-50 w-72 max-w-[86vw] rounded-xl border bg-popover p-3 text-left shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
            <p className="text-sm font-medium">How we rate sources</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Credibility and political lean are{" "}
              <span className="text-foreground">Lumen&apos;s own estimates</span>{" "}
              — from a curated list of outlets plus AI. They reflect an outlet&apos;s
              typical stance, not any single article, and aren&apos;t third-party
              ratings or absolute truth.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Lean is a generic left–right axis:{" "}
              <span className="text-blue-600 dark:text-blue-400">blue = left</span>
              ,{" "}
              <span className="text-red-600 dark:text-red-400">red = right</span>{" "}
              — which can differ from a country&apos;s own colour conventions.
            </p>
            {FEEDBACK_EMAIL && (
              <a
                href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
                  "Lumen source rating correction",
                )}`}
                className="mt-2.5 inline-block text-xs font-medium text-brand hover:underline"
              >
                Suggest a correction
              </a>
            )}
          </div>
        </>
      )}
    </span>
  );
}
