import type { SupabaseClient } from "@supabase/supabase-js";
import { isExtendedCompute } from "@/lib/env";

export type Tier = "free" | "pro" | "max";

export const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
};

// Higher rank = more access. Use TIER_RANK to gate features:
// `TIER_RANK[tier] >= TIER_RANK["pro"]` means pro-or-above.
export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  pro: 1,
  max: 2,
};

// Per-tier limits: hourly search cap + how many web sources a search may gather
// (the ceiling passed to the web plugin's max_results; it returns up to this
// many when the topic has them).
//
// `sources` here is the Hobby-safe baseline: a flat 7, because on a 60s function
// limit deeper sourcing makes Opus/Max searches exceed the limit and get cut
// off. The deeper per-tier depths live in EXTENDED_SOURCES and switch on via
// `searchDepth()` once LUMEN_EXTENDED_COMPUTE is set (Vercel Pro, 300s).
export const TIER_LIMITS: Record<
  Tier,
  { searchesPerHour: number; sources: number; collections: number }
> = {
  // `collections` caps how many library collections a user can create.
  // Free is limited to nudge upgrades; paid tiers are effectively unlimited.
  free: { searchesPerHour: 10, sources: 7, collections: 3 },
  pro: { searchesPerHour: 60, sources: 7, collections: Infinity },
  max: { searchesPerHour: 200, sources: 7, collections: Infinity },
};

// Extended (Vercel Pro / 300s) sourcing depth + combined content budget. Deeper
// per tier so paid tiers differ by more than model, with a larger budget so the
// extra sources still get meaningful context. Tunable knobs.
const EXTENDED_SOURCES: Record<Tier, number> = { free: 8, pro: 14, max: 20 };
const BASELINE_CONTENT_BUDGET = 28000;
const EXTENDED_CONTENT_BUDGET = 52000;

/**
 * How deep a search may go for this tier, and the total source-content budget
 * fed to generation. Falls back to the Hobby-safe flat baseline unless
 * LUMEN_EXTENDED_COMPUTE is on (see isExtendedCompute).
 */
export function searchDepth(tier: Tier): {
  sources: number;
  contentBudget: number;
} {
  if (isExtendedCompute()) {
    return {
      sources: EXTENDED_SOURCES[tier],
      contentBudget: EXTENDED_CONTENT_BUDGET,
    };
  }
  return {
    sources: TIER_LIMITS[tier].sources,
    contentBudget: BASELINE_CONTENT_BUDGET,
  };
}

/** True when `tier` is at least `min` (e.g. tierAtLeast(t, "pro")). */
export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

function isTier(v: unknown): v is Tier {
  return v === "free" || v === "pro" || v === "max";
}

/**
 * The signed-in user's billing tier. Reads the server-authoritative
 * `entitlements` row (owner-readable via RLS); defaults to "free" when the row
 * is missing or unreadable so the app degrades safely.
 */
export async function getUserTier(
  supabase: SupabaseClient,
  userId: string,
): Promise<Tier> {
  const { data, error } = await supabase
    .from("entitlements")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "free";
  return isTier(data.tier) ? data.tier : "free";
}

export interface Entitlement {
  tier: Tier;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/** Full entitlement row for the settings page (tier + subscription details). */
export async function getEntitlement(
  supabase: SupabaseClient,
  userId: string,
): Promise<Entitlement> {
  const { data } = await supabase
    .from("entitlements")
    .select("tier, current_period_end, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    tier: isTier(data?.tier) ? (data!.tier as Tier) : "free",
    currentPeriodEnd: (data?.current_period_end as string | null) ?? null,
    stripeCustomerId: (data?.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (data?.stripe_subscription_id as string | null) ?? null,
  };
}
