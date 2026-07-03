import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/**
 * The persisted follow-up conversation for a search, oldest first. RLS scopes
 * rows to the caller, so no explicit user filter is needed.
 */
export async function getMessages(
  supabase: SupabaseClient,
  searchId: string,
): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("search_id", searchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getMessages: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    createdAt: r.created_at as string,
  }));
}
