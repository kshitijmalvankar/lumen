import Link from "next/link";
import { Check, Sparkles, Zap, Crown, ArrowLeft } from "lucide-react";
import { isSupabaseConfigured, isStripeConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, type Tier } from "@/lib/billing/entitlements";
import { type PaidTier } from "@/lib/billing/stripe";
import { startCheckout, openBillingPortal } from "./actions";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// NOTE: placeholder prices — keep these in sync with your real Stripe Prices.
const PLANS: Array<{
  tier: Tier;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  icon: typeof Sparkles;
  features: string[];
  highlighted?: boolean;
}> = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Get a feel for cited research.",
    icon: Sparkles,
    features: [
      "Cited, credibility-scored articles",
      "Fast everyday model",
      "Your personal knowledge library",
      "10 searches / hour",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$8",
    cadence: "/ month",
    tagline: "Sharper answers, with Lumen's own analysis.",
    icon: Zap,
    highlighted: true,
    features: [
      "Everything in Free",
      "Choose your model — Claude Sonnet, GPT-5 or Gemini",
      "AI Analysis — Lumen's commentary & insights",
      "Conversational follow-ups & deep research (soon)",
      "60 searches / hour",
    ],
  },
  {
    tier: "max",
    name: "Max",
    price: "$20",
    cadence: "/ month",
    tagline: "The most advanced models and capabilities.",
    icon: Crown,
    features: [
      "Everything in Pro",
      "Every model, including Claude Opus",
      "Topic tracking & ask-your-library (soon)",
      "Highest priority + 200 searches / hour",
    ],
  },
];

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const stripeReady = isStripeConfigured();
  let currentTier: Tier = "free";
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) currentTier = await getUserTier(supabase, user.id);
  }

  return (
    <div className="animate-in fade-in duration-500">
      {status === "success" && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand/10 p-3 text-center text-sm text-brand">
          Payment received — your plan will update in a moment. Refresh if it
          hasn&apos;t yet.
        </div>
      )}
      {status === "cancelled" && (
        <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-center text-sm text-muted-foreground">
          Checkout cancelled — no charge was made.
        </div>
      )}
      <Link
        href="/app"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 text-muted-foreground",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-4 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          Choose your plan
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Lumen isn&apos;t locked to one model — higher plans unlock the most
          advanced models and capabilities.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Invite-only during beta — pricing is indicative.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          return (
            <div
              key={plan.tier}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6",
                plan.highlighted && "border-brand/50 ring-1 ring-brand/30",
              )}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-2.5 left-6 bg-brand text-brand-foreground">
                  Most popular
                </Badge>
              )}

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    plan.highlighted
                      ? "bg-brand text-brand-foreground"
                      : "bg-brand/10 text-brand",
                  )}
                >
                  <plan.icon className="h-4 w-4" />
                </span>
                <h2 className="font-serif text-xl font-semibold tracking-tight">
                  {plan.name}
                </h2>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.cadence}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.tagline}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <PlanCta
                  tier={plan.tier}
                  name={plan.name}
                  highlighted={plan.highlighted}
                  currentTier={currentTier}
                  stripeReady={stripeReady}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CtaText({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-center rounded-lg border bg-muted/40 text-sm font-medium text-muted-foreground">
      {children}
    </div>
  );
}

function PlanCta({
  tier,
  name,
  highlighted,
  currentTier,
  stripeReady,
}: {
  tier: Tier;
  name: string;
  highlighted?: boolean;
  currentTier: Tier;
  stripeReady: boolean;
}) {
  const isCurrent = tier === currentTier;
  const hasPaidSub = currentTier !== "free";

  // Free plan: nothing to buy.
  if (tier === "free") {
    return isCurrent ? (
      <CtaText>Current plan</CtaText>
    ) : (
      <div className="flex h-9 items-center justify-center text-sm text-muted-foreground">
        Included
      </div>
    );
  }

  // Stripe not configured yet (no keys) → don't offer a broken button.
  if (!stripeReady) {
    return (
      <button
        disabled
        className={cn(
          buttonVariants({ variant: highlighted ? "default" : "outline" }),
          "w-full cursor-not-allowed opacity-70",
        )}
      >
        Coming soon
      </button>
    );
  }

  // Any paid subscriber (on this plan or switching) manages via the portal.
  if (isCurrent || hasPaidSub) {
    return (
      <form action={openBillingPortal}>
        <SubmitButton variant="outline" className="w-full">
          {isCurrent ? "Manage plan" : `Switch to ${name}`}
        </SubmitButton>
      </form>
    );
  }

  // Free user upgrading to a paid plan → Stripe Checkout.
  return (
    <form action={startCheckout.bind(null, tier as PaidTier)}>
      <SubmitButton
        variant={highlighted ? "default" : "outline"}
        className="w-full"
      >
        Upgrade to {name}
      </SubmitButton>
    </form>
  );
}
