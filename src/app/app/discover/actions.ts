"use server";

import { createClient } from "@/lib/supabase/server";
import {
  addWatch,
  removeWatch,
  listWatches,
  type TopicWatch,
} from "@/lib/library/watches";

/** Start watching a topic; returns the refreshed list for optimistic UIs. */
export async function addWatchAction(query: string): Promise<TopicWatch[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  await addWatch(supabase, user.id, query);
  return listWatches(supabase);
}

/** Stop watching a topic; returns the refreshed list. */
export async function removeWatchAction(id: string): Promise<TopicWatch[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  await removeWatch(supabase, id);
  return listWatches(supabase);
}
