/**
 * Centralized environment access.
 *
 * Reading is lenient so the app and `next build` work before every key is set.
 * Use `requireEnv` (or the `requireX` helpers) at the point a feature actually
 * needs a value, so failures are clear and local instead of crashing at import.
 */

export const env = {
  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  // OpenRouter
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterBaseUrl:
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  // Background source-discovery / tagging model. The article model is chosen
  // per tier/pick in src/lib/ai/model-catalog.ts.
  openrouterModelCategorize: process.env.OPENROUTER_MODEL_CATEGORIZE ?? "",

  // Jina Reader (optional) + Jina embeddings (Library Intelligence). The Reader
  // works keyless; embeddings require JINA_API_KEY.
  jinaApiKey: process.env.JINA_API_KEY ?? "",
  jinaEmbedModel: process.env.JINA_EMBED_MODEL ?? "jina-embeddings-v3",
  jinaEmbedDimensions: Number(process.env.JINA_EMBED_DIMENSIONS ?? "1024"),

  // Hume Octave TTS (optional) — enables generated Audio Overviews.
  humeApiKey: process.env.HUME_API_KEY ?? "",
  humeVoiceDescription: process.env.HUME_VOICE_DESCRIPTION ?? "",

  // Upstash Redis
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",

  // Resend (optional) — powers the weekly discovery digest email.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? "Lumen <onboarding@resend.dev>",
  // Shared secret the Vercel Cron request must present to run the digest.
  cronSecret: process.env.CRON_SECRET ?? "",

  // Stripe (server-only). Price ids map a tier to its monthly subscription.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePricePro: process.env.STRIPE_PRICE_PRO ?? "",
  stripePriceMax: process.env.STRIPE_PRICE_MAX ?? "",

  // App
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

type EnvKey = keyof typeof env;

export function requireEnv(...keys: EnvKey[]): void {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(
        ", ",
      )}. Add them to .env.local (see .env.example).`,
    );
  }
}

export const isSupabaseConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const isRedisConfigured = () =>
  Boolean(env.upstashRedisUrl && env.upstashRedisToken);

export const isStripeConfigured = () =>
  Boolean(env.stripeSecretKey && env.stripePricePro && env.stripePriceMax);

export const isHumeConfigured = () => Boolean(env.humeApiKey);

// Library Intelligence (semantic search) needs an embeddings key. Reuses the
// Jina key; the feature hides itself when this is unset.
export const isEmbeddingsConfigured = () => Boolean(env.jinaApiKey);

// Vercel Pro raises the serverless function ceiling to 300s (Hobby = 60s). This
// flag unlocks the "extended compute" path — deeper per-tier sourcing, a bigger
// content budget, and inline library indexing. OFF by default so the code is
// safe to deploy on Hobby; set LUMEN_EXTENDED_COMPUTE=1 once Pro is live.
export const isExtendedCompute = () =>
  process.env.LUMEN_EXTENDED_COMPUTE === "1";

// Weekly digest email needs Resend configured; the feature (and its cron)
// no-op when this is unset.
export const isEmailConfigured = () => Boolean(env.resendApiKey);
