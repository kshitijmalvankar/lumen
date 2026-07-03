import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, requireEnv } from "@/lib/env";

let _admin: SupabaseClient | undefined;

/**
 * Service-role Supabase client — BYPASSES RLS. Use only in trusted server
 * contexts with no user session (e.g. the Stripe webhook writing entitlements).
 * Never import this into client code or expose its results unfiltered.
 */
export function createAdminClient(): SupabaseClient {
  requireEnv("supabaseUrl", "supabaseServiceRoleKey");
  if (!_admin) {
    _admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
