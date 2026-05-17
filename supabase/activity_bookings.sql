-- Activity booking configuration and reservation details.
-- Safe to run multiple times with IF NOT EXISTS guards.

alter table if exists public.venue_games
  add column if not exists booking_mode text not null default 'none'
    check (booking_mode in ('none', 'external', 'jovial')),
  add column if not exists booking_url text,
  add column if not exists booking_enabled boolean not null default false,
  add column if not exists slot_duration_minutes integer not null default 60,
  add column if not exists booking_capacity integer not null default 1,
  add column if not exists booking_note text,
  add column if not exists price_cents integer not null default 0,
  add column if not exists currency text not null default 'EUR',
  add column if not exists payment_required boolean not null default false;

alter table if exists public.reservations
  add column if not exists contact_firstname text,
  add column if not exists contact_lastname text,
  add column if not exists contact_phone text,
  add column if not exists price_cents integer,
  add column if not exists currency text,
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists payment_status text default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded')),
  add column if not exists stripe_payment_intent_id text,
  add column if not exists auto_confirmed boolean not null default true;

do $$
begin
  if exists (select 1 from pg_type where typname = 'reservation_status') then
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on t.oid = e.enumtypid
      where t.typname = 'reservation_status' and e.enumlabel = 'cancelled_by_venue'
    ) then
      alter type reservation_status add value 'cancelled_by_venue';
    end if;
  end if;
end $$;

create index if not exists reservations_venue_start_idx
  on public.reservations (venue_id, starts_at);

create index if not exists reservations_game_start_idx
  on public.reservations (game_id, starts_at);

create table if not exists public.venue_game_blackouts (
  id bigserial primary key,
  venue_id integer not null references public.venues(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists venue_game_blackouts_range_idx
  on public.venue_game_blackouts (venue_id, game_id, starts_at, ends_at);

create table if not exists public.push_tokens (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  device text,
  created_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id);
