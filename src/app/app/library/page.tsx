import Link from "next/link";
import { isSupabaseConfigured, isEmbeddingsConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { listLibrary } from "@/lib/library/queries";
import {
  listCollections,
  getCollectionMembership,
} from "@/lib/library/collections";
import { getUserTier, type Tier } from "@/lib/billing/entitlements";
import { getPersonalizationEnabled } from "@/lib/library/categorize";
import { LibraryView } from "@/components/library/library-view";
import { AskPanel } from "@/components/library/ask-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
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
  const [items, collections, membership] = await Promise.all([
    listLibrary(supabase),
    listCollections(supabase),
    getCollectionMembership(supabase),
  ]);

  return (
    <div className="space-y-6">
      {isEmbeddingsConfigured() && items.length > 0 && <AskPanel tier={tier} />}
      <LibraryView
        items={items}
        tier={tier}
        personalizationEnabled={personalization}
        collections={collections}
        membership={membership}
        initialCategory={topic ?? null}
      />
    </div>
  );
}
