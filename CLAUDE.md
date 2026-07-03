@AGENTS.md

# Lumen — project context (read this first)

Lumen is a web app that turns a **topic or pasted link** into a single,
**cited, Medium-style article** built from credible web sources, then saves it
into a personal knowledge library. For casual readers and power users. Now also
a **paid product** (Free/Pro/Max tiers via Stripe). **Web only (Next.js).**

Full product/technical plan: **[PLAN.md](./PLAN.md)**. Setup/run/test:
**[SETUP.md](./SETUP.md)**. Overview: **[README.md](./README.md)**. Production
go-live runbook: **[DEPLOY.md](./DEPLOY.md)**.

## Status

- ✅ **Phase 0 — Foundation**: scaffold, theming, auth, DB schema, service wrappers.
- ✅ **Phase 1 — Core search → cited article**: streams a Medium-style article
  with inline citations + a credibility-scored source list; persists to Supabase.
- ✅ **Phase 2 — Knowledge library**: `/app/library` (auto-saved summaries,
  text filter, All/Saved tabs, bookmark toggle) + `/app/article/[id]` reader.
- ✅ **Monetization & multi-model layer** (built + verified in-browser; committed
  locally, **not yet pushed/deployed**):
  - **Free/Pro/Max tiers** with a server-authoritative `entitlements` table.
  - **Tier-gated model picker**: pick the article model (Claude Haiku/Sonnet/
    Opus, GPT-5, Gemini 2.5 Pro); choice re-validated server-side.
  - **AI Analysis** (Pro/Max): a second LLM pass adds Lumen's own commentary.
  - **Per-tier rate limits** (Upstash sliding window, or a Postgres fallback).
  - **Upstash Redis** result cache (repeat queries are free/instant).
  - **Stripe** hosted Checkout + webhook + billing portal; **`/app/settings`**
    page to upgrade/downgrade/cancel/resume.
  - **Per-tier source depth**: a search gathers up to 8 (free) / 12 (pro) /
    16 (max) web sources (`TIER_LIMITS[tier].sources`) — was a flat 6.
- ✅ **Phase 3 — auto-categorization + interest profile** (built + verified via
  build/lint; **not yet verified in-browser** — needs the user's logged-in app):
  - Each finished search is AI-classified into a topic (curated starter set that
    grows, reconciled against the user's existing categories) — runs inline
    after `done`, all tiers. `categories` + `search_categories` now used.
  - **Library topic filter chips** (with counts + per-card badges); a one-time
    **backfill** categorizes existing articles on first library visit.
  - **Interest profile**: time-decayed (30-day half-life) topic weights; a
    "Your interests" view + **reset** + **personalization on/off** toggle in
    `/app/settings`. `interest_profile` + `profiles.personalization_enabled` used.
- ⏭️ **NEXT: Phase 4** (deep-research mode + conversational follow-ups; URL-paste
  already works), then Phase 5 (discovery feed + insights dashboard — will
  consume the interest profile), Phase 6 (share + export).

## Tech stack (as actually built — deviations from the original plan)

- **Next.js 16.2.9 (App Router) + React 19 + TypeScript + Tailwind v4.**
- Fonts: **Fraunces** (serif display) + **Inter** (UI/body) via `next/font`.
- **shadcn/ui built on Base UI** (`@base-ui/react`), **not Radix**.
- **Supabase** (Postgres + Auth) via the **Supabase client** (`supabase.from`).
  **No Drizzle/ORM/`DATABASE_URL`.** A **service-role admin client**
  (`src/lib/supabase/admin.ts`) is used only by the Stripe webhook.
- **OpenRouter** (OpenAI-compatible SDK) for all LLMs **and** source discovery
  (its built-in `web` plugin). No Google CSE.
- **Stripe** for subscriptions (hosted Checkout, no card data in our app).
- **Upstash Redis** for cache + rate limits (now configured).
- **Jina Reader** (keyless) for pasted-URL extraction only.
- Deploy target: **Vercel**.

## How search works (`POST /api/search`, NDJSON stream)

`src/app/api/search/route.ts`:
1. Auth → **`getUserTier`** → **resolve the article model** (`resolveModelId` +
   `modelSlug`, clamped to the tier's allowlist; thinking models get
   `reasoningEffort:'low'`) → **tier-scaled rate limit** (`checkRateLimit`) →
   **cache check** (key includes the resolved model id).
2. Sources: keyword → `gatherSearchSources()` (OpenRouter `web` plugin, cheap
   `categorizeModel()`, up to `TIER_LIMITS[tier].sources`); pasted URL →
   `gatherUrlSource()` (Jina).
3. `streamSummary()` writes the cited Markdown article (tokens stream as `delta`).
4. `parseArticle()` → title + blocks + per-block citations + coverage.
5. **If tier ≠ free:** `generateAnalysis()` runs a second pass with the same
   model → emits an `analysis` event → persisted as `summaries.ai_analysis`.
6. `persistResult()` (incl. `ai_analysis`, `model_used`) → `cacheSet`.
7. **After `done`:** `categorizeSearch()` files the search under a topic
   (best-effort, all tiers) — doesn't delay the result.
8. Events: `status`, `sources`, `delta`, `analysis`, `done` (incl. `tier`), `error`.

Client `SearchView` drives the stream; `CitationMarkdown` turns `[n]` into
superscript links → `SourceList` (`#source-n`).

## Monetization / tiers / models

- **Tiers** (`src/lib/billing/entitlements.ts`): `free | pro | max`.
  `getUserTier` / `getEntitlement`; `TIER_LIMITS` = 10/60/200 searches per hour
  and 8/12/16 web sources per search.
- **`entitlements` table** is **server-authoritative**: RLS lets the owner
  **SELECT only** (no write policy) → tier can't be self-upgraded from the
  browser. Writes happen via the **service-role** client (Stripe webhook) or SQL.
- **Model catalog** (`src/lib/ai/model-catalog.ts`, client-safe, no env): the
  pickable models + per-tier allowlists (`TIER_PICKABLE`, first = default:
  free→haiku, pro→sonnet, max→opus). Slugs are OpenRouter ids — edit here to
  change. `isThinkingModel` flags GPT-5/Gemini (need reasoning cap + token room).
- **Rate limits** (`src/lib/cache/redis.ts`): tier-scaled; uses Upstash sliding
  window when configured, else counts the user's `searches` rows in the trailing
  hour (RLS-scoped, no extra infra). Fails open on error.
- **Stripe** (`src/lib/billing/stripe.ts` + `src/app/app/upgrade/actions.ts`):
  hosted Checkout (mode `subscription`), `client_reference_id = user.id`. The
  **webhook** (`src/app/api/stripe/webhook/route.ts`) verifies the signature and
  upserts the tier into `entitlements` via the admin client on
  `checkout.session.completed` / `customer.subscription.updated|deleted`.
- **Settings** (`/app/settings`): shows plan + renewal/cancel date; in-app
  upgrade/downgrade (`changePlan`, prorated), cancel-at-period-end / resume, and
  a link to the Stripe billing portal for payment method/invoices.

## Categorization & interests (Phase 3)

- **Categorize** (`src/lib/ai/categorize.ts` = the Haiku pick; `src/lib/library/
  categorize.ts` = reconcile/store): classifies a search into ONE topic from a
  curated starter set (`STARTER_CATEGORIES`) or the user's existing categories,
  inventing a new one only when nothing fits. Stores `categories` +
  `search_categories`, then bumps `interest_profile` (skipped if personalization
  off). `backfillUncategorized()` catches existing articles (bounded to 25/run).
- **Library** (`LibraryView`): topic filter chips (counts) + per-card badge;
  auto-runs `backfillCategories` once when it sees uncategorized items.
- **Interests**: `getInterests()` scores topics with a 30-day half-life;
  surfaced in `/app/settings` with reset + a personalization toggle
  (`setPersonalization`, writes `profiles.personalization_enabled` via RLS).

## Key files

```
src/app/page.tsx                  landing (aurora hero + "all models" marquee)
src/app/login|signup/page.tsx     email+password auth (AuthForm)
src/app/app/(layout|page).tsx     authed shell (nav + plan pill) + SearchView(tier)
src/app/app/library/*             library list + setBookmark/backfillCategories
src/app/app/article/[id]/page.tsx reader (rebuilds article; shows AI Analysis/teaser)
src/app/app/upgrade/{page,actions}.ts  3-tier plans + startCheckout/openBillingPortal
src/app/app/settings/{page,actions}.ts settings + changePlan/cancel/resume
src/app/api/search/route.ts       streaming search endpoint (tier+model+analysis)
src/app/api/stripe/webhook/route.ts  Stripe webhook → writes entitlements
src/proxy.ts                      session refresh + route guard (Next 16 "proxy")
src/lib/env.ts                    lenient env; isSupabase/Redis/StripeConfigured
src/lib/supabase/{client,server,admin,middleware}.ts   (admin = service role)
src/lib/billing/{entitlements,stripe}.ts
src/lib/ai/{openrouter,models,model-catalog,prompts,summarize,analysis,categorize,parse}.ts
src/lib/search/{pipeline,persist,credibility}.ts
src/lib/library/queries.ts        listLibrary (+ category) + getArticle
src/lib/library/categorize.ts     categorizeSearch/backfill + getInterests/personalization
src/lib/cache/redis.ts            cache + tier-aware rate limit
src/components/search/{search-view,model-picker,citation-markdown,source-list,coverage-note}.tsx
src/components/analysis/ai-analysis.tsx   AI Analysis section + locked teaser
src/components/{library,auth}/*, src/components/app-nav.tsx, src/components/ui/*
supabase/schema.sql               ALL tables + RLS + triggers (run in SQL editor)
```

## Data model

**17 tables** in `supabase/schema.sql` (idempotent): the original 16 (`profiles`,
`searches`, `summaries` [+ `ai_analysis` column], `summary_blocks`, `sources`,
`block_citations`, `messages`, `categories`, `search_categories`, `tags`,
`search_tags`, `bookmarks`, `shares`, `interest_profile`, `suggestions`,
`usage_quota`) **plus `entitlements`** (`user_id` PK, `tier plan_tier`,
`current_period_end`, `stripe_customer_id`, `stripe_subscription_id`). Enum
`plan_tier ('free','pro','max')`. **RLS on every table = `user_id = auth.uid()`**
(profiles uses `id`; **entitlements is SELECT-only** for the owner). Signup
trigger creates a `profiles` **and** a free `entitlements` row. Phase 3 now uses
`categories`, `search_categories`, `interest_profile`, and
`profiles.personalization_enabled` (previously unused). Still unused: `tags`,
`search_tags`, `shares`, `suggestions`, `usage_quota`, `messages`.

## Env vars (`.env.local`, gitignored — see `.env.example` + `DEPLOY.md`)

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`OPENROUTER_API_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (now required — Stripe
webhook), `NEXT_PUBLIC_SITE_URL`. Stripe: `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX`. Recommended:
`UPSTASH_REDIS_REST_URL`/`_TOKEN`. Optional: `OPENROUTER_MODEL_CATEGORIZE`,
`JINA_API_KEY`, `OPENROUTER_BASE_URL`.

Article models are chosen in `model-catalog.ts` (NOT env); only the categorize
model is env-overridable. The old per-tier `OPENROUTER_MODEL_*` vars were removed.

## Conventions & gotchas (learned the hard way)

- **Base UI, not Radix.** `render` prop, not `asChild`. Button-styled link =
  `buttonVariants()` + `<Link className={cn(...)}>`.
- **Middleware is `src/proxy.ts`** (Next 16 rename). It **exempts `/api`** from
  the login redirect so the Stripe webhook (no session) is reachable.
- **Thinking models (GPT-5, Gemini 2.5 Pro)** spend the token budget on hidden
  reasoning → empty articles unless given headroom (`max_tokens` 8000/4000) **and**
  `reasoning_effort:'low'` (the SDK-native param; OpenRouter's `reasoning` object
  gets stripped by the SDK). Even so they take ~50s — near the 60s function limit.
- **Cache is keyed by resolved model id** (`sum:quick:<modelId>:<query>`) so a
  free user never gets a paid-model result and vice-versa.
- **Stripe:** hosted Checkout only (never handle card data in-app). Webhook must
  verify the signature; entitlements written via the service-role admin client.
  Test-mode data doesn't carry to live.
- **Regex:** no `s` (dotAll) flag. **Dates:** use `src/lib/format.ts`
  `formatDate` (UTC, deterministic) — `toLocaleDateString` caused hydration
  mismatches. **Flex/grid overflow:** add `min-w-0` to shrinkable children.
- **Restart `npm run dev`** after `.env.local` or route/module changes.
- App builds before keys are set (`requireEnv` throws at use site; the upgrade
  page shows "Coming soon" until Stripe keys exist). `npm run build` + `lint`
  pass. Node 24, npm 11. Preview MCP: `.claude/launch.json` server `lumen`:3000.

## Environment config status (this machine)

- `.env.local` has Supabase (URL+anon+**service role**), OpenRouter, **Upstash
  (REST url+token)**, and **Stripe TEST keys** (secret, webhook secret from
  `stripe listen`, price ids for Pro/Max).
- `supabase/schema.sql` has been run (incl. `entitlements` + `ai_analysis`).
  Email confirm is **OFF** (autoconfirm). Test account `lumentest9123@gmail.com`
  exists; its tier is toggled via SQL during testing.
- **Verified working locally:** search (all models incl. GPT-5/Gemini), AI
  Analysis, Upstash cache + rate limits, Stripe test checkout → webhook → tier
  flip, and the settings page. **Phase 3 (categorization/interests) + deeper
  per-tier sourcing pass build/lint but were NOT browser-verified** (I couldn't
  log in). **Not yet pushed to GitHub / deployed to prod.**
- Local dev is run by the **user** on port 3000 (with `stripe listen` forwarding
  to `/api/stripe/webhook`). Don't fight them for the port; ask before taking
  over the preview. I **cannot** log in (passwords) or enter card details.

## Working agreements

- Build in phases; verify each (`npm run build` + lint + Preview MCP). Don't add
  scope without asking. **Commit only when asked; push only when asked.**
- I don't handle secrets/tokens/cards — the user pastes those into `.env.local`
  or provider dashboards themselves.
- Open follow-ups: adopt **Supabase CLI migrations** (schema is still hand-run —
  the cause of prod-500 risk); add a small **Vitest** suite (`parseArticle`,
  credibility, `resolveModelId`, analysis `NONE`-normalizer); expand
  `src/lib/search/credibility.ts` with Indian outlets (ET, Mint, Business
  Standard, Hindu BusinessLine — currently "Unverified").
