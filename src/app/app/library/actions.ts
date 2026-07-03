"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { backfillUncategorized } from "@/lib/library/categorize";

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
