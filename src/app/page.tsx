import Link from "next/link";
import { Compass, FileText, Library, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Lumen</span>
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
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Research, distilled
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Turn any topic into a clear, cited article.
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Lumen searches credible sources, reads them for you, and writes one
            trustworthy summary — with links to verify every claim.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/app"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Open the app
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-6 text-card-foreground"
            >
              <f.icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-muted-foreground">
        Lumen — informational summaries, not professional advice.
      </footer>
    </div>
  );
}
