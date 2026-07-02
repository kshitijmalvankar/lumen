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

  // Jina Reader (optional)
  jinaApiKey: process.env.JINA_API_KEY ?? "",

  // Upstash Redis
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",

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
