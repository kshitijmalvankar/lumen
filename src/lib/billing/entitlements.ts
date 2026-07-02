import type { SupabaseClient } from "@supabase/supabase-js";

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

// Per-tier hourly search cap (enforced once Upstash rate limiting is enabled).
export const TIER_LIMITS: Record<Tier, { searchesPerHour: number }> = {
  free: { searchesPerHour: 10 },
  pro: { searchesPerHour: 60 },
  max: { searchesPerHour: 200 },
};

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
