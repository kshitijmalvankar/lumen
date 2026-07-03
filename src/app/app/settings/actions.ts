"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isStripeConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/billing/entitlements";
import { getStripe, priceForTier, type PaidTier } from "@/lib/billing/stripe";

async function currentSubscriptionId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");
  const ent = await getEntitlement(supabase, user.id);
  return ent.stripeSubscriptionId;
}

/**
 * Switch the user's existing subscription to another paid tier (up or down),
 * with proration. A user without a live subscription is sent to checkout.
 * The `customer.subscription.updated` webhook then syncs the new tier.
 */
export async function changePlan(newTier: PaidTier) {
  const subId = await currentSubscriptionId();
  if (!subId) redirect("/app/upgrade");

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) redirect("/app/settings");

  await stripe.subscriptions.update(subId, {
    items: [{ id: itemId, price: priceForTier(newTier) }],
    proration_behavior: "create_prorations",
  });
  redirect("/app/settings?status=plan-changed");
}

/** Cancel at period end — the user keeps access until their paid period runs out. */
export async function cancelSubscription() {
  const subId = await currentSubscriptionId();
  if (!subId) redirect("/app/settings");
  await getStripe().subscriptions.update(subId, { cancel_at_period_end: true });
  redirect("/app/settings?status=cancelling");
}

/** Undo a pending cancellation. */
export async function resumeSubscription() {
  const subId = await currentSubscriptionId();
  if (!subId) redirect("/app/settings");
  await getStripe().subscriptions.update(subId, { cancel_at_period_end: false });
  redirect("/app/settings?status=resumed");
}

/* --------------------------- personalization ----------------------------- */

/** Turn interest tracking on/off (writes the user's own profile row via RLS). */
export async function setPersonalization(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");
  await supabase
    .from("profiles")
    .update({ personalization_enabled: enabled })
    .eq("id", user.id);
  revalidatePath("/app/settings");
}

/** Forget all learned interests. */
export async function resetInterests() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");
  await supabase.from("interest_profile").delete().eq("user_id", user.id);
  revalidatePath("/app/settings");
}

/* ------------------------------ account ---------------------------------- */

/**
 * Permanently delete the caller's account and all their data (GDPR erasure).
 * Cancels any live subscription first (best-effort) so a deleted account isn't
 * billed, then removes the auth user via the service-role client — every
 * per-user table cascades on `auth.users` delete. Signs out and returns home.
 */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  // Stop billing immediately (best-effort — never block deletion on Stripe).
  try {
    const ent = await getEntitlement(supabase, userId);
    if (ent.stripeSubscriptionId && isStripeConfigured()) {
      await getStripe().subscriptions.cancel(ent.stripeSubscriptionId);
    }
  } catch (err) {
    console.error("deleteAccount: subscription cancel failed:", err);
  }

  // Erase the auth user; ON DELETE CASCADE removes profiles, searches,
  // summaries, sources, shares, messages, entitlements, etc.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`account deletion failed: ${error.message}`);

  // Clear the now-orphaned session cookie; never let this block the redirect.
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("deleteAccount: signOut after deletion failed:", err);
  }
  redirect("/");
}
