import Stripe from "stripe";
import { env, requireEnv } from "@/lib/env";
import type { Tier } from "./entitlements";

/** Tiers that have a paid Stripe price. */
export type PaidTier = "pro" | "max";

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  requireEnv("stripeSecretKey");
  if (!_stripe) _stripe = new Stripe(env.stripeSecretKey);
  return _stripe;
}

/** The recurring monthly Price id for a paid tier. */
export function priceForTier(tier: PaidTier): string {
  return tier === "max" ? env.stripePriceMax : env.stripePricePro;
}

/** Reverse map: which tier a Stripe Price id grants (defaults to free). */
export function tierForPrice(priceId: string | null | undefined): Tier {
  if (priceId && priceId === env.stripePriceMax) return "max";
  if (priceId && priceId === env.stripePricePro) return "pro";
  return "free";
}
