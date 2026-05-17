-- User follows (friends) relation.
-- Safe to run multiple times.

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self check (follower_id <> following_id)
);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id, created_at desc);

create index if not exists user_follows_follower_idx
  on public.user_follows (follower_id, created_at desc);

alter table public.user_follows enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.user_follows to authenticated;

drop policy if exists "user_follows_read_own" on public.user_follows;
create policy "user_follows_read_own"
  on public.user_follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own"
  on public.user_follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own"
  on public.user_follows for delete
  using (auth.uid() = follower_id);
