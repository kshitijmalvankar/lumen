# Lumen — Discovery & Summarization App: Product & Technical Plan

> **Lumen** is a suggested working name (illumination / discovery). Alternatives: *Distill, Prism, Gist*. Rename anytime.
> This is the agreed plan after two interview rounds. Hand it to an AI builder (Claude Code) or a developer to execute. **Web only, Next.js.**

---

## Context

People (e.g. the founder's father — a casual reader who loves forwarding interesting articles on **AI, finance, and health**) want quick, trustworthy answers on a topic without wading through ten blue links. Power users want to go deep and verify every claim.

Lumen turns a **keyword/topic or a pasted link** into a **single, factually-grounded, Medium-style article with inline citations**, always linking back to credible sources so any claim can be verified. It **remembers everything searched, auto-organizes it by topic into a personal knowledge library**, learns the user's interests to **suggest topics and surface trending articles**, and offers an **insights dashboard** of what they've explored.

It must serve **both casual and power users**: dead-simple by default (type → read an article), powerful on demand ("Go deeper" multi-source research, follow-ups, source inspection).

---

## Decisions locked in

| Area | Decision |
|---|---|
| Platform | **Web only**, Next.js. Responsive so it works in mobile browsers; no native app / PWA in scope |
| Audience | **Casual + power users** — simple default flow, powerful capabilities on demand |
| Inputs | **Keyword/topic search**, **paste a URL**, **conversational follow-ups** |
| Research depth | **Tiered**: fast summary by default + **"Go deeper"** deep-research mode |
| AI models | **OpenRouter** — dynamic model selection per use case (quick / deep / categorize), swappable |
| Live web search | **Google Custom Search JSON API** (free tier, 100 queries/day) |
| Content sources | Credible **news sites, blogs, research papers, PDFs**, general web. **No YouTube transcripts** |
| Freshness | Prioritize **last 24h–1 week**; prefer recent sources |
| Article length | **Adaptive** — one paragraph if little found; multi-section article with source links if lots |
| Source trust | **All of:** inline citations + full source list + credibility signals + conflicting-views callout; always show links to verify |
| Categorization | **Fully AI-generated** auto-categorization of past searches (v1) |
| Library | **Save summaries** (personal knowledge library), **bookmark/favorite**, **share** |
| Personalization | Learn from history → **suggest topics + trending articles**; **insights dashboard** |
| Auth + DB | **Supabase** (Postgres + Auth + RLS); **Google + Apple** sign-in |
| Design | **Dark/light toggle**, modern, **shadcn/ui** |
| Hosting | **Vercel** |
| Out of scope | Native mobile/PWA, YouTube, and any features beyond the list above |

---

## Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase for UI + API; streaming; Vercel-native |
| UI | **React + Tailwind + shadcn/ui** | Modern components; built-in dark/light theming (`next-themes`) |
| DB + Auth | **Supabase** (Postgres + Auth + RLS) | You already use it; Google + Apple OAuth; per-user row isolation |
| ORM | **Drizzle ORM** | Typed schema + migrations (Prisma also fine) |
| LLM gateway | **OpenRouter** (OpenAI-compatible API) | One key, many models; pick per use case; easy to swap |
| Web search | **Google Custom Search JSON API** (Programmable Search Engine) | Free 100/day; trusted; supports date-restrict + domain config |
| Content extraction | **Jina Reader** (`r.jina.ai`, free) primary; **Mozilla Readability + jsdom** fallback | Clean article text incl. **PDFs**; no scraping infra to run |
| Cache + rate limit | **Upstash Redis** (or a Supabase table) | Shared topic cache + per-user/day query budgeting |
| Background jobs | **Inngest** (or Trigger.dev) | Durable deep-research + categorization + trending-refresh jobs |
| Charts | **Recharts** / shadcn charts | Insights dashboard |
| Hosting | **Vercel** | Deploy target |

> **Note on OpenRouter:** it exposes an OpenAI-compatible endpoint, so the app uses the OpenAI SDK pointed at OpenRouter (not the Anthropic SDK). Models are chosen by a small `selectModel(useCase)` mapping (below), so swapping is a config change.

---

## The engine: retrieval-augmented summarization pipeline

Because we use Google search + our own extraction (not a model's built-in web tool), **we control the source set** — which makes citations and credibility scoring reliable and provider-agnostic. All steps run **server-side**; keys never reach the browser.

**Pipeline (Quick mode):**

1. **Normalize + cache check.** Normalize the query; check the shared cache for a fresh result (TTL tied to the freshness window). Hit → return instantly, no Google quota spent.
2. **Search.** Call Google Custom Search with a **freshness filter** (`dateRestrict=d1`/`w1`) and the Programmable Search Engine configured to **boost/allow credible domains**. Get top N results (URL, title, snippet, date).
3. **Extract.** Fetch + extract clean main content for each result via Jina Reader (Readability fallback); handle **PDFs**. Keep the source index for each.
4. **Score credibility.** Tag each source with a **credibility tier** (e.g. major news / .edu / .gov / known journals = high; established blogs = medium; unknown = low) and recency.
5. **Summarize via OpenRouter.** Feed the numbered source texts to the model with a prompt that produces a **Medium-style article**: **adaptive length** (one paragraph if thin, multi-section with headings if rich), **inline citations** `[n]` mapped to our sources, and a **"where sources disagree" callout** when they conflict.
6. **Parse + persist + stream.** Map `[n]` → sources; store article blocks, per-block citations, sources; stream tokens to the UI.
7. **Background.** Auto-categorize (fully AI) and update the interest profile.

**Deep research mode:** the model first decomposes the topic into sub-questions, runs **multiple** Google queries, gathers more/higher-quality sources, and writes a longer multi-section article. Runs as a **durable background job** (can take minutes) with live progress states. Uses a stronger model. *Note: each deep run consumes several of the 100 daily Google queries — caching + budgeting matter (below).*

**Paste-a-URL:** skip Google; extract that URL (+ optional supporting search) → summarize that page with citations.

**Follow-ups:** maintain the per-search message thread; follow-ups can trigger fresh searches; reuse prior sources as context.

### OpenRouter model tiers (examples — swap freely in OpenRouter)

| Use case | Example model | Why |
|---|---|---|
| Quick summary (default) | a fast, strong mid-tier model (e.g. Claude Sonnet / Gemini Flash / GPT-mini class) | speed + quality at low cost |
| Deep research | a top reasoning model (e.g. Claude Opus / GPT large / Gemini Pro class) | depth, multi-source synthesis |
| Categorize / tag / extract topics | a cheap fast small model | high volume, low stakes |

A `selectModel(useCase)` helper maps these; `openrouter/auto` is available if you want OpenRouter to route dynamically.

---

## Accuracy, sources & freshness (core promise)

- **Source focus:** configure the Programmable Search Engine toward credible news, blogs, research papers, and PDFs; de-prioritize low-quality domains; **YouTube excluded.**
- **Freshness:** default to recent (24h–1 week) via `dateRestrict`; the prompt instructs the model to prefer recent sources and note publish dates.
- **Always verifiable:** every article shows **inline citations**, a **full source list** (title, domain, date, link, credibility tier), so users can click through to verify any claim.
- **Conflicting views:** the prompt makes the model surface disagreement across sources instead of blending it.
- **Honesty:** if search returns nothing usable, say so — never fabricate. Show a **low-source-coverage** badge when few claims are cited.
- **Sensitive topics (health/finance):** since these are core to the audience, show a brief "informational, not professional advice" note and lean on higher-credibility sources. (Guardrail, not a separate feature.)

---

## Cost & limits (Google 100/day is the key constraint)

- **Aggressive caching** of summaries (by normalized query + freshness window) and extracted sources — the single biggest lever for staying under 100 Google queries/day and for speed.
- **Per-user + global daily query budget** in Redis; degrade gracefully (serve cached / queue / inform) when the daily Google quota is near.
- **Per-user rate limits from day one** so a shared link can't drain the OpenRouter budget.
- **Scale path (noted, not built):** Google CSE paid tier (~$5 / 1000 queries) when 100/day is outgrown.

---

## Data model (Supabase Postgres, RLS-scoped to `user_id`)

- `users` — Supabase Auth (Google + Apple).
- `searches` — `id, user_id, query, normalized_query, input_type (keyword|url), mode (quick|deep), status, created_at`.
- `summaries` — `id, search_id, model_used, length_kind (paragraph|article), citation_coverage, created_at`.
- `summary_blocks` — `id, summary_id, position, type (text|heading), content` (ordered article body).
- `block_citations` — `id, block_id, source_id, cited_text` (citations attached **per block**).
- `sources` — `id, url, canonical_url, title, domain, published_at, credibility_tier, snippet`.
- `messages` — `id, search_id, role, content, created_at` (follow-up thread).
- `categories` — `id, user_id, name` (AI-generated).
- `search_categories` — `search_id, category_id, confidence`.
- `tags` + `search_tags`.
- `bookmarks` — `user_id, summary_id`.
- `shares` — `id, summary_id, public_slug (unguessable), revoked_at`.
- `interest_profile` — `user_id, topic, weight, last_seen_at` (time-decayed).
- `suggestions` / `trending` — cached per-user topic/article suggestions (refreshed by a daily job).
- `usage_quota` — `user_id, period, quick_count, deep_count, google_queries`.

---

## Personalization, discovery & dashboard

- **Interest profile:** each summary bumps `weight` for its topics with time decay so stale interests fade. User can **view, edit, reset, or disable** personalization (sensitive reading data — keep per-user, RLS-protected, deletable).
- **Suggested topics + trending feed:** a **daily background job** runs a few searches in the user's top interest areas (budget-aware against the 100/day limit) and surfaces fresh articles + suggested topics on a "Discover / For You" view.
- **Insights dashboard:** a visualization page — searches over time, **category breakdown**, top interests/tags, totals, and recent activity (Recharts). The casual-vs-power split shows here too: casual users glance; power users explore trends.

---

## Build phases (each independently shippable)

**Phase 0 — Foundation.** Next.js + TS + Tailwind + shadcn + dark/light toggle (`next-themes`); Supabase schema + RLS; **Supabase Auth with Google + Apple**; Drizzle migrations; OpenRouter client wrapper + `selectModel`; Google CSE wrapper; Jina Reader extraction wrapper; Redis cache + **per-user rate limit + daily Google-query budget**.

**Phase 1 — Core MVP (the magic).** Query → Google search → extract → OpenRouter summarize → **Medium-style adaptive article** with **inline citations + source list + credibility tiers + conflicting-views**; streaming; topic cache; clean onboarding/empty state with example searches. *Perfect this first; it serves casual users fully on its own.*

**Phase 2 — Knowledge library.** Persist + browse search history; **save summaries**; **bookmark/favorite**; library search/filter; article reader view.

**Phase 3 — AI auto-categorization + interest profile.** Background categorize (fully AI) with category reconciliation (avoid near-duplicates); build interest profile + user privacy controls.

**Phase 4 — Deep research, paste-URL, follow-ups.** "Go deeper" durable job + progress UX; URL input → extract+summarize; conversational follow-ups.

**Phase 5 — Discovery + dashboard.** Suggested topics + trending feed (daily job); insights dashboard with visualizations.

**Phase 6 — Share (+ optional export).** Revocable, unguessable **share links** (read-only public view; shared content is effectively published); optional Markdown/PDF export.

> *Later / optional (not in scope now):* monetization via the quick-free / deep-paid split + Stripe — the architecture already supports it.

---

## Quality check (lightweight, ongoing)

Keep a small set (~20–30 queries across AI/finance/health) and a script that checks **citation coverage**, **source credibility/recency**, and spot-checks for hallucination whenever the prompt or model changes. This protects the "accurate & credible" promise as models are swapped via OpenRouter.

---

## Verification (end-to-end)

1. **Setup:** `npm run dev`; configure Supabase, OpenRouter, Google CSE, Redis env; sign in with **Google** (and **Apple** once the Apple developer account is set up).
2. **Quick search:** "AI landscape in India" → a **Medium-style article streams in**, with **inline citations**, a **source list** showing domain/date/credibility, and a **conflicting-views** note if sources differ. DB rows created across `searches`/`summaries`/`summary_blocks`/`block_citations`/`sources`. Re-run same query → **cache hit**, no Google quota spent.
3. **Adaptive length:** a thin topic → ~one paragraph; a rich topic → multi-section article with headings + source links.
4. **Freshness:** confirm sources skew to the last day/week.
5. **Categorization:** background job files the search under an AI-generated topic; interest profile updates; editing/resetting the profile works.
6. **Deep mode:** "Go deeper" → progress states → longer multi-source article; runs as a job and saves even if you leave the tab.
7. **Paste URL:** paste an article link → summarizes that page with citations.
8. **Follow-up:** "go deeper on regulation" → refines with prior context.
9. **Library:** save, bookmark/favorite, reopen from library.
10. **Discovery + dashboard:** Discover feed shows fresh articles in your interests; dashboard renders category breakdown + activity charts.
11. **Share:** generate a link, open incognito, then **revoke** → 404.
12. **Limits & isolation:** exceed per-user rate limit → graceful message; near 100 Google queries → graceful degrade; second user can't see the first's data (RLS).

---

## Open items / assumptions

- **App name** — using *Lumen* as placeholder.
- **Apple Sign-In** requires an Apple Developer account ($99/yr) + config; assume **Google first, Apple when the developer account is ready** (Supabase supports both).
- **Cache TTL** for shared summaries (freshness vs. saving Google quota) — tune in Phase 1.
- **Deep-research caps** (sub-questions / Google queries per run) to protect the 100/day budget.
- **OpenRouter model choices** per tier — start with the examples above, refine via the quality check.

---

*Planning artifact. Only the recommended approach is carried forward; alternatives noted inline where a real choice remains.*
