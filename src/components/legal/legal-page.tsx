import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for the legal pages. Content is passed as children and rendered
 * with the `.article` prose styles used elsewhere for readable long-form text.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 text-muted-foreground",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>

        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Template for launch — have this reviewed by legal counsel and replace
          the placeholder contact details before going live.
        </div>

        <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>

        <div className="article mt-8">{children}</div>
      </div>
      <SiteFooter />
    </div>
  );
}
