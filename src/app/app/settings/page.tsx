import Link from "next/link";
import { ArrowLeft, Crown, Zap, Sparkles, ExternalLink } from "lucide-react";
import { isSupabaseConfigured, isStripeConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  getEntitlement,
  TIER_LABEL,
  type Tier,
} from "@/lib/billing/entitlements";
import { getStripe } from "@/lib/billing/stripe";
import {
  getInterests,
  getPersonalizationEnabled,
  type Interest,
} from "@/lib/library/categorize";
import { openBillingPortal } from "../upgrade/actions";
import {
  changePlan,
  cancelSubscription,
  resumeSubscription,
  setPersonalization,
  resetInterests,
} from "./actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIER_ICON: Record<Tier, typeof Sparkles> = {
  free: Sparkles,
  pro: Zap,
  max: Crown,
};

const STATUS_MESSAGE: Record<string, string> = {
  "plan-changed": "Your plan is being updated — it'll reflect in a moment.",
  cancelling: "Your subscription will end at the close of the billing period.",
  resumed: "Your subscription has been resumed.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let email: string | null = null;
  let tier: Tier = "free";
  let periodEnd: string | null = null;
  let hasSubscription = false;
  let cancelAtPeriodEnd = false;
  let interests: Interest[] = [];
  let personalizationOn = true;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      email = user.email ?? null;
      const ent = await getEntitlement(supabase, user.id);
      tier = ent.tier;
      periodEnd = ent.currentPeriodEnd;
      hasSubscription = Boolean(ent.stripeSubscriptionId);
      personalizationOn = await getPersonalizationEnabled(supabase, user.id);
      interests = personalizationOn ? await getInterests(supabase, user.id) : [];
      if (ent.stripeSubscriptionId && isStripeConfigured()) {
        try {
          const sub = await getStripe().subscriptions.retrieve(
            ent.stripeSubscriptionId,
          );
          cancelAtPeriodEnd = sub.cancel_at_period_end;
        } catch {
          // Non-fatal — just don't show cancel status.
        }
      }
    }
  }

  const maxInterest = interests[0]?.score ?? 1;

  const TierIcon = TIER_ICON[tier];
  const isPaid = tier !== "free";
  const otherTier: "pro" | "max" = tier === "pro" ? "max" : "pro";

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in duration-500">
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

      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Settings
      </h1>

      {status && STATUS_MESSAGE[status] && (
        <div className="mt-4 rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm text-brand">
          {STATUS_MESSAGE[status]}
        </div>
      )}

      {/* Account */}
      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold tracking-tight">
          Account
        </h2>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium">{email ?? "—"}</span>
        </div>
      </section>

      {/* Plan & subscription */}
      <section className="mt-4 rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold tracking-tight">
            Plan
          </h2>
          <Badge className="gap-1 bg-brand/10 text-brand">
            <TierIcon className="h-3.5 w-3.5" />
            {TIER_LABEL[tier]}
          </Badge>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {!isPaid && "You're on the free plan."}
          {isPaid &&
            periodEnd &&
            (cancelAtPeriodEnd
              ? `Access ends on ${formatDate(periodEnd)}.`
              : `Renews on ${formatDate(periodEnd)}.`)}
          {isPaid && !periodEnd && "Active."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {!isPaid && (
            <Link
              href="/app/upgrade"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Sparkles className="h-4 w-4" />
              View plans &amp; upgrade
            </Link>
          )}

          {isPaid && hasSubscription && (
            <>
              {/* Switch to the other paid tier (up or down). */}
              <form action={changePlan.bind(null, otherTier)}>
                <SubmitButton variant="outline" className="w-full sm:w-auto">
                  {otherTier === "max" ? "Upgrade to Max" : "Downgrade to Pro"}
                </SubmitButton>
              </form>

              {/* Cancel / resume. */}
              {cancelAtPeriodEnd ? (
                <form action={resumeSubscription}>
                  <SubmitButton className="w-full sm:w-auto">
                    Resume subscription
                  </SubmitButton>
                </form>
              ) : (
                <form action={cancelSubscription}>
                  <SubmitButton
                    variant="destructive"
                    className="w-full sm:w-auto"
                  >
                    Cancel subscription
                  </SubmitButton>
                </form>
              )}

              {/* Payment method / invoices via Stripe's portal. */}
              <form action={openBillingPortal}>
                <SubmitButton variant="ghost" className="w-full sm:w-auto">
                  <ExternalLink className="h-4 w-4" />
                  Billing &amp; invoices
                </SubmitButton>
              </form>
            </>
          )}

          {isPaid && !hasSubscription && (
            <Link
              href="/app/upgrade"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Manage on the plans page
            </Link>
          )}
        </div>

        {isPaid && hasSubscription && (
          <p className="mt-4 text-xs text-muted-foreground">
            Plan changes are prorated. Cancelling keeps your access until the
            end of the current billing period.
          </p>
        )}
      </section>

      {/* Personalization */}
      <section className="mt-4 rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-tight">
              Your interests
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lumen learns the topics you read to organize your library and,
              later, suggest reads. Kept private to you.
            </p>
          </div>
          <form action={setPersonalization.bind(null, !personalizationOn)}>
            <SubmitButton variant="outline" className="shrink-0">
              {personalizationOn ? "Turn off" : "Turn on"}
            </SubmitButton>
          </form>
        </div>

        {!personalizationOn ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Personalization is off — Lumen isn&apos;t tracking your interests.
          </p>
        ) : interests.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No interests yet — they build up as you read more articles.
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-2.5">
              {interests.map((it) => (
                <li key={it.topic} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm font-medium">
                    {it.topic}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.max(6, (it.score / maxInterest) * 100)}%`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <form action={resetInterests} className="mt-5">
              <SubmitButton variant="ghost" className="text-muted-foreground">
                Reset interests
              </SubmitButton>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
