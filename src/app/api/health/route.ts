import { NextResponse } from "next/server";
import {
  env,
  isSupabaseConfigured,
  isRedisConfigured,
  isStripeConfigured,
  isEmbeddingsConfigured,
} from "@/lib/env";
import { getOpenRouter } from "@/lib/ai/openrouter";
import { MODEL_CATALOG } from "@/lib/ai/model-catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + configuration health, for uptime monitors and post-deploy smoke
 * tests. Only booleans and the (public) site URL are returned — never secrets.
 *
 * `GET /api/health`         → cheap: which services are configured.
 * `GET /api/health?deep=1`  → also validates model-catalog slugs against
 *                             OpenRouter's live model list, and confirms the
 *                             service-role key can actually bypass RLS (a wrong
 *                             key, e.g. the anon key, would otherwise fail
 *                             silently: shares 404, Stripe tier writes drop).
 */
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";

  const services = {
    supabase: isSupabaseConfigured(),
    serviceRole: Boolean(env.supabaseServiceRoleKey),
    openrouter: Boolean(env.openrouterApiKey),
    stripe: isStripeConfigured(),
    redis: isRedisConfigured(),
    siteUrl: env.siteUrl,
  };

  const [models, admin, embeddings] = deep
    ? await Promise.all([checkModelSlugs(), checkAdmin(), checkEmbeddings()])
    : [undefined, undefined, undefined];

  const degraded =
    !services.supabase ||
    !services.openrouter ||
    (models ? !models.ok : false) ||
    (admin ? !admin.ok : false) ||
    (embeddings ? !embeddings.ok : false);

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      time: new Date().toISOString(),
      services,
      ...(models ? { models } : {}),
      ...(admin ? { admin } : {}),
      ...(embeddings ? { embeddings } : {}),
    },
    { status: degraded ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Confirm the service-role key truly has admin privileges. `auth.admin.listUsers`
 * requires the real service_role secret; the anon/publishable key errors here —
 * which is exactly the misconfig that makes public share pages 404 and Stripe
 * entitlement writes silently drop.
 */
async function checkAdmin(): Promise<{ ok: boolean; error?: string }> {
  if (!env.supabaseServiceRoleKey) {
    return { ok: false, error: "no service role key configured" };
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * When Library Intelligence is configured, confirm its migration ran — probing
 * the `summary_embeddings` table via the admin client. A missing table (forgot
 * to run the pgvector migration) surfaces here instead of failing at ask time.
 * Not configured → not degraded.
 */
async function checkEmbeddings(): Promise<{
  ok: boolean;
  configured: boolean;
  error?: string;
}> {
  if (!isEmbeddingsConfigured()) return { ok: true, configured: false };
  if (!env.supabaseServiceRoleKey) {
    return { ok: false, configured: true, error: "no service role key" };
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("summary_embeddings")
      .select("id", { head: true, count: "exact" });
    if (error) return { ok: false, configured: true, error: error.message };
    return { ok: true, configured: true };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/** Verify every catalog slug is a live OpenRouter model id. */
async function checkModelSlugs(): Promise<{
  ok: boolean;
  missing?: string[];
  error?: string;
}> {
  try {
    const client = getOpenRouter();
    const available = new Set<string>();
    for await (const m of client.models.list()) available.add(m.id);

    const missing = Object.values(MODEL_CATALOG)
      .map((m) => m.slug)
      .filter((slug) => !available.has(slug));

    return missing.length > 0 ? { ok: false, missing } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
