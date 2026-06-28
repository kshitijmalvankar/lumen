# Lumen — Setup & Test Guide

Source discovery uses **OpenRouter's built-in web search**, so there's no search
engine to set up. You need only **4 values** in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
OPENROUTER_API_KEY
NEXT_PUBLIC_SITE_URL   (= http://localhost:3000)
```

> Status if you've been following along: `NEXT_PUBLIC_SUPABASE_URL`,
> `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `OPENROUTER_API_KEY` are already in your
> `.env.local`. Remaining: **run `schema.sql`** and **set up sign-in**, then run.

---

## 1. Supabase project (~3 min)  ✅ if already done

1. **https://supabase.com** → sign in → **New project** (name `lumen`, Free
   plan) → wait ~2 min.
2. **Project Settings → API** → copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`,
   and the **anon / public** (a.k.a. "Publishable") key →
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 2. OpenRouter key (~2 min)  ✅ if already done

1. **https://openrouter.ai** → **Keys → Create Key** → `OPENROUTER_API_KEY`.
2. Add a little credit (**Settings → Credits**). Each search costs ~3–5¢
   (web search + summary). The default models are used automatically.

## 3. Create the database tables (~1 min)

1. **Supabase → SQL Editor → New query**.
2. Paste **all** of `supabase/schema.sql` from this repo → **Run**.
3. Verify in **Table Editor**: you should see `searches`, `summaries`,
   `sources`, `profiles`, etc.

## 4. Sign-in — email + password (no external setup)

Email auth is enabled by default in Supabase. For **instant** testing:

1. **Supabase → Authentication → Providers → Email** → turn **OFF**
   *"Confirm email"* → Save. (Now signup logs you straight in, no confirmation
   email needed.)

That's all — you'll create an account on the signup page in step 7.

**Optional — Google sign-in.** The "Continue with Google" button is already in
the app, but it only works after you configure a Google OAuth client. You do
**not** need this to test. To enable it later:
1. **https://console.cloud.google.com** → create/select a project →
   **APIs & Services → OAuth consent screen** (External; add your email as a
   Test user).
2. In **Supabase → Authentication → Providers → Google**, copy the **Callback
   URL** shown.
3. **Credentials → Create credentials → OAuth client ID → Web application** →
   add that Callback URL under **Authorized redirect URIs** → copy Client ID +
   secret → paste into Supabase → enable → Save.
4. **Authentication → URL Configuration** → Site URL `http://localhost:3000`,
   add Redirect URL `http://localhost:3000/**`.

## 5. Confirm `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
OPENROUTER_API_KEY=<your openrouter key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
Leave Upstash and Jina blank — optional. (Upstash adds caching + rate limits;
Jina is only used for pasted-URL summaries and works without a key.)

## 6. Run

```bash
cd /Users/kshitijmalvankar/Projects/news
npm install      # if you haven't already
npm run dev
```
Open the printed URL (usually **http://localhost:3000**).

> If it uses a different port (e.g. 3001), add `http://localhost:3001/**` to
> Supabase → Authentication → URL Configuration → Redirect URLs.

---

## 7. Test, step by step

1. **Landing page** loads → toggle dark/light (top-right).
2. **Get started → Sign up** → enter any email + a 6+ character password →
   you land on **/app**. (With "Confirm email" off, you're signed in instantly.)
3. Search **`AI landscape in India`**. Watch for:
   - status: *Searching credible sources… → Writing your article…*
   - the article **streaming in** with superscript citations (¹ ²)
   - click a citation → scrolls to that item in **Sources** (domain +
     credibility badge)
   - a coverage note (e.g. "85% of claims cited")
4. **Paste-a-link test:** paste a news article URL → it summarizes that page.
5. **It's saved:** Supabase → **Table Editor → `summaries`** shows your rows.
6. **Sign out** (top-right) → `/app` now redirects to `/login`.

---

## Troubleshooting

| Symptom | Likely fix |
|---|---|
| Search says "isn't fully configured" | Keys missing in `.env.local`; **restart `npm run dev`** after editing it |
| Google login: "Access blocked / not verified" | Add your email under **OAuth consent screen → Test users** |
| Login returns to `/login?error=auth` | Google **Authorized redirect URI** must be the **Supabase** callback URL; and your localhost URL must be in Supabase **Redirect URLs** |
| "Couldn't find usable sources" | OpenRouter web search returned nothing — try rephrasing; check you have OpenRouter credit |
| OpenRouter error / "model not found" | Add credits, or set `OPENROUTER_MODEL_QUICK` to a current slug from openrouter.ai/models |
| Changed `.env.local` but nothing changed | Env is read only at startup — stop and re-run `npm run dev` |

---

### Faster sign-in option
If the Google OAuth steps are more than you want right now, I can add a one-field
**email magic-link** sign-in so you can test without any OAuth setup — just ask.
