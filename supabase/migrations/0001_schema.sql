-- Pulse schema. Every table/column has exactly one owner: ARJUN or SYSTEM.
-- See supabase/migrations/0002_ownership.sql for the enforcement layers.

create extension if not exists pgcrypto;

create type account_stage      as enum ('prospect','outreach','pilot','customer');
create type warmth_tier        as enum ('hot','warm','cool','quiet');
create type score_trend        as enum ('rising','steady','falling');
create type draft_channel      as enum ('email','linkedin_connect','linkedin_dm','linkedin_followup');
create type draft_status       as enum ('draft','used','discarded');
create type activity_channel   as enum ('email','linkedin','call','meeting','whatsapp','other');
create type activity_direction as enum ('outbound','inbound');
create type activity_outcome   as enum ('no_reply','replied','meeting_booked','not_interested','follow_up');
create type activity_via       as enum ('manual','send_button','linkedin_mark_sent');

-- ───────────── config ─────────────
create table signal_types (
  type            text primary key,
  label           text not null,
  base_weight     numeric not null,
  half_life_days  numeric not null
);

insert into signal_types values
  ('leadership_hire',          'Leadership hire',         30, 21),
  ('headcount_expansion',      'Headcount expansion',     28, 14),
  ('funding_round',            'Funding round',           25, 30),
  ('workforce_digitalisation', 'Workforce digitalisation',22, 21),
  ('operational_challenge',    'Operational challenge',   20, 10),
  ('expansion_geo',            'Geographic expansion',    18, 14),
  ('m_and_a',                  'M&A / restructuring',     15, 21);

create table product_profile (
  id           int primary key default 1 check (id = 1),
  product_name text not null,
  description  text not null,
  buyers       text not null,
  best_fit     text not null,
  sender_name  text not null,
  signature    text not null
);

-- ───────────── accounts (mixed ownership, guarded per column) ─────────────
create table accounts (
  id                    uuid primary key default gen_random_uuid(),
  -- ARJUN
  company_name          text not null unique,
  domain                text,
  industry              text,
  hq_city               text,
  employee_band         text,
  stage                 account_stage not null default 'prospect',
  search_aliases        text[] not null default '{}',
  exclude_terms         text[] not null default '{}',
  last_contact_date     date,
  arjun_notes           text,
  relationship_read     text,
  next_step             text,
  next_step_due         date,
  do_not_contact_until  date,
  -- SYSTEM
  warmth_score          numeric not null default 0,
  warmth_tier           warmth_tier not null default 'quiet',
  score_trend           score_trend not null default 'steady',
  score_breakdown       jsonb not null default '[]',
  top_signal_id         uuid,
  signal_summary        text,
  why_now               text,
  outreach_angle        text,
  company_brief         jsonb,          -- 3 bullets
  recommended_contact_id uuid,
  recommended_contact_reason text,
  signals_last_3d       int not null default 0,
  signals_last_14d      int not null default 0,
  last_signal_at        timestamptz,
  last_scanned_at       timestamptz,
  created_at            timestamptz not null default now()
);

-- ───────────── ARJUN tables ─────────────
create table contacts (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  full_name     text not null,
  title         text,
  email         text,
  linkedin_url  text,
  is_primary    boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on contacts(account_id);

create table notes (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  body        text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on notes(account_id, created_at desc);

-- ───────────── SYSTEM tables ─────────────
create table articles (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id) on delete cascade,
  title            text not null,
  url              text not null,
  source_name      text,
  published_at     timestamptz,
  snippet          text,
  is_about_company boolean not null default true,
  is_trigger       boolean not null default false,
  ai_one_liner     text,
  fetched_via      text,
  created_at       timestamptz not null default now(),
  unique (account_id, url)
);
create index on articles(account_id, published_at desc);

create table signals (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references accounts(id) on delete cascade,
  article_id        uuid not null references articles(id) on delete cascade unique,
  signal_type       text not null references signal_types(type),
  chip              text,               -- 2–3 word label, e.g. "New CHRO"
  summary           text not null,
  evidence_snippet  text,
  confidence        numeric not null check (confidence between 0 and 1),
  relevance_reason  text,
  people_mentioned  text[] not null default '{}',
  cluster_id        uuid,
  is_cluster_lead   boolean not null default true,
  corroborations    int not null default 0,
  published_at      timestamptz,
  detected_at       timestamptz not null default now()
);
create index on signals(account_id, published_at desc);

create table outreach_drafts (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts(id) on delete cascade,
  contact_id         uuid references contacts(id) on delete set null,
  channel            draft_channel not null,
  subject            text,
  body               text not null,
  based_on_signal_id uuid references signals(id) on delete set null,
  tone               text not null default 'crisp',
  quality_flags      text[] not null default '{}',
  status             draft_status not null default 'draft',
  created_at         timestamptz not null default now()
);
create index on outreach_drafts(account_id, created_at desc);

-- activities: ARJUN, append-only reach-out history
create table activities (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  contact_id   uuid references contacts(id) on delete set null,
  channel      activity_channel not null,
  direction    activity_direction not null default 'outbound',
  subject      text,
  body_sent    text,
  outcome      activity_outcome,
  note         text,
  occurred_at  timestamptz not null default now(),
  created_via  activity_via not null default 'manual',
  draft_id     uuid references outreach_drafts(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on activities(account_id, occurred_at desc);

create table note_digests (
  account_id          uuid primary key references accounts(id) on delete cascade,
  digest              text not null,
  open_loops          text[] not null default '{}',
  suggested_next_step text,
  source_hash         text,
  generated_at        timestamptz not null default now()
);

create table scan_runs (
  id                       uuid primary key default gen_random_uuid(),
  started_at               timestamptz not null default now(),
  finished_at              timestamptz,
  trigger                  text not null default 'manual',
  status                   text not null default 'running',
  accounts_scanned         int not null default 0,
  articles_fetched         int not null default 0,
  articles_after_prefilter int not null default 0,
  articles_stored          int not null default 0,
  signals_created          int not null default 0,
  drafts_created           int not null default 0,
  gemini_calls             int not null default 0,
  tokens                   int not null default 0,
  errors                   jsonb not null default '[]',
  summary                  jsonb not null default '{}',
  arjun_hash_before        text,
  arjun_hash_after         text,
  integrity_ok             boolean
);

create table score_history (
  id           bigserial primary key,
  account_id   uuid not null references accounts(id) on delete cascade,
  scan_run_id  uuid references scan_runs(id) on delete set null,
  score        numeric not null,
  tier         warmth_tier not null,
  created_at   timestamptz not null default now()
);
create index on score_history(account_id, created_at desc);

create table email_runs (
  id           uuid primary key default gen_random_uuid(),
  sent_at      timestamptz not null default now(),
  kind         text not null default 'hotlist',
  recipient    text not null,
  subject      text,
  account_ids  uuid[] not null default '{}',
  html         text,
  status       text not null,
  provider_id  text,
  error        text
);
