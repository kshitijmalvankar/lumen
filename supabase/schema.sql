-- ============================================================================
-- Lumen database schema
-- ----------------------------------------------------------------------------
-- HOW TO RUN: open your Supabase project -> SQL Editor -> New query, paste this
-- whole file, and click "Run". It is safe to re-run (uses IF NOT EXISTS / drops
-- policies before recreating them, and guards enum creation).
-- ============================================================================

-- ---------- Extensions ------------------------------------------------------
-- pgvector powers Library Intelligence (semantic search over saved articles).
create extension if not exists vector;

-- ---------- Enums -----------------------------------------------------------
do $$ begin create type input_type as enum ('keyword','url');
exception when duplicate_object then null; end $$;

do $$ begin create type mode as enum ('quick','deep');
exception when duplicate_object then null; end $$;

do $$ begin create type search_status as enum ('queued','running','done','error');
exception when duplicate_object then null; end $$;

do $$ begin create type length_kind as enum ('paragraph','article');
exception when duplicate_object then null; end $$;

do $$ begin create type block_type as enum ('text','heading');
exception when duplicate_object then null; end $$;

do $$ begin create type credibility_tier as enum ('high','medium','low','unknown');
exception when duplicate_object then null; end $$;

do $$ begin create type political_lean as enum ('left','lean-left','center','lean-right','right','unknown');
exception when duplicate_object then null; end $$;

do $$ begin create type message_role as enum ('user','assistant');
exception when duplicate_object then null; end $$;

do $$ begin create type suggestion_type as enum ('topic','article');
exception when duplicate_object then null; end $$;

do $$ begin create type plan_tier as enum ('free','pro','max');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------------------------------------------------------

-- One profile row per authenticated user (auto-created by a trigger below).
create table if not exists public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text,
  display_name            text,
  personalization_enabled boolean not null default true,
  created_at              timestamptz not null default now()
);

-- Billing tier per user. SERVER-AUTHORITATIVE: the owner may read this row but
-- NOT write it (no write policy below), so a tier can never be self-upgraded
-- from the browser. Writes happen via the service-role key (Stripe webhook, or
-- manually in the dashboard).
create table if not exists public.entitlements (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  tier                   plan_tier not null default 'free',
  current_period_end     timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  updated_at             timestamptz not null default now()
);

create table if not exists public.searches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  query            text not null,
  normalized_query text not null,
  input_type       input_type not null default 'keyword',
  mode             mode not null default 'quick',
  status           search_status not null default 'queued',
  error            text,
  created_at       timestamptz not null default now()
);
create index if not exists searches_user_created_idx on public.searches (user_id, created_at);
create index if not exists searches_user_normalized_idx on public.searches (user_id, normalized_query);

create table if not exists public.summaries (
  id                uuid primary key default gen_random_uuid(),
  search_id         uuid not null references public.searches(id) on delete cascade,
  user_id           uuid not null,
  title             text not null,
  model_used        text,
  length_kind       length_kind not null default 'article',
  citation_coverage real,
  created_at        timestamptz not null default now()
);
create index if not exists summaries_user_idx on public.summaries (user_id);
-- Lumen's own AI commentary (Pro/Max only); null when free or nothing to add.
alter table public.summaries add column if not exists ai_analysis text;
-- The output lens used to write the article (see src/lib/ai/formats.ts); lets
-- the reader show the current format and offer re-formatting later.
alter table public.summaries add column if not exists format text not null default 'standard';

create table if not exists public.summary_blocks (
  id         uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.summaries(id) on delete cascade,
  user_id    uuid not null,
  position   integer not null,
  type       block_type not null default 'text',
  content    text not null
);
create index if not exists summary_blocks_summary_idx on public.summary_blocks (summary_id, position);

create table if not exists public.sources (
  id               uuid primary key default gen_random_uuid(),
  summary_id       uuid not null references public.summaries(id) on delete cascade,
  user_id          uuid not null,
  position         integer not null,
  url              text not null,
  canonical_url    text,
  title            text,
  domain           text,
  published_at     timestamptz,
  credibility_tier credibility_tier not null default 'unknown',
  political_lean   political_lean not null default 'unknown',
  snippet          text
);
-- Full extracted source text (kept so follow-up chat + reformatting can ground
-- in the actual content, not just the 200-char snippet). Null for older rows.
alter table public.sources add column if not exists content text;
-- Idempotent add for databases created before political_lean existed.
alter table public.sources add column if not exists political_lean political_lean not null default 'unknown';
create index if not exists sources_summary_idx on public.sources (summary_id, position);

-- Shared, self-growing source-reputation table: dynamic credibility + political
-- lean per domain (Lumen's own estimate). NOT user-scoped. Written only by the
-- service-role client; RLS is enabled with NO user policy, so normal users can't
-- read or write it directly — all access goes through trusted server code.
create table if not exists public.source_ratings (
  domain           text primary key,
  credibility_tier credibility_tier not null default 'unknown',
  political_lean   political_lean not null default 'unknown',
  confidence       real,
  rated_by         text not null default 'llm',   -- 'seed' | 'llm' | 'manual'
  rated_at         timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.source_ratings enable row level security;

create table if not exists public.block_citations (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references public.summary_blocks(id) on delete cascade,
  source_id  uuid not null references public.sources(id) on delete cascade,
  user_id    uuid not null,
  cited_text text
);
create index if not exists block_citations_block_idx on public.block_citations (block_id);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  search_id  uuid not null references public.searches(id) on delete cascade,
  user_id    uuid not null,
  role       message_role not null,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_search_idx on public.messages (search_id, created_at);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_user_name_idx on public.categories (user_id, name);

create table if not exists public.search_categories (
  search_id   uuid not null references public.searches(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  user_id     uuid not null,
  confidence  real,
  primary key (search_id, category_id)
);

create table if not exists public.tags (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name    text not null
);
create unique index if not exists tags_user_name_idx on public.tags (user_id, name);

create table if not exists public.search_tags (
  search_id uuid not null references public.searches(id) on delete cascade,
  tag_id    uuid not null references public.tags(id) on delete cascade,
  user_id   uuid not null,
  primary key (search_id, tag_id)
);

create table if not exists public.bookmarks (
  user_id    uuid not null,
  summary_id uuid not null references public.summaries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, summary_id)
);

create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  summary_id  uuid not null references public.summaries(id) on delete cascade,
  user_id     uuid not null,
  public_slug text not null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create unique index if not exists shares_slug_idx on public.shares (public_slug);

create table if not exists public.interest_profile (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  topic        text not null,
  weight       real not null default 1,
  last_seen_at timestamptz not null default now()
);
create unique index if not exists interest_user_topic_idx on public.interest_profile (user_id, topic);

create table if not exists public.suggestions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  type       suggestion_type not null,
  title      text not null,
  url        text,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists suggestions_user_idx on public.suggestions (user_id, created_at);

create table if not exists public.usage_quota (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  period         date not null,
  quick_count    integer not null default 0,
  deep_count     integer not null default 0,
  google_queries integer not null default 0
);
create unique index if not exists usage_user_period_idx on public.usage_quota (user_id, period);

-- Generated single-narrator audio overviews (Hume Octave TTS). One per summary;
-- `segments` holds [{ index, text, path }] where path points into the private
-- `audio` storage bucket. Staged across serverless invocations, so status walks
-- pending → synthesizing → ready (or error).
create table if not exists public.audio_overviews (
  id         uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.summaries(id) on delete cascade,
  user_id    uuid not null,
  status     text not null default 'synthesizing',
  script     text,
  segments   jsonb not null default '[]'::jsonb,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists audio_overviews_summary_idx on public.audio_overviews (summary_id);

-- Private bucket for generated audio; served via short-lived signed URLs from
-- the service-role client (no public access).
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

-- ---------- Library Intelligence: semantic embeddings + cross-library chat ---
-- Per-chunk embeddings of each saved article, for "Ask your library" (RAG) and
-- "Related in your library". User-scoped (RLS below). Written by the owner's
-- session from POST /api/library/index; read via the match_* RPCs below.
create table if not exists public.summary_embeddings (
  id          uuid primary key default gen_random_uuid(),
  summary_id  uuid not null references public.summaries(id) on delete cascade,
  user_id     uuid not null,
  chunk_index integer not null,
  content     text not null,
  embedding   vector(1024) not null,
  token_count integer,
  created_at  timestamptz not null default now()
);
create unique index if not exists summary_embeddings_chunk_idx
  on public.summary_embeddings (summary_id, chunk_index);
create index if not exists summary_embeddings_user_idx
  on public.summary_embeddings (user_id);
-- Approximate-nearest-neighbour index for cosine similarity search.
create index if not exists summary_embeddings_hnsw_idx
  on public.summary_embeddings using hnsw (embedding vector_cosine_ops);

-- Cross-library RAG chat history (one implicit default thread per user for now).
create table if not exists public.library_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  thread_id  uuid not null,
  role       message_role not null,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists library_messages_thread_idx
  on public.library_messages (user_id, thread_id, created_at);

-- Cosine top-K over the caller's own chunks. NOT security definer, so it runs
-- with the caller's privileges and RLS scopes results to their rows.
create or replace function public.match_library_chunks(
  query_embedding vector(1024),
  match_count int default 10
)
returns table (summary_id uuid, chunk_index int, content text, similarity real)
language sql stable
as $$
  select se.summary_id, se.chunk_index, se.content,
         (1 - (se.embedding <=> query_embedding))::real as similarity
  from public.summary_embeddings se
  where se.user_id = auth.uid()
  order by se.embedding <=> query_embedding
  limit match_count;
$$;

-- Nearest saved articles to a given one (for "Related in your library"), keyed
-- off that article's opening chunk and excluding itself.
create or replace function public.match_related_summaries(
  source_summary_id uuid,
  match_count int default 4
)
returns table (summary_id uuid, similarity real)
language sql stable
as $$
  with q as (
    select embedding from public.summary_embeddings
    where summary_id = source_summary_id and user_id = auth.uid()
    order by chunk_index limit 1
  )
  select se.summary_id,
         max((1 - (se.embedding <=> (select embedding from q)))::real) as similarity
  from public.summary_embeddings se
  where se.user_id = auth.uid()
    and se.summary_id <> source_summary_id
    and exists (select 1 from q)
  group by se.summary_id
  order by similarity desc
  limit match_count;
$$;

-- ---------- Proactive discovery: watched topics + weekly digest opt-in ------
-- Topics a user asked Lumen to keep an eye on. The weekly digest cron surfaces
-- them (with interest-driven suggestions) by email. User-scoped (RLS below).
create table if not exists public.topic_watches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  query            text not null,
  created_at       timestamptz not null default now(),
  last_notified_at timestamptz
);
create unique index if not exists topic_watches_user_query_idx
  on public.topic_watches (user_id, lower(query));

-- Per-user weekly-digest opt-in (default on; toggled in Settings, honored by the
-- cron). Lives on profiles (whose RLS keys on id).
alter table public.profiles
  add column if not exists weekly_digest boolean not null default true;

-- ---------- Row-Level Security ---------------------------------------------
-- Every per-user table is scoped to its owner via user_id = auth.uid().
do $$
declare t text;
begin
  foreach t in array array[
    'searches','summaries','summary_blocks','sources','block_citations',
    'messages','categories','search_categories','search_tags','tags',
    'bookmarks','shares','interest_profile','suggestions','usage_quota',
    'audio_overviews','summary_embeddings','library_messages','topic_watches'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t || '_owner', t
    );
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- entitlements: owner may READ only. No write policy => the anon/authenticated
-- client cannot insert/update/delete (RLS default-deny); only the service-role
-- key bypasses RLS. This is what makes the tier un-self-upgradable.
alter table public.entitlements enable row level security;
drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
  for select to authenticated
  using (user_id = auth.uid());

-- ---------- Auto-create a profile on signup ---------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  -- Every new user starts on the free tier.
  insert into public.entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
