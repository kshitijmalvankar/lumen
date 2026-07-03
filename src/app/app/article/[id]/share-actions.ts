"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/**
 * Unguessable, URL-safe slug (~128 bits of entropy). Public share pages are
 * gated only by possession of this slug, so it must not be brute-forceable; the
 * unique index is a collision backstop.
 */
function newSlug(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Create (or reuse) a public share link for one of the caller's own articles.
 * RLS scopes the ownership check and the insert to the signed-in user, so a user
 * can only share summaries they own. Returns the full public URL.
 */
export async function createShareLink(summaryId: string): Promise<{ url: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in.");

  // Ownership check (RLS returns null for a summary the caller doesn't own).
  const { data: summary } = await supabase
    .from("summaries")
    .select("id")
    .eq("id", summaryId)
    .maybeSingle();
  if (!summary) throw new Error("Article not found.");

  // Reuse an existing active share so the link is stable across shares.
  const { data: existing } = await supabase
    .from("shares")
    .select("public_slug")
    .eq("summary_id", summaryId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  let slug = existing?.[0]?.public_slug as string | undefined;
  if (!slug) {
    slug = newSlug();
    const { error } = await supabase.from("shares").insert({
      summary_id: summaryId,
      user_id: user.id,
      public_slug: slug,
    });
    if (error) throw new Error(error.message);
  }

  return { url: `${env.siteUrl}/s/${slug}` };
}

/**
 * Revoke the caller's active share link(s) for an article — the public page then
 * 404s. RLS scopes the update to the owner. Idempotent (no-op if none active).
 */
export async function revokeShareLink(summaryId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in.");

  const { error } = await supabase
    .from("shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("summary_id", summaryId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}
