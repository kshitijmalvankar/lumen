import Link from "next/link";

/** Footer for public surfaces (landing, shared article pages) with legal links. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>© {year} Lumen — informational summaries, not professional advice.</span>
      <nav className="flex items-center gap-4">
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          Terms
        </Link>
        <Link href="/cookies" className="transition-colors hover:text-foreground">
          Cookies
        </Link>
      </nav>
    </footer>
  );
}
