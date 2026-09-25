-- LeadPilot AI — initial schema
-- Paste into Supabase SQL editor (or `supabase db push`). Idempotent where practical.
-- Every tenant table carries workspace_id and is protected by row-level security:
-- a user can only see rows of workspaces they are a member of.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────── workspaces
create table if not exists public.workspaces (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  sender_name         text not null default '',
  sender_company      text not null default '',
  sender_title        text not null default '',
  postal_address      text not null default '',        -- required in every email footer before sending
  reply_to            text not null default '',
  website             text not null default '',
  daily_send_cap      integer not null default 50 check (daily_send_cap between 1 and 500),
  dedupe_window_days  integer not null default 90 check (dedupe_window_days between 1 and 3650),
  role_emails_only    boolean not null default true,   -- only email role addresses (info@, hello@) by default
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'owner' check (role in ('owner','admin','member')),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────── product / ICP
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  name              text not null,
  description       text not null default '',
  target_customer   text not null default '',
  industry          text not null default '',
  location          text not null default '',
  company_size      text not null default '',
  customer_problem  text not null default '',
  why_buy           text not null default '',
  website_url       text not null default '',
  pricing           text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.icps (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  industries      text[] not null default '{}',
  business_types  text[] not null default '{}',
  locations       text[] not null default '{}',
  company_sizes   text[] not null default '{}',
  job_titles      text[] not null default '{}',
  pain_points     text[] not null default '{}',
  buying_signals  text[] not null default '{}',
  keywords        text[] not null default '{}',
  structured      jsonb,                    -- AI-structured ICP (see src/lib/types.ts StructuredIcp)
  structured_by   text,                     -- model id or 'demo-heuristic'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────── discovery / leads
create table if not exists public.lead_searches (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  icp_id        uuid references public.icps(id) on delete set null,
  provider      text not null,
  query         text not null,
  location      text not null default '',
  status        text not null default 'completed' check (status in ('running','completed','failed')),
  result_count  integer not null default 0,
  added_count   integer not null default 0,
  error         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  icp_id            uuid references public.icps(id) on delete set null,
  search_id         uuid references public.lead_searches(id) on delete set null,
  company_name      text not null,
  domain            text,                   -- normalised host, used for duplicate detection
  website           text,
  industry          text not null default '',
  location          text not null default '',
  description       text not null default '',
  site_excerpt      text,                   -- public website text captured during enrichment (for evidence)
  phone             text,
  email             text,                   -- only ever a publicly published address, never guessed
  email_type        text check (email_type in ('role','personal')),
  email_source_url  text,
  contact_name      text,
  contact_title     text,
  source            text not null check (source in ('google_places','csv_import','manual','website','demo')),
  source_ref        text,                   -- provider id (e.g. Google place_id)
  source_url        text,
  consent_basis     text not null default 'unknown'
                    check (consent_basis in ('conspicuous_publication','legitimate_interest','existing_relationship','consent','unknown')),
  status            text not null default 'new'
                    check (status in ('new','qualified','disqualified','draft_ready','approved','contacted','replied','meeting','skipped','do_not_contact')),
  score             integer check (score between 0 and 100),
  fit               text check (fit in ('strong','moderate','weak','none')),
  reason            text,
  enriched_at       timestamptz,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists leads_workspace_domain_uidx on public.leads (workspace_id, domain) where domain is not null;
create index if not exists leads_workspace_status_idx on public.leads (workspace_id, status);
create index if not exists leads_workspace_created_idx on public.leads (workspace_id, created_at desc);

create table if not exists public.lead_qualifications (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete cascade,
  score           integer not null check (score between 0 and 100),
  fit             text not null check (fit in ('strong','moderate','weak','none')),
  matches_icp     boolean not null,
  potential_need  text not null,
  reason          text not null,
  evidence        jsonb not null default '[]',   -- [{ claim, source }]
  unknowns        jsonb not null default '[]',   -- what we could not verify
  outreach_angle  text not null,
  model           text not null,
  created_at      timestamptz not null default now()
);
create index if not exists lead_qualifications_lead_idx on public.lead_qualifications (lead_id, created_at desc);

-- ─────────────────────────────────────────────────────────────── campaigns
create table if not exists public.campaigns (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  name                text not null,
  description         text not null default '',
  audience            text not null default '',
  product_id          uuid references public.products(id) on delete set null,
  icp_id              uuid references public.icps(id) on delete set null,
  sending_account_id  uuid,
  status              text not null default 'draft' check (status in ('draft','running','paused','completed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.campaign_leads (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  lead_id       uuid not null references public.leads(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

-- ─────────────────────────────────────────────────────────────── email
create table if not exists public.sending_accounts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  provider          text not null check (provider in ('smtp','resend','gmail','microsoft','sandbox')),
  label             text not null,
  from_email        text not null,
  from_name         text not null default '',
  config            jsonb not null default '{}',   -- non-secret settings (host, port, username…)
  secret_encrypted  text,                          -- AES-256-GCM, see src/lib/crypto.ts
  daily_limit       integer not null default 30 check (daily_limit between 1 and 500),
  per_minute_limit  integer not null default 2 check (per_minute_limit between 1 and 30),
  warmup_enabled    boolean not null default true,
  status            text not null default 'active' check (status in ('active','paused','error','needs_auth')),
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.campaigns drop constraint if exists campaigns_sending_account_fk;
alter table public.campaigns add constraint campaigns_sending_account_fk
  foreign key (sending_account_id) references public.sending_accounts(id) on delete set null;

create table if not exists public.email_drafts (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  lead_id               uuid not null references public.leads(id) on delete cascade,
  campaign_id           uuid references public.campaigns(id) on delete set null,
  qualification_id      uuid references public.lead_qualifications(id) on delete set null,
  variant               text not null check (variant in ('professional','friendly','concise')),
  subject               text not null,
  body                  text not null,
  personalization_used  jsonb not null default '[]',  -- [{ field, value, source }]
  warnings              jsonb not null default '[]',  -- compliance lint findings
  status                text not null default 'draft' check (status in ('draft','approved','skipped','sent','failed','blocked')),
  model                 text not null,
  edited                boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists email_drafts_lead_idx on public.email_drafts (lead_id, created_at desc);

create table if not exists public.email_messages (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  draft_id             uuid not null references public.email_drafts(id) on delete cascade,
  lead_id              uuid not null references public.leads(id) on delete cascade,
  campaign_id          uuid references public.campaigns(id) on delete set null,
  account_id           uuid references public.sending_accounts(id) on delete set null,
  to_email             text not null,
  to_domain            text not null,
  subject              text not null,
  body_text            text not null,
  status               text not null default 'queued' check (status in ('queued','sending','sent','failed','blocked')),
  attempts             integer not null default 0,
  next_attempt_at      timestamptz not null default now(),
  provider_message_id  text,
  error                text,
  sent_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (draft_id)                               -- a draft can only ever be sent once
);
create index if not exists email_messages_due_idx on public.email_messages (status, next_attempt_at);
create index if not exists email_messages_account_sent_idx on public.email_messages (account_id, sent_at);
create index if not exists email_messages_to_idx on public.email_messages (workspace_id, to_email);
create index if not exists email_messages_provider_idx on public.email_messages (provider_message_id);

create table if not exists public.email_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  message_id    uuid references public.email_messages(id) on delete set null,
  lead_id       uuid references public.leads(id) on delete cascade,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  type          text not null check (type in ('delivered','bounced','complained','replied','positive_reply','meeting_booked','unsubscribed')),
  detail        text,
  created_at    timestamptz not null default now()
);
create index if not exists email_events_workspace_idx on public.email_events (workspace_id, type, created_at desc);

create table if not exists public.suppressions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  value         text not null,                      -- lowercased email or domain
  kind          text not null check (kind in ('email','domain')),
  reason        text not null check (reason in ('unsubscribed','bounced','complained','manual','do_not_contact')),
  source        text not null default 'manual',
  created_at    timestamptz not null default now(),
  unique (workspace_id, value)
);

-- ─────────────────────────────────────────────────────────────── audit
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  actor_id      uuid,
  actor_label   text not null,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  lead_id       uuid,
  summary       text not null,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_workspace_idx on public.audit_log (workspace_id, created_at desc);
create index if not exists audit_log_lead_idx on public.audit_log (lead_id, created_at desc);

-- ─────────────────────────────────────────────────────────────── RLS
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;

drop policy if exists workspaces_member_select on public.workspaces;
create policy workspaces_member_select on public.workspaces for select using (public.is_workspace_member(id));
drop policy if exists workspaces_member_update on public.workspaces;
create policy workspaces_member_update on public.workspaces for update using (public.is_workspace_member(id));

drop policy if exists members_self_select on public.workspace_members;
create policy members_self_select on public.workspace_members for select using (public.is_workspace_member(workspace_id));

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['products','icps','lead_searches','leads','lead_qualifications','campaigns','campaign_leads',
                           'sending_accounts','email_drafts','email_messages','email_events','suppressions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_member_all', t);
    execute format('create policy %I on public.%I for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
                   t || '_member_all', t);
  end loop;
end $$;

-- Audit log is append-only for members: insert + select, never update/delete.
alter table public.audit_log enable row level security;
drop policy if exists audit_member_select on public.audit_log;
create policy audit_member_select on public.audit_log for select using (public.is_workspace_member(workspace_id));
drop policy if exists audit_member_insert on public.audit_log;
create policy audit_member_insert on public.audit_log for insert with check (public.is_workspace_member(workspace_id));

-- Suppressions can be added by members but never removed through the API (admin removes via SQL with a reason).
drop policy if exists suppressions_member_all on public.suppressions;
drop policy if exists suppressions_member_select on public.suppressions;
create policy suppressions_member_select on public.suppressions for select using (public.is_workspace_member(workspace_id));
drop policy if exists suppressions_member_insert on public.suppressions;
create policy suppressions_member_insert on public.suppressions for insert with check (public.is_workspace_member(workspace_id));

-- ─────────────────────────────────────────────────────────────── bootstrap
-- Called once after sign-up: creates a workspace owned by the caller if they have none.
create or replace function public.bootstrap_workspace(ws_name text, full_name text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select workspace_id into ws from public.workspace_members where user_id = auth.uid() limit 1;
  if ws is not null then return ws; end if;
  insert into public.workspaces (name, sender_name, created_by)
    values (coalesce(nullif(ws_name, ''), 'My workspace'), coalesce(full_name, ''), auth.uid())
    returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  insert into public.profiles (id, full_name) values (auth.uid(), coalesce(full_name, ''))
    on conflict (id) do nothing;
  return ws;
end $$;
revoke all on function public.bootstrap_workspace(text, text) from public;
grant execute on function public.bootstrap_workspace(text, text) to authenticated;

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['workspaces','products','icps','leads','campaigns','sending_accounts','email_drafts','email_messages']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
