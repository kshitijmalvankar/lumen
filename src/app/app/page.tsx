import { SearchView } from "@/components/search/search-view";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, type Tier } from "@/lib/billing/entitlements";
import { getPersonalizationEnabled } from "@/lib/library/categorize";

export const dynamic = "force-dynamic";

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let tier: Tier = "free";
  let personalization = true;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      tier = await getUserTier(supabase, user.id);
      personalization = await getPersonalizationEnabled(supabase, user.id);
    }
  }

  return (
    <div className="pt-6">
      <SearchView
        tier={tier}
        personalizationEnabled={personalization}
        initialQuery={q ?? null}
      />
    </div>
  );
}
