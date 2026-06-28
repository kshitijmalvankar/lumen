# Lumen

Turn any topic or link into a clear, cited article from credible sources — with
a personal knowledge library, AI auto-categorization, a discovery feed, and an
insights dashboard.

Stack: **Next.js (App Router) + TypeScript · Tailwind v4 + shadcn/ui · Supabase
(Postgres + Auth, via the Supabase client) · OpenRouter (LLMs + built-in web
search) · Jina Reader (pasted URLs) · Upstash Redis · Vercel.**

See [`PLAN.md`](./PLAN.md) for the full product/technical plan and build phases.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment** — copy the example and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```
   You'll need: Supabase URL + anon key, and an OpenRouter API key (it powers
   both summarization and web-search source discovery). Upstash Redis and
   `JINA_API_KEY` are optional; the service-role key is for a later phase.
   See [`SETUP.md`](./SETUP.md) for a click-by-click walkthrough.

3. **Create the database** — open Supabase → **SQL Editor → New query**, paste
   the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click
   **Run**. It creates every table, enables Row-Level Security, and auto-creates
   a profile row on signup. Safe to re-run. *(No connection string or migration
   step needed — the app reads/writes through the Supabase client.)*

4. **Sign-in** — email + password works out of the box (Email provider is on by
   default; turn off "Confirm email" in Supabase → Authentication → Providers →
   Email for instant signup). Google sign-in is optional: configure a Google
   OAuth client and set the Supabase redirect URLs — see [`SETUP.md`](./SETUP.md).

5. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

> The app builds and runs before every key is set — features that need a missing
> key fail with a clear message, and auth-gated routes stay open in local dev
> until Supabase is configured.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint |

The database schema lives in [`supabase/schema.sql`](./supabase/schema.sql) — run
it in the Supabase SQL editor whenever it changes.

## Project structure

```
src/
  app/                 # routes: / (landing), /login, /auth/callback, /app (authed)
  components/          # UI: theme toggle, auth buttons, shadcn/ui
  lib/
    env.ts             # central, lenient env access
    supabase/          # browser + server clients, session proxy helper
    ai/                # OpenRouter client + per-use-case model selection
    search/            # web discovery (OpenRouter), credibility, pipeline, persistence
    extract/           # Jina Reader content extraction (pasted URLs)
    cache/             # Redis cache, rate limits, daily Google budget
  proxy.ts             # session refresh + route guarding (Next 16 proxy)
supabase/schema.sql    # tables + Row-Level Security + signup trigger (run in SQL editor)
```
