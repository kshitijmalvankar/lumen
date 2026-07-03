import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/url";

/**
 * OAuth / magic-link callback. Supabase redirects here with a `code` that we
 * exchange for a session, then forward the user on to `next` (default /app).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Sanitize `next` to a same-origin relative path — otherwise `?next=@evil.com`
  // resolves to `https://host@evil.com` (an open redirect off our domain).
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
