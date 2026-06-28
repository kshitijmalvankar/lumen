import Link from "next/link";
import { Sparkles } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";

// Authenticated, personalized area — always render per-request.
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-5">
            <Link href="/app" className="group flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-brand-foreground shadow-sm transition-transform group-hover:scale-105">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="font-serif text-xl font-semibold tracking-tight">
                Lumen
              </span>
            </Link>
            <AppNav />
          </div>
          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden text-sm text-muted-foreground md:inline">
                {email}
              </span>
            )}
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
