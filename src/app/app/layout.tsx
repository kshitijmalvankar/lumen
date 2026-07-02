import Link from "next/link";
import { Sparkles, Zap, Crown } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";

// Authenticated, personalized area — always render per-request.
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, type Tier } from "@/lib/billing/entitlements";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { AppNav } from "@/components/app-nav";
import { cn } from "@/lib/utils";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  let tier: Tier = "free";
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
    if (user) tier = await getUserTier(supabase, user.id);
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
            <PlanPill tier={tier} />
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

// Free → an "Upgrade" CTA to the plans page. Paid → the tier badge, linking to
// Settings to manage the subscription.
function PlanPill({ tier }: { tier: Tier }) {
  if (tier === "max") {
    return (
      <Link
        href="/app/settings"
        className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/15"
      >
        <Crown className="h-3.5 w-3.5" />
        Max
      </Link>
    );
  }
  const isPro = tier === "pro";
  return (
    <Link
      href={isPro ? "/app/settings" : "/app/upgrade"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        isPro
          ? "border border-brand/30 bg-brand/10 text-brand hover:bg-brand/15"
          : "bg-brand text-brand-foreground hover:bg-brand/90",
      )}
    >
      {isPro ? (
        <>
          <Zap className="h-3.5 w-3.5" />
          Pro
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          Upgrade
        </>
      )}
    </Link>
  );
}
