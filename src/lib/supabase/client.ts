import { createBrowserClient } from "@supabase/ssr";
import { env, requireEnv } from "@/lib/env";

/** Supabase client for use in Client Components (browser). */
export function createClient() {
  requireEnv("supabaseUrl", "supabaseAnonKey");
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
