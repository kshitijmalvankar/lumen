"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { backfillUncategorized } from "@/lib/library/categorize";
import { getUserTier } from "@/lib/billing/entitlements";
import {
  createCollection,
  addToCollection,
  removeFromCollection,
  CollectionLimitError,
  type Collection,
} from "@/lib/library/collections";

/**
 * Toggle a summary's bookmark for the signed-in user. RLS enforces ownership,
 * so a user can only bookmark their own summaries.
 */
export async function setBookmark(
  summaryId: string,
  bookmarked: boolean,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in.");

  if (bookmarked) {
    const { error } = await supabase
      .from("bookmarks")
      .upsert(
        { user_id: user.id, summary_id: summaryId },
        { onConflict: "user_id,summary_id" },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("summary_id", summaryId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/app/library");
  revalidatePath(`/app/article/${summaryId}`);
}

/**
 * One-time categorization of the user's existing (uncategorized) articles.
 * Called once by the library when it detects uncategorized items. Returns the
 * number processed so the client knows whether to refresh.
 */
export async function backfillCategories(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const n = await backfillUncategorized(supabase, user.id);
  if (n > 0) revalidatePath("/app/library");
  return n;
}

export type CreateCollectionResult =
  | { ok: true; collection: Collection }
  | { ok: false; error: string; limited?: boolean };

/**
 * Create a collection for the signed-in user (reusing an existing same-name one).
 * Returns a result object so the client can show the free-tier cap upsell rather
 * than surfacing a raw thrown error.
 */
export async function createCollectionAction(
  name: string,
): Promise<CreateCollectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const tier = await getUserTier(supabase, user.id);
  try {
    const collection = await createCollection(supabase, user.id, tier, name);
    revalidatePath("/app/library");
    return { ok: true, collection };
  } catch (e) {
    if (e instanceof CollectionLimitError) {
      return { ok: false, error: e.message, limited: true };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't create the collection.",
    };
  }
}

/** Add or remove an article (by searchId) from a collection. */
export async function setArticleCollection(
  searchId: string,
  collectionId: string,
  member: boolean,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in.");

  if (member) {
    await addToCollection(supabase, user.id, searchId, collectionId);
  } else {
    await removeFromCollection(supabase, searchId, collectionId);
  }
  // The reader is force-dynamic and re-reads membership on navigation, so only
  // the library list needs invalidating here.
  revalidatePath("/app/library");
}
