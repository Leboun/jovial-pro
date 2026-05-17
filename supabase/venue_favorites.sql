-- User favorites for venues.
-- Safe to run multiple times.

create table if not exists public.venue_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id integer not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create index if not exists venue_favorites_user_created_idx
  on public.venue_favorites (user_id, created_at desc);

create index if not exists venue_favorites_venue_idx
  on public.venue_favorites (venue_id);

alter table public.venue_favorites enable row level security;

grant select, insert, delete on table public.venue_favorites to authenticated;

drop policy if exists "venue_favorites_read_own" on public.venue_favorites;
create policy "venue_favorites_read_own"
  on public.venue_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "venue_favorites_insert_own" on public.venue_favorites;
create policy "venue_favorites_insert_own"
  on public.venue_favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "venue_favorites_delete_own" on public.venue_favorites;
create policy "venue_favorites_delete_own"
  on public.venue_favorites for delete
  using (auth.uid() = user_id);
