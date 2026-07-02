"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe, priceForTier, type PaidTier } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

async function getUserAndCustomer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/upgrade");

  // Owner can SELECT their own entitlements row (RLS); may not exist yet.
  const { data } = await supabase
    .from("entitlements")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    user,
    customerId: (data?.stripe_customer_id as string | null) ?? null,
  };
}

/** Start a Stripe Checkout session for a paid tier and redirect to it. */
export async function startCheckout(tier: PaidTier) {
  const { user, customerId } = await getUserAndCustomer();
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceForTier(tier), quantity: 1 }],
    client_reference_id: user.id,
    metadata: { user_id: user.id, tier },
    // Carry the user id onto the subscription too, so later subscription.*
    // webhooks can map back without a customer lookup.
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    success_url: `${env.siteUrl}/app/upgrade?status=success`,
    cancel_url: `${env.siteUrl}/app/upgrade?status=cancelled`,
    // Reuse the existing customer if we have one; otherwise prefill the email.
    ...(customerId
      ? { customer: customerId }
      : { customer_email: user.email ?? undefined }),
  });

  if (!session.url) throw new Error("Could not start checkout.");
  redirect(session.url);
}

/** Open the Stripe billing portal so a subscriber can manage/cancel. */
export async function openBillingPortal() {
  const { customerId } = await getUserAndCustomer();
  if (!customerId) redirect("/app/upgrade");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.siteUrl}/app/upgrade`,
  });
  redirect(session.url);
}
