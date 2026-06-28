import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, requireEnv } from "@/lib/env";

/** Supabase client for Server Components, Route Handlers, and Server Actions. */
export async function createClient() {
  requireEnv("supabaseUrl", "supabaseAnonKey");
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component (read-only cookies). The session is
          // refreshed in middleware, so this is safe to ignore.
        }
      },
    },
  });
}
