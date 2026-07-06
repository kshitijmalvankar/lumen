@AGENTS.md

# Lumen — project context (read this first)

Lumen is a web app that turns a **topic or pasted link** into a single,
**cited, Medium-style article** built from credible web sources, then saves it
into a personal knowledge library. For casual readers and power users. A **paid
product** (Free/Pro/Max via Stripe). **Web only (Next.js).**

**🟢 LIVE in production: https://lumenlm.vercel.app** (Vercel **Hobby/free**
plan → **60s serverless function limit**, which drives several design choices
below). Full plan: **[PLAN.md](./PLAN.md)**. Setup: **[SETUP.md](./SETUP.md)**.
Overview: **[README.md](./README.md)**. Go-live runbook: **[DEPLOY.md](./DEPLOY.md)**.

## Status — what's built & shipped

- ✅ **Phase 0–2**: auth, DB schema, streaming search → cited article, knowledge
  library (`/app/library`) + reader (`/app/article/[id]`).
- ✅ **Monetization / multi-model**: Free/Pro/Max via server-authoritative
  `entitlements`; tier-gated model picker (Haiku/Sonnet/Opus/GPT-5/Gemini 2.5
  Pro); **AI Analysis** (Pro/Max second pass); per-tier rate limits; Upstash
  cache; Stripe hosted Checkout + webhook + billing portal + `/app/settings`.
- ✅ **Phase 3 — categorization + interests**: each search AI-classified into a
  topic; library topic chips; time-decayed interest profile + personalization
  toggle in settings.
- ✅ **Follow-up chat (Max only)**: chat about an article on the reader page,
  grounded in its sources, persisted to `messages`, streaming. Uses the
  article's own model (`summaries.model_used`, fallback Opus).
- ✅ **Article sharing (all signed-in users)**: public `/s/[slug]` page (base
  article shown, **AI Analysis locked**), create/revoke link, service-role
  public read, **no-index** + `robots.txt`, dynamic OG image.
- ✅ **Personalized suggestions (Pro/Max)**: "Suggested for you" prompts on home
  + library, from interests/recent reads; **one cheap Haiku call per user per
  ~24h**, cached in the `suggestions` table (+ Redis). Free / personalization-off
  → upsell teaser (zero cost).
- ✅ **Pre-launch hardening**: open-redirect fix (`safeNext`), empty-article
  guard, rate-limit resilience, `server-only` guards, Indian credibility
  outlets; **legal pages** (privacy/terms/cookies) + footer; **self-serve
  account deletion** (GDPR); `error.tsx`/`not-found.tsx`; **`/api/health`**;
  **Vitest** suite (`npm run test`).
- ✅ **Bolder-modern redesign** of the in-app reading experience (glass,
  gradients, ambient aurora, reader scroll-progress, mobile-first typography).
- ⏭️ **Still pending**: deep-research mode (true Phase 4), discovery/insights
  dashboard (Phase 5), export. See "Open follow-ups".

## Tech stack (as built — deviations from the original plan)

- **Next.js 16.2.9 (App Router) + React 19 + TypeScript + Tailwind v4.**
- Fonts: **Fraunces** (serif display) + **Inter** (UI) via `next/font`.
- **shadcn/ui on Base UI** (`@base-ui/react`), **not Radix**.
- **Supabase** (Postgres + Auth) via the Supabase client. **No ORM/`DATABASE_URL`.**
  A **service-role admin client** (`src/lib/supabase/admin.ts`, `import
  "server-only"`) is used by: the Stripe webhook, public share reads, account
  deletion, and the `/api/health` deep probe.
- **OpenRouter** (OpenAI-compatible SDK) for all LLMs **and** source discovery
  (built-in `web` plugin). **Stripe** subscriptions. **Upstash Redis** cache +
  rate limits. **Jina Reader** (keyless) for pasted-URL extraction. Deploy: **Vercel**.

## How search works (`POST /api/search`, NDJSON stream)

`src/app/api/search/route.ts`:
1. Auth → `getUserTier` → resolve article model (`resolveModelId`+`modelSlug`,
   clamped to tier allowlist; thinking models get `reasoningEffort:'low'`) →
   `checkRateLimit` → cache check (key includes resolved model id).
2. Sources: keyword → `gatherSearchSources()` (web plugin, cheap
   `categorizeModel()`, `TIER_LIMITS[tier].sources` = **flat 7**); URL →
   `gatherUrlSource()` (Jina). Combined source content is bounded
   (`TOTAL_CONTENT_BUDGET` in pipeline) to keep generation within budget.
3. `streamSummary()` streams the cited Markdown (`delta` events).
4. `parseArticle()` → title/blocks/citations/coverage. **Empty-article guard**:
   if no text blocks → `error` + `markSearchError`, no persist/cache.
5. **Persist FIRST, then analyze** (⚠️ reordered to survive the 60s limit):
   `persistResult()` saves the article + emits `done` immediately; **then** (Pro/
   Max) `generateAnalysis()` runs and, if it finishes, emits `analysis` +
   patches `summaries.ai_analysis` + updates cache. So the article is **always
   saved** even if analysis is slow / the function is cut short.
6. **After `done`:** `categorizeSearch()` files the topic (best-effort).
7. Events: `status`, `sources`, `delta`, `done` (incl. `tier`), `analysis`, `error`.

`maxDuration = 300` (search + chat routes) — **effective only on Vercel Pro;
Hobby clamps to 60s**. Client `SearchView` drives the stream; `CitationMarkdown`
turns `[n]` into links → `SourceList` (`#source-n`). `/app?q=…` deep-link
auto-runs a search (used by library suggestions).

## Follow-up chat, sharing, suggestions

- **Chat** (Max only): `src/app/api/chat/route.ts` (NDJSON), `src/lib/ai/chat.ts`
  (grounded prompt), `src/components/chat/follow-up-chat.tsx` (+ locked teaser).
  History via `getMessages` (`src/lib/library/messages.ts`), persisted to
  `messages`. Own rate limit `checkChatRateLimit`.
- **Share** (all tiers): `src/app/app/article/[id]/share-actions.ts`
  (`createShareLink`/`revokeShareLink`, 128-bit slug), public read
  `src/lib/share/queries.ts` (`getSharedArticle` via admin client;
  `getActiveShareUrl` via RLS), page `src/app/s/[slug]/page.tsx` (+
  `opengraph-image.tsx`), chrome `src/components/share/*`. `/s/` is public in
  middleware; `robots.txt` disallows it + page sets `robots: noindex`.
- **Suggestions** (Pro/Max + personalization on): `src/lib/ai/suggest.ts`
  (`suggestPrompts`+`parseSuggestions`), `src/lib/library/suggestions.ts`
  (`getSuggestions`: Redis → `suggestions` table daily cap → one Haiku call;
  `suggestionsEligible`), `src/app/api/suggestions/route.ts`, component
  `src/components/suggestions/suggested-prompts.tsx`. `suggestions.type`:
  `topic`=fresh, `article`=deepen.

## Monetization / tiers / models

- **Tiers** (`src/lib/billing/entitlements.ts`): `free|pro|max`. `TIER_LIMITS` =
  **10/60/200 searches/hour** and **flat 7 web sources for all tiers**. Source
  depth was flattened (was 8/12/16) because deeper sourcing + Opus exceeds the
  60s Hobby limit — **tiers currently differ by MODEL only**. Raise per-tier once
  on Vercel Pro (comment marks the spot; `maxDuration=300` already set).
- **`entitlements`** is server-authoritative: owner may **SELECT only**; writes
  via the service-role client (Stripe webhook) or SQL — tier can't be
  self-upgraded from the browser.
- **Model catalog** (`src/lib/ai/model-catalog.ts`, client-safe): pickable models
  + per-tier allowlists (`TIER_PICKABLE`, first = default: free→haiku, pro→
  sonnet, max→opus). `isThinkingModel`/`isThinkingSlug` flag GPT-5/Gemini.
- **Rate limits** (`src/lib/cache/redis.ts`): Upstash sliding window when
  configured, else count `searches`/`messages` rows in the trailing hour.
  Upstash errors fall back to the DB count (not a 500); fails open only as a
  last resort, with logging.
- **Stripe** (`src/lib/billing/stripe.ts`, `src/app/app/upgrade/actions.ts`):
  hosted Checkout; webhook (`src/app/api/stripe/webhook/route.ts`) verifies the
  signature and upserts the tier via the admin client. Settings page manages the
  plan (change/cancel/resume/portal) + **account deletion** ("Data & privacy").

## Categorization & interests

`src/lib/ai/categorize.ts` (Haiku pick) + `src/lib/library/categorize.ts`
(reconcile/store into `categories`+`search_categories`, bump `interest_profile`
unless personalization off; `backfillUncategorized` bounded 25/run;
`getInterests` = 30-day half-life; `getPersonalizationEnabled`).

## Key files

```
src/app/page.tsx                     landing (aurora hero + marquee) + SiteFooter
src/app/{privacy,terms,cookies}/     legal template pages (public)
src/app/error.tsx, not-found.tsx     app error + 404 boundaries
src/app/s/[slug]/{page,opengraph-image}.tsx  public shared article + OG image
src/app/app/(layout|page).tsx        authed shell (ambient aurora) + SearchView
src/app/app/library/*                library + setBookmark/backfillCategories
src/app/app/article/[id]/{page,share-actions}.ts  reader + share/revoke actions
src/app/app/{upgrade,settings}/*     plans + settings (+ deleteAccount)
src/app/api/{search,chat,suggestions,health,stripe/webhook}/route.ts
src/proxy.ts                         session refresh + route guard (Next 16)
src/lib/env.ts                       lenient env; isSupabase/Redis/StripeConfigured
src/lib/supabase/{client,server,admin,middleware}.ts   (admin = service role, server-only)
src/lib/billing/{entitlements,stripe}.ts
src/lib/ai/{openrouter,models,model-catalog,prompts,summarize,analysis,
            analysis-normalize,categorize,parse,chat,suggest}.ts
src/lib/search/{pipeline,persist,credibility}.ts
src/lib/library/{queries,categorize,messages,suggestions}.ts
src/lib/share/queries.ts             getSharedArticle (admin) + getActiveShareUrl
src/lib/{url,format,utils}.ts        safeNext/isSafeHttpUrl; formatDate; cn
src/lib/cache/redis.ts               cache + tier-aware rate limits (+ chat)
src/components/search/*, analysis/ai-analysis.tsx, chat/follow-up-chat.tsx,
  share/*, suggestions/suggested-prompts.tsx, reader/reading-progress.tsx,
  legal/legal-page.tsx, settings/delete-account-button.tsx, site-footer.tsx
src/**/*.test.ts                     Vitest (parseArticle, resolveModelId,
  scoreCredibility, safeNext, normalizeAnalysis, parseSuggestions) — 6 files
supabase/schema.sql                  ALL tables + RLS + triggers (hand-run in SQL editor)
```

## Data model

**17 tables** in `supabase/schema.sql` (idempotent) + `entitlements`. Enum
`plan_tier`. **RLS on every table = `user_id = auth.uid()`** (profiles uses `id`;
**entitlements is SELECT-only** for the owner). Signup trigger creates `profiles`
+ a free `entitlements` row. **Now in use**: `messages` (chat), `shares`
(sharing), `suggestions` (suggestions), plus the Phase-3 `categories`/
`search_categories`/`interest_profile`. **Still unused**: `tags`, `search_tags`,
`usage_quota`.

## Env vars (`.env.local` gitignored; prod = Vercel env)

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`OPENROUTER_API_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`**, `NEXT_PUBLIC_SITE_URL`.
Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`,
`STRIPE_PRICE_MAX`. Recommended: `UPSTASH_REDIS_REST_URL`/`_TOKEN`. Optional:
`OPENROUTER_MODEL_CATEGORIZE`, `JINA_API_KEY`, `OPENROUTER_BASE_URL`. Article
models live in `model-catalog.ts` (NOT env).

## Conventions & gotchas (learned the hard way)

- **⚠️ 60s Vercel Hobby limit** shapes the pipeline: **persist BEFORE analysis**
  (analysis is best-effort after `done`), **flat 7 sources**, bounded context.
  Don't reintroduce heavy per-tier sourcing until on Vercel Pro.
- **⚠️ `SUPABASE_SERVICE_ROLE_KEY` must be the real `service_role` secret** (not
  the `anon`/`sb_publishable_…` key). A wrong value fails **silently**: the admin
  client doesn't bypass RLS → public share pages **404** and Stripe entitlement
  writes **drop**. Diagnose with **`GET /api/health?deep=1`** → `admin.ok`
  (also validates model-catalog slugs). This actually happened in prod.
- **Redesign design system** (`src/app/globals.css`): `.glass`, `.text-gradient`,
  `.glow-brand`, `.gradient-ring`, `.read-progress`; ambient aurora in the app
  layout; reader constrained to `max-w-2xl`; mobile-first `.article` type. All
  respect `prefers-reduced-motion`. Reuse `.lift`/`.focus-glow`/aurora utilities.
- **Base UI, not Radix.** `render` prop, not `asChild`.
- **Middleware is `src/proxy.ts`** (Next 16). Public paths: `/`, auth, `/api`,
  `/s/`, `/privacy`, `/terms`, `/cookies`.
- **Thinking models** need `max_tokens` headroom + `reasoning_effort:'low'`.
- **Cache keyed by resolved model id.** **Regex:** no `s` flag. **Dates:**
  `formatDate` (UTC). **Flex/grid overflow:** `min-w-0` on shrinkable children.
- **Restart `npm run dev`** after `.env.local`/route/module changes. Node 24.

## Environment / deploy status

- **Deployed to prod** (lumenlm.vercel.app, Vercel **Hobby/free**, 60s cap).
  GitHub `origin/main` = deployed. Stripe **LIVE mode** configured (products/
  prices, webhook endpoint + signing secret). The service-role-key misconfig was
  found and fixed (see gotcha).
- Local `.env.local` (this machine) has Supabase + OpenRouter + Upstash + Stripe
  **TEST** keys; prod Vercel has **LIVE** keys. Email confirm OFF; test account
  `lumentest9123@gmail.com` (tier toggled via SQL).
- **I (the agent) cannot** log in (passwords) or enter card details, so login-
  gated flows are the user's to verify. The **timeout only manifests on Vercel**,
  never on `next dev`. Verify: `npm run test`, `tsc --noEmit`, `lint`, `build`;
  and `curl <prod>/api/health?deep=1`.

## Working agreements

- Verify each change (`npm run test` + `tsc --noEmit` + `lint`; `build` before a
  prod push — but `next build` clobbers `.next`, disrupting a running dev server,
  so prefer tsc+lint when the user is testing on localhost). Don't add scope
  without asking. **Commit only when asked; push only when asked.** Don't fight
  the user for port 3000.
- I don't handle secrets/tokens/cards — the user sets those in Vercel/dashboards.
- **Open follow-ups**: move to **Vercel Pro** → then raise per-tier `sources` +
  `maxDuration=300` takes effect (or make **Sonnet the Max default** for speed on
  Hobby); adopt **Supabase CLI migrations** (schema still hand-run = prod-500
  risk); wire **Sentry** (needs DSN); webhook **dead-letter/audit** table; true
  **deep-research** (Phase 4) + discovery feed (Phase 5). Done this session:
  Vitest suite, Indian credibility outlets, chat, sharing, suggestions, redesign.
```
