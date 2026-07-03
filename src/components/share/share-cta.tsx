import Link from "next/link";
import { Sparkles, Lock, ArrowRight, FileText, MessagesSquare } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Top bar for the public shared page: Lumen wordmark + auth CTAs. */
export function ShareNav() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-serif text-lg font-semibold tracking-tight">
          Lumen
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Sign up free
        </Link>
      </div>
    </header>
  );
}

/** Locked AI-Analysis slot on the public page — the paid hook. */
export function LockedAnalysis() {
  return (
    <section className="mt-10 rounded-2xl border border-brand/25 bg-brand/[0.05] p-6 text-center">
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Lock className="h-4 w-4" />
      </span>
      <h2 className="mt-3 font-serif text-lg font-semibold tracking-tight">
        AI Analysis is locked
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        This article includes Lumen&apos;s own analysis — implications, caveats,
        and what to watch next. Sign up and go Pro to read it.
      </p>
      <Link
        href="/signup"
        className={cn(buttonVariants({ size: "sm" }), "mt-4")}
      >
        <Sparkles className="h-4 w-4" />
        Unlock with Pro
      </Link>
    </section>
  );
}

/** Bottom conversion banner encouraging signup to a paid plan. */
export function SignupCta() {
  return (
    <section className="mt-12 overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/10 via-card to-violet-500/10 p-8 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
        <Sparkles className="h-3.5 w-3.5 text-brand" /> Made with Lumen
      </span>
      <h2 className="mx-auto mt-4 max-w-lg text-balance font-serif text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Turn any topic into a clear, cited article
      </h2>
      <p className="mx-auto mt-3 max-w-md text-balance text-sm text-muted-foreground">
        Lumen reads credible sources and writes one trustworthy article — then
        saves it to your personal library. Go Pro or Max for AI analysis, deeper
        sourcing, and follow-up chat.
      </p>

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
        <div className="flex items-center gap-1.5 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5 text-brand" /> AI Analysis on every read
        </div>
        <div className="flex items-center gap-1.5 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
          <MessagesSquare className="h-3.5 w-3.5 text-brand" /> Follow-up chat
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
          Start free <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/signup"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          See Pro &amp; Max
        </Link>
      </div>
    </section>
  );
}
