import type Stripe from "stripe";
import { getStripe, tierForPrice } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Verifies the signature, then writes the user's tier into
 * `entitlements` via the service-role client (the only thing allowed to). This
 * is what makes a paid subscription actually grant Pro/Max — and revoke it on
 * cancellation. Idempotent (upsert), so Stripe retries are safe.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !env.stripeWebhookSecret) {
    return new Response("Stripe webhook not configured", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, env.stripeWebhookSecret);
  } catch {
    // Bad/forged signature.
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id ?? session.metadata?.user_id;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer?.id ?? null);
        if (userId && subId) {
          const sub = await getStripe().subscriptions.retrieve(subId);
          await applySubscription(userId, sub, customerId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userId =
          sub.metadata?.user_id ?? (await userIdForCustomer(customerId));
        if (userId) await applySubscription(userId, sub, customerId);
        break;
      }
    }
  } catch (err) {
    // 500 → Stripe retries later.
    console.error("stripe webhook handler error:", err);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

/** Write the tier + subscription details for a user based on a Subscription. */
async function applySubscription(
  userId: string,
  sub: Stripe.Subscription,
  customerId: string | null,
) {
  const isActive = sub.status === "active" || sub.status === "trialing";
  const item = sub.items.data[0];
  const tier = isActive ? tierForPrice(item?.price?.id) : "free";
  const periodEnd = item?.current_period_end ?? null;

  const admin = createAdminClient();
  const { error } = await admin.from("entitlements").upsert(
    {
      user_id: userId,
      tier,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`entitlements upsert: ${error.message}`);
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("entitlements")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | null) ?? null;
}
