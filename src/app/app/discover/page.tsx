import Link from "next/link";
import { isSupabaseConfigured, isEmailConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier, type Tier } from "@/lib/billing/entitlements";
import { getPersonalizationEnabled } from "@/lib/library/categorize";
import { listWatches } from "@/lib/library/watches";
import { DiscoverView } from "@/components/discover/discover-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mt-20 text-center text-muted-foreground">
        <p>The app isn&apos;t fully configured yet.</p>
        <Link href="/app" className={cn(buttonVariants({ variant: "link" }))}>
          Back to search
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let tier: Tier = "free";
  let personalization = true;
  if (user) {
    tier = await getUserTier(supabase, user.id);
    personalization = await getPersonalizationEnabled(supabase, user.id);
  }
  const watches = await listWatches(supabase);

  return (
    <DiscoverView
      initialWatches={watches}
      tier={tier}
      personalizationEnabled={personalization}
      emailConfigured={isEmailConfigured()}
    />
  );
}
