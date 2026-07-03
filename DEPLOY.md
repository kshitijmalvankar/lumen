# Lumen — Production Go-Live Runbook

Ordered so nothing 500s and you deploy the minimum number of times.
**Golden rule: migrate the database and set env vars before (or with) the code
deploy.** DB changes are additive, so the old version keeps working while you
prep.

Assumes the Vercel project already exists (connected to the GitHub repo from an
earlier deploy). If not, do **Step 4a** first.

---

## Step 1 — Supabase (database)

Additive + idempotent; safe to run while the old version is still live.

1. Supabase → **SQL Editor** → paste the entire [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Adds the `plan_tier` enum, `entitlements` table + RLS + signup trigger, and
   the `ai_analysis` column on `summaries`.
2. **Backfill** entitlement rows for existing users:
   ```sql
   insert into public.entitlements (user_id)
   select id from auth.users on conflict do nothing;
   ```
3. (Optional) comp yourself Max:
   ```sql
   update public.entitlements e set tier='max'
   from auth.users u where e.user_id=u.id and u.email='YOUR_EMAIL';
   ```

## Step 2 — OpenRouter spend cap (cost backstop — don't skip)

OpenRouter dashboard → **set a hard monthly credit limit.** With GPT-5/Gemini
(thinking models) and two Opus calls per Max search, this is the one ceiling
that can't be bypassed by code.

## Step 3 — Upstash Redis

You already created the `lumen` Redis DB. You need its two REST values again for
Vercel (same as `.env.local`): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
This turns on caching + real rate limits in prod. (Rotate the token if it was
ever pasted somewhere public.)

## Step 4 — Vercel env vars + first deploy (to get the live domain)

**4a. If the project doesn't exist:** vercel.com/new → import the repo → Next.js
auto-detected → leave build settings default.

**4b. Set Environment Variables** (Project → Settings → Environment Variables,
**Production** scope) — everything *except* Stripe for now:
```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…            # REQUIRED now — the webhook writes tiers with this
OPENROUTER_API_KEY=…
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
UPSTASH_REDIS_REST_URL=…
UPSTASH_REDIS_REST_TOKEN=…
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>   # your real prod URL
```

**4c. Push the code** (committed locally, not yet pushed):
```
git push origin main
```
Vercel builds + deploys. Note your **production URL**. The upgrade page shows
"Coming soon" until Stripe keys are set — expected.

## Step 5 — Stripe (live mode)

1. **Activate the account:** switch to **live mode**; Stripe requires business
   details + a bank account for payouts before accepting real charges. Test-mode
   products/customers do **not** carry over.
2. **Products/Prices (live):** create `Lumen Pro` and `Lumen Max`, each a
   **recurring monthly** price → copy the two live `price_…` ids.
3. **Secret key:** Developers → API keys (live) → `sk_live_…`.
4. **Webhook endpoint:** Developers → **Webhooks** → **Add endpoint** →
   `https://<your-domain>/api/stripe/webhook` → events
   **`checkout.session.completed`**, **`customer.subscription.updated`**,
   **`customer.subscription.deleted`** → create → copy the **Signing secret**
   (`whsec_…`).
5. **Customer portal:** Settings → Billing → **Customer portal** → enable
   (cancel, and plan switching if desired) → **Save**. Powers the
   "Billing & invoices" button; live mode needs this activated once.

## Step 6 — Add Stripe env to Vercel + redeploy

Add these (Production), then **redeploy** (env changes need a fresh build):
```
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…          # from the live endpoint (Step 5.4)
STRIPE_PRICE_PRO=price_…               # live
STRIPE_PRICE_MAX=price_…               # live
```
> If your live prices differ from the `$8` / `$20` shown on the page, update the
> `PLANS` constant in `src/app/app/upgrade/page.tsx` to match.

## Step 7 — Supabase Auth URLs

Authentication → **URL Configuration**: **Site URL** = prod domain; add
`https://<your-domain>/auth/callback` to **Redirect URLs**. Also enable
**leaked-password protection**, and consider turning on **email confirmation**
once it's more than close friends.

## Step 8 — Smoke test on production

1. Sign up / log in.
2. Run a search (streams + sources); try GPT-5 or Gemini to confirm the
   multi-provider path works live.
3. **Upgrade to Pro** with a **real card** (live mode rejects test cards) →
   header pill flips to Pro, picker unlocks. Refund the charge in Stripe after.
4. **Settings** → downgrade / cancel → tier updates. Stripe **Webhooks** log
   shows `200`s.

## Step 9 — Onboard friends

They sign up (default **free**), then pay to self-upgrade (auto-set via webhook)
or you comp them with the Step 1.3 SQL. Watch the OpenRouter + Stripe dashboards
for the first few days.

---

## Required production env vars (full list)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # required in prod (Stripe webhook)
OPENROUTER_API_KEY
OPENROUTER_BASE_URL                # optional (has default)
UPSTASH_REDIS_REST_URL             # recommended (cache + rate limits)
UPSTASH_REDIS_REST_TOKEN
STRIPE_SECRET_KEY                  # sk_live_…
STRIPE_WEBHOOK_SECRET              # whsec_… from the live webhook endpoint
STRIPE_PRICE_PRO                   # live price id
STRIPE_PRICE_MAX                   # live price id
NEXT_PUBLIC_SITE_URL               # https://<prod-domain>
OPENROUTER_MODEL_CATEGORIZE        # optional override
JINA_API_KEY                       # optional (pasted-URL extraction)
```

## Gotchas
- `NEXT_PUBLIC_SITE_URL` must be the real domain, or Stripe redirects users to
  `localhost` after checkout.
- `SUPABASE_SERVICE_ROLE_KEY` is **required in prod** now (the webhook can't
  write tiers without it) — it was optional in earlier phases.
- Article models live in `src/lib/ai/model-catalog.ts` — the `slug`s are
  OpenRouter ids; verify/edit there if a model is renamed.
- Every future `git push` to `main` auto-deploys.
- Supabase free tier pauses after ~7 days idle — unpause if the app errors after
  a quiet stretch.
