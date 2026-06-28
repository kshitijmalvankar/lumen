@AGENTS.md

# Lumen — project context (read this first)

Lumen is a web app that turns a **topic or pasted link** into a single,
**cited, Medium-style article** built from credible web sources, then saves it
into a personal knowledge library that auto-organizes by topic. For casual
readers and power users. **Web only (Next.js).**

Full product/technical plan: **[PLAN.md](./PLAN.md)**. Setup/run/test:
**[SETUP.md](./SETUP.md)**. Overview: **[README.md](./README.md)**.

## Status

- ✅ **Phase 0 — Foundation**: scaffold, theming, auth, DB schema, service wrappers.
- ✅ **Phase 1 — Core search → cited article**: built **and verified working**
  end-to-end in a real browser (search streams an article with inline citations
  + a credibility-scored source list; rows persist to Supabase).
- ⏭️ **NEXT: Phase 2 — Knowledge library** (browse search history; save/bookmark;
  article reader view of saved summaries). Then Phase 3 (AI auto-categorization +
  interest profile), Phase 4 (deep-research mode + follow-ups; URL-paste already
  works), Phase 5 (discovery feed + insights dashboard), Phase 6 (share + export).

## Tech stack (as actually built — note deviations from the original plan)

- **Next.js 16.2.9 (App Router) + React 19 + TypeScript + Tailwind v4.**
- **shadcn/ui built on Base UI** (`@base-ui/react`), **not Radix**.
- **Supabase** for Postgres + Auth, accessed **via the Supabase client**
  (`supabase.from(...)`). **No Drizzle, no ORM, no `DATABASE_URL`.** (We started
  with Drizzle, then switched to match the user's prior project style.)
- **OpenRouter** (OpenAI-compatible) for LLMs **and source discovery via its
  built-in `web` plugin**. (We started with Google Custom Search, then removed it
  entirely — no Google search engine, no `GOOGLE_CSE_*`.)
- **Jina Reader** (keyless) for **pasted-URL** extraction only.
- **Upstash Redis** (optional) for cache + per-user rate limits.
- Deploy target: **Vercel**.

## How search works (the core flow)

`POST /api/search` is an **NDJSON streaming** route (`src/app/api/search/route.ts`):
1. Auth (Supabase) → per-user rate limit → cache check.
2. **Keyword** query → `gatherSearchSources()` calls OpenRouter's `web` plugin
   (raw fetch, cheap model) and maps the returned `annotations`
   (`url_citation`: url/title/content) into numbered, credibility-scored sources.
   **Pasted URL** → `gatherUrlSource()` via Jina (no key).
3. `buildMessages()` → `streamSummary()` (quick model) writes a Markdown article
   that cites sources as `[n]`; tokens stream to the client.
4. `parseArticle()` → title + ordered blocks + per-block citations + coverage.
5. `persistResult()` writes summary/blocks/sources/citations; search marked done.
6. Cache the result. Events emitted: `status`, `sources`, `delta`, `done`, `error`.

Client `SearchView` (`src/components/search/`) drives the stream; `CitationMarkdown`
turns `[n]` into superscript links that scroll to `SourceList` (`#source-n`).

## Key files

```
src/app/page.tsx                 landing
src/app/login|signup/page.tsx    email+password auth pages (AuthForm)
src/app/auth/actions.ts          login/signup/signInWithGoogle server actions
src/app/auth/callback/route.ts   OAuth code exchange
src/app/app/(layout|page).tsx    authed shell + SearchView
src/app/api/search/route.ts      streaming search endpoint
src/proxy.ts                     session refresh + route guard (Next 16 "proxy", not middleware)
src/lib/env.ts                   lenient env access (requireEnv at use site)
src/lib/supabase/*               browser + server clients, proxy session helper
src/lib/ai/{openrouter,models,prompts,summarize,parse}.ts
src/lib/search/{pipeline,persist,credibility}.ts
src/lib/extract/jina.ts          pasted-URL extraction
src/lib/cache/redis.ts           cache + rate limit (no-ops if Upstash unset)
src/components/{search,auth}/*, src/components/ui/*  (shadcn)
supabase/schema.sql              ALL tables + RLS + signup trigger (run in SQL editor)
```

## Data model

16 tables in `supabase/schema.sql` (idempotent): `profiles`, `searches`,
`summaries`, `summary_blocks`, `sources`, `block_citations`, `messages`,
`categories`, `search_categories`, `tags`, `search_tags`, `bookmarks`, `shares`,
`interest_profile`, `suggestions`, `usage_quota`. **RLS on every table scoped to
`user_id = auth.uid()`** (profiles uses `id`). A trigger auto-creates a profile
row on signup. Every owned row carries `user_id`; always set it on insert.

## Env vars (`.env.local`, gitignored)

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`OPENROUTER_API_KEY`, `NEXT_PUBLIC_SITE_URL`. Optional: `SUPABASE_SERVICE_ROLE_KEY`
(later), `OPENROUTER_MODEL_{QUICK,DEEP,CATEGORIZE}` overrides, `JINA_API_KEY`,
`UPSTASH_REDIS_REST_URL`/`_TOKEN`. See `.env.example`.

Default OpenRouter models (`src/lib/ai/models.ts`): quick=`anthropic/claude-sonnet-4.5`,
deep=`anthropic/claude-opus-4.1`, categorize=`anthropic/claude-haiku-4.5`.

## Conventions & gotchas (learned the hard way)

- **Base UI, not Radix.** Components use a `render` prop, NOT `asChild`. For a
  button-styled link use `buttonVariants()` + `<Link className={cn(...)}>`. The
  theme toggle styles `DropdownMenuTrigger` directly with `buttonVariants`.
- **Middleware is `src/proxy.ts`** exporting `proxy` + `config` (Next 16 renamed
  it; `middleware.ts` is deprecated).
- **Regex:** no `s` (dotAll) flag — TS target errors on it.
- **Restart `npm run dev`** after editing `.env.local` or deleting/renaming
  modules or API routes — Fast Refresh does NOT reload env or removed files.
  (This was the cause of a "search not working" report — the code was fine.)
- App builds/runs before keys are set: `requireEnv` throws only at the call site;
  `/api/search` returns a clean 503 when Supabase isn't configured.
- `npm run build` and `npm run lint` both currently pass. Node 24, npm 11.
- Preview MCP: `.claude/launch.json` defines server `lumen` on port 3000.

## Environment config status (this machine)

- Supabase project is set up; URL + anon key + OpenRouter key are in `.env.local`.
- `supabase/schema.sql` **has been run** (tables exist). Email provider has
  **"Confirm email" OFF** (autoconfirm), so email/password signup logs in
  instantly. Google OAuth is **not** configured (optional). Upstash + Jina keys
  not set (optional; app works without them).
- A test user exists in Supabase from manual testing.

## Working agreements

- Build in phases; verify each (`npm run build` + lint, and the Preview MCP for
  real-browser checks) before moving on. Don't add features beyond the agreed
  scope without asking. Commit only when the user asks.
- Known minor follow-up: `src/lib/search/credibility.ts` lacks major Indian
  outlets (Economic Times, Mint, Business Standard, Hindu BusinessLine, etc.), so
  they show as "Unverified" — worth expanding the tier lists.
