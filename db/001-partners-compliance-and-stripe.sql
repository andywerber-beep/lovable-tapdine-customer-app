-- TapDine — schema additions agreed 2026-08-25
-- Run this against the TapDine Supabase project (SQL Editor).
-- Adds: Stripe Connect fields, FSA hygiene rating cache, auth ownership, roles.

-- ---------------------------------------------------------------
-- 1. Stripe Connect on partners
-- ---------------------------------------------------------------
alter table public.partners
  add column if not exists stripe_account_id      text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_onboarded_at    timestamptz;

comment on column public.partners.stripe_account_id is
  'Stripe Connect account. Onboarding verifies legal entity + bank, replacing manual ID checks.';

-- id_provided is now redundant (Stripe Connect covers identity verification).
comment on column public.partners.id_provided is
  'DEPRECATED - identity is verified by Stripe Connect onboarding.';

-- ---------------------------------------------------------------
-- 2. FSA hygiene rating (fetched from api.ratings.food.gov.uk)
--    Held as text so it can carry both the 0-5 England/Wales/NI
--    scale and Scotland's Pass / Improvement Required scheme.
-- ---------------------------------------------------------------
alter table public.partners
  add column if not exists fsa_business_id     text,
  add column if not exists fsa_rating          text,
  add column if not exists fsa_rating_scheme   text,
  add column if not exists fsa_rating_date     date,
  add column if not exists fsa_checked_at      timestamptz;

comment on column public.partners.fsa_rating is
  'Raw FSA rating value: "0".."5" (FHRS) or "Pass"/"Improvement Required" (FHIS).';

-- Single source of truth for the >= 3 (or Pass) eligibility gate.
create or replace function public.fsa_rating_passes(_rating text)
returns boolean
language sql
immutable
as $$
  select case
    when _rating is null then false
    when _rating ~ '^[0-5]$' then _rating::int >= 3
    when lower(trim(_rating)) = 'pass' then true
    else false
  end
$$;

-- ---------------------------------------------------------------
-- 3. Public liability insurance (the one manual admin job)
-- ---------------------------------------------------------------
alter table public.partners
  add column if not exists insurance_doc_path   text,
  add column if not exists insurance_verified_at timestamptz,
  add column if not exists insurance_verified_by uuid references auth.users(id);

comment on column public.partners.insurance_doc_path is
  'Storage path of the certificate the partner uploaded, for admin review.';

-- ---------------------------------------------------------------
-- 4. Ownership: link partner rows to login accounts
--    partners.id is int8, so owner_id is a separate uuid column.
-- ---------------------------------------------------------------
alter table public.partners
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists partners_owner_id_idx on public.partners (owner_id);

-- ---------------------------------------------------------------
-- 5. Roles (admin vs partner) — never stored on the profile row
-- ---------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'partner');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all    on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

do $$ begin
  create policy "Users read own roles"
    on public.user_roles for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------
-- 6. What the customer app is allowed to see
--    Live = active + Stripe able to charge + FSA gate passed.
-- ---------------------------------------------------------------
create or replace view public.live_partners as
  select *
  from public.partners
  where lower(coalesce(status, '')) = 'active'
    and stripe_charges_enabled
    and public.fsa_rating_passes(fsa_rating);
