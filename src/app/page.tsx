import Link from "next/link";
import {
  Compass,
  FileText,
  Library,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";

// The models Lumen actually serves (see src/lib/ai/model-catalog.ts). Keep this
// list in sync with what users can really pick — no models we don't offer.
const MODELS = [
  "Claude Opus",
  "Claude Sonnet",
  "Claude Haiku",
  "GPT-5",
  "Gemini 2.5 Pro",
];

const features = [
  {
    icon: Sparkles,
    title: "One clear article",
    body: "Search a topic or paste a link and get a single, readable article — not ten blue links.",
  },
  {
    icon: FileText,
    title: "Cited & verifiable",
    body: "Every claim links back to credible news, blogs, and research so you can check the source.",
  },
  {
    icon: Library,
    title: "Your knowledge library",
    body: "Everything you read is saved and auto-organized by topic, ready to revisit.",
  },
  {
    icon: Compass,
    title: "Learns your interests",
    body: "Lumen surfaces fresh, relevant reads and shows you a dashboard of what you explore.",
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      {/* Page-level aurora */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px]">
        <div className="aurora-blob animate-float-slow left-[12%] top-10 h-72 w-72 bg-brand/40" />
        <div className="aurora-blob animate-float-slower right-[10%] top-24 h-80 w-80 bg-violet-400/35" />
        <div className="aurora-blob animate-float-slow left-1/2 top-0 h-64 w-64 -translate-x-1/2 bg-sky-300/25" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            Lumen
          </span>
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        <section className="flex flex-col items-center py-20 text-center sm:py-28">
          <span className="mb-5 inline-flex animate-in items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur fade-in slide-in-from-bottom-2 duration-500">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Research, distilled
          </span>
          <h1 className="max-w-3xl animate-in text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight fade-in slide-in-from-bottom-3 duration-700 sm:text-7xl">
            Turn any topic into a{" "}
            <span className="text-brand">clear, cited</span> article.
          </h1>
          <p className="mt-6 max-w-xl animate-in text-balance text-lg text-muted-foreground fade-in slide-in-from-bottom-3 duration-700 [animation-delay:120ms]">
            Lumen searches credible sources, reads them for you, and writes one
            trustworthy summary — with links to verify every claim.
          </p>
          <div className="mt-8 flex animate-in flex-wrap items-center justify-center gap-3 fade-in slide-in-from-bottom-3 duration-700 [animation-delay:220ms]">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }), "group")}
            >
              Get started — it&apos;s free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Open the app
            </Link>
          </div>
        </section>

        <section className="pb-20">
          <p className="text-center text-sm text-muted-foreground">
            Not locked to one model — Lumen taps the best across providers.{" "}
            <span className="text-foreground">
              Your plan unlocks the most advanced.
            </span>
          </p>
          <div className="marquee-mask relative mt-6 overflow-hidden">
            <div className="flex w-max animate-marquee gap-3">
              {/* 4 copies: the -50% loop shows 2 copies, wide enough to fill. */}
              {[...MODELS, ...MODELS, ...MODELS, ...MODELS].map((m, i) => (
                <span
                  key={i}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-card/60 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {m}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="lift group animate-in rounded-2xl border bg-card p-6 text-card-foreground fade-in fill-mode-both hover:border-brand/40"
              style={{ animationDelay: `${300 + i * 90}ms` }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15 transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-serif text-lg font-medium tracking-tight">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
