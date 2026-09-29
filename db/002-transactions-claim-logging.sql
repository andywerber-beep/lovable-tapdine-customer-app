-- TapDine: extend transactions so every paid claim is logged (no personal data).
-- Safe to run more than once. Does not delete or change existing rows.

-- venue_id stores the numeric venue ID from the partners table (partner_id in
-- this table is a UUID type, so it cannot hold numeric venue IDs).
alter table public.transactions
  add column if not exists venue_id           bigint,
  add column if not exists offer_id          text,
  add column if not exists offer_title       text,
  add column if not exists claim_code        text,
  add column if not exists amount            numeric(10,2),
  add column if not exists currency          text not null default 'gbp',
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text,
  add column if not exists paid_at           timestamptz,
  add column if not exists redeemed          boolean not null default false,
  add column if not exists redeemed_at       timestamptz;

create unique index if not exists transactions_claim_code_key on public.transactions (claim_code);
create unique index if not exists transactions_stripe_session_key on public.transactions (stripe_session_id);
create index if not exists transactions_venue_idx on public.transactions (venue_id, created_at desc);
create index if not exists transactions_partner_idx on public.transactions (partner_id, created_at desc);

-- partner_id was built for a UUID-based venue reference; the app now logs
-- claims by numeric venue_id, so partner_id becomes optional.
alter table public.transactions alter column partner_id drop not null;

-- Only trusted server code (service role) writes claims; customers cannot insert fake rows.
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
