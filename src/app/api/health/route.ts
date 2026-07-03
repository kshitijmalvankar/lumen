import { NextResponse } from "next/server";
import {
  env,
  isSupabaseConfigured,
  isRedisConfigured,
  isStripeConfigured,
} from "@/lib/env";
import { getOpenRouter } from "@/lib/ai/openrouter";
import { MODEL_CATALOG } from "@/lib/ai/model-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + configuration health, for uptime monitors and post-deploy smoke
 * tests. Only booleans and the (public) site URL are returned — never secrets.
 *
 * `GET /api/health`         → cheap: which services are configured.
 * `GET /api/health?deep=1`  → also validates each model-catalog slug against
 *                             OpenRouter's live model list (a bad slug would make
 *                             that model's searches fail with a vague error).
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

  const models = deep ? await checkModelSlugs() : undefined;

  const degraded =
    !services.supabase || !services.openrouter || (models ? !models.ok : false);

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      time: new Date().toISOString(),
      services,
      ...(models ? { models } : {}),
    },
    { status: degraded ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
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
