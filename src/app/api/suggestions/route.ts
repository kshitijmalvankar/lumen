import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/billing/entitlements";
import { getPersonalizationEnabled } from "@/lib/library/categorize";
import { getSuggestions, suggestionsEligible } from "@/lib/library/suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Personalized next-read prompts for the signed-in user. Gated to Pro/Max with
 * personalization on; everyone else gets `eligible: false` (the client shows a
 * teaser instead — no generation happens for them).
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ eligible: false, reason: "config" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ eligible: false, reason: "auth" }, { status: 401 });
  }

  const tier = await getUserTier(supabase, user.id);
  const personalization = await getPersonalizationEnabled(supabase, user.id);
  if (!suggestionsEligible(tier, personalization)) {
    return NextResponse.json({
      eligible: false,
      reason: tier === "free" ? "tier" : "personalization",
    });
  }

  const suggestions = await getSuggestions(supabase, user.id);
  return NextResponse.json(
    { eligible: true, suggestions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
