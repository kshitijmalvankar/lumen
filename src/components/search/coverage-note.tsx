import { ShieldCheck, ShieldAlert } from "lucide-react";

/** Inline badge summarizing how much of the article is backed by citations. */
export function CoverageNote({ coverage }: { coverage: number }) {
  const pct = Math.round(coverage * 100);
  const limited = coverage < 0.5;
  return (
    <div
      className={`mt-6 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
        limited
          ? "border-amber-600/30 text-amber-700 dark:text-amber-400"
          : "text-muted-foreground"
      }`}
    >
      {limited ? (
        <ShieldAlert className="h-3.5 w-3.5" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" />
      )}
      {limited
        ? `Limited sourcing — ${pct}% of claims cited. Verify carefully.`
        : `${pct}% of claims cited`}
    </div>
  );
}
