import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";
import { CitationMarkdown } from "@/components/search/citation-markdown";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lumen's own commentary on an article (Pro/Max). Distinct, clearly-labeled. */
export function AiAnalysis({ markdown }: { markdown: string }) {
  return (
    <section className="ai-analysis gradient-ring mt-10 overflow-hidden rounded-2xl border border-brand/20 bg-brand/[0.05] p-5 backdrop-blur-md sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/15 text-brand shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          AI Analysis
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Lumen&apos;s interpretation — going beyond the cited facts.
      </p>
      <div className="mt-3">
        <CitationMarkdown markdown={markdown} />
      </div>
    </section>
  );
}

/** Locked upsell shown to free users where the analysis would appear. */
export function AiAnalysisTeaser() {
  return (
    <section className="mt-10 rounded-2xl border border-dashed bg-muted/30 p-6 text-center">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Lock className="h-4 w-4" />
      </span>
      <h2 className="mt-3 font-serif text-lg font-semibold tracking-tight">
        AI Analysis
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Get Lumen&apos;s own commentary on every article — implications, caveats,
        and what to watch next — with Pro.
      </p>
      <Link
        href="/app/upgrade"
        className={cn(buttonVariants({ size: "sm" }), "mt-4")}
      >
        <Sparkles className="h-4 w-4" />
        Unlock with Pro
      </Link>
    </section>
  );
}
