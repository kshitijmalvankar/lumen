import { SearchView } from "@/components/search/search-view";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, type Tier } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  let tier: Tier = "free";
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) tier = await getUserTier(supabase, user.id);
  }

  return (
    <div className="pt-6">
      <SearchView tier={tier} />
    </div>
  );
}
