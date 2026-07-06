import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, isHumeConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/billing/entitlements";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export type AudioAuth =
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; response: Response };

/** Shared gate for the audio routes: configured + signed-in + Max tier. */
export async function authorizeMaxAudio(): Promise<AudioAuth> {
  if (!isSupabaseConfigured() || !isHumeConfigured()) {
    return { ok: false, response: jsonError("Audio isn't available.", 503) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: jsonError("Please sign in.", 401) };

  const tier = await getUserTier(supabase, user.id);
  if (tier !== "max") {
    return {
      ok: false,
      response: jsonError("Audio overviews are available on the Max plan.", 403),
    };
  }
  return { ok: true, supabase, user };
}
