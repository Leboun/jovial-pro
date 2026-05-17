-- Profile feed (posts, likes, comments) for personal timelines.
-- Safe to run multiple times.

create table if not exists public.profile_posts (
  id bigserial primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text,
  entry_type text not null default 'note'
    check (entry_type in ('note', 'event', 'outing')),
  event_id bigint references public.events(id) on delete set null,
  venue_id bigint references public.venues(id) on delete set null,
  activity_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_posts_author_idx
  on public.profile_posts (author_id, created_at desc);

create index if not exists profile_posts_event_idx
  on public.profile_posts (event_id, created_at desc);

create index if not exists profile_posts_venue_idx
  on public.profile_posts (venue_id, created_at desc);

create table if not exists public.profile_post_comments (
  id bigserial primary key,
  post_id bigint not null references public.profile_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists profile_post_comments_post_idx
  on public.profile_post_comments (post_id, created_at);

create table if not exists public.profile_post_likes (
  post_id bigint not null references public.profile_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists profile_post_likes_user_idx
  on public.profile_post_likes (user_id, created_at desc);

create table if not exists public.profile_post_media (
  id bigserial primary key,
  post_id bigint not null references public.profile_posts(id) on delete cascade,
  url text not null,
  media_type text not null default 'image'
    check (media_type in ('image')),
  created_at timestamptz not null default now()
);

create index if not exists profile_post_media_post_idx
  on public.profile_post_media (post_id, created_at);

create table if not exists public.profile_post_polls (
  id bigserial primary key,
  post_id bigint not null unique references public.profile_posts(id) on delete cascade,
  question text not null check (char_length(trim(question)) > 0 and char_length(question) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.profile_post_poll_options (
  id bigserial primary key,
  poll_id bigint not null references public.profile_post_polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0 and char_length(label) <= 120),
  position smallint not null default 1 check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (poll_id, position)
);

create index if not exists profile_post_poll_options_poll_idx
  on public.profile_post_poll_options (poll_id, position, id);

create table if not exists public.profile_post_poll_votes (
  poll_id bigint not null references public.profile_post_polls(id) on delete cascade,
  option_id bigint not null references public.profile_post_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists profile_post_poll_votes_option_idx
  on public.profile_post_poll_votes (option_id, poll_id);

alter table public.profile_posts enable row level security;
alter table public.profile_post_comments enable row level security;
alter table public.profile_post_likes enable row level security;
alter table public.profile_post_media enable row level security;
alter table public.profile_post_polls enable row level security;
alter table public.profile_post_poll_options enable row level security;
alter table public.profile_post_poll_votes enable row level security;

create or replace function public.is_friend_pair(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_follows f
    where (f.follower_id = a and f.following_id = b)
       or (f.follower_id = b and f.following_id = a)
  );
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profile_posts to authenticated;
grant select, insert, delete on table public.profile_post_comments to authenticated;
grant select, insert, delete on table public.profile_post_likes to authenticated;
grant select, insert, delete on table public.profile_post_media to authenticated;
grant select, insert on table public.profile_post_polls to authenticated;
grant select, insert on table public.profile_post_poll_options to authenticated;
grant select, insert, update on table public.profile_post_poll_votes to authenticated;

drop policy if exists "profile_posts_read_authenticated" on public.profile_posts;
create policy "profile_posts_read_authenticated"
  on public.profile_posts for select
  using (auth.uid() is not null);

drop policy if exists "profile_posts_insert_own" on public.profile_posts;
create policy "profile_posts_insert_own"
  on public.profile_posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "profile_posts_update_own" on public.profile_posts;
create policy "profile_posts_update_own"
  on public.profile_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "profile_posts_delete_own" on public.profile_posts;
create policy "profile_posts_delete_own"
  on public.profile_posts for delete
  using (auth.uid() = author_id);

drop policy if exists "profile_post_comments_read_authenticated" on public.profile_post_comments;
create policy "profile_post_comments_read_authenticated"
  on public.profile_post_comments for select
  using (auth.uid() is not null);

drop policy if exists "profile_post_comments_insert_own" on public.profile_post_comments;
create policy "profile_post_comments_insert_own"
  on public.profile_post_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "profile_post_comments_delete_own" on public.profile_post_comments;
create policy "profile_post_comments_delete_own"
  on public.profile_post_comments for delete
  using (auth.uid() = author_id);

drop policy if exists "profile_post_likes_read_authenticated" on public.profile_post_likes;
create policy "profile_post_likes_read_authenticated"
  on public.profile_post_likes for select
  using (auth.uid() is not null);

drop policy if exists "profile_post_likes_insert_own" on public.profile_post_likes;
create policy "profile_post_likes_insert_own"
  on public.profile_post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "profile_post_likes_delete_own" on public.profile_post_likes;
create policy "profile_post_likes_delete_own"
  on public.profile_post_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "profile_post_media_read_authenticated" on public.profile_post_media;
create policy "profile_post_media_read_authenticated"
  on public.profile_post_media for select
  using (auth.uid() is not null);

drop policy if exists "profile_post_media_insert_own_post" on public.profile_post_media;
create policy "profile_post_media_insert_own_post"
  on public.profile_post_media for insert
  with check (
    exists (
      select 1
      from public.profile_posts p
      where p.id = profile_post_media.post_id
        and p.author_id = auth.uid()
    )
  );

drop policy if exists "profile_post_media_delete_own_post" on public.profile_post_media;
create policy "profile_post_media_delete_own_post"
  on public.profile_post_media for delete
  using (
    exists (
      select 1
      from public.profile_posts p
      where p.id = profile_post_media.post_id
        and p.author_id = auth.uid()
    )
  );

drop policy if exists "profile_post_polls_read_authenticated" on public.profile_post_polls;
create policy "profile_post_polls_read_authenticated"
  on public.profile_post_polls for select
  using (auth.uid() is not null);

drop policy if exists "profile_post_polls_insert_own_post" on public.profile_post_polls;
create policy "profile_post_polls_insert_own_post"
  on public.profile_post_polls for insert
  with check (
    exists (
      select 1
      from public.profile_posts p
      where p.id = profile_post_polls.post_id
        and p.author_id = auth.uid()
    )
  );

drop policy if exists "profile_post_poll_options_read_authenticated" on public.profile_post_poll_options;
create policy "profile_post_poll_options_read_authenticated"
  on public.profile_post_poll_options for select
  using (auth.uid() is not null);

drop policy if exists "profile_post_poll_options_insert_own_poll" on public.profile_post_poll_options;
create policy "profile_post_poll_options_insert_own_poll"
  on public.profile_post_poll_options for insert
  with check (
    exists (
      select 1
      from public.profile_post_polls pp
      join public.profile_posts p on p.id = pp.post_id
      where pp.id = profile_post_poll_options.poll_id
        and p.author_id = auth.uid()
    )
  );

drop policy if exists "profile_post_poll_votes_read_authenticated" on public.profile_post_poll_votes;
create policy "profile_post_poll_votes_read_authenticated"
  on public.profile_post_poll_votes for select
  using (auth.uid() is not null);

drop policy if exists "profile_post_poll_votes_insert_friend_or_self" on public.profile_post_poll_votes;
create policy "profile_post_poll_votes_insert_friend_or_self"
  on public.profile_post_poll_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profile_post_poll_options o
      join public.profile_post_polls pp on pp.id = o.poll_id
      join public.profile_posts p on p.id = pp.post_id
      where o.id = profile_post_poll_votes.option_id
        and pp.id = profile_post_poll_votes.poll_id
        and (
          p.author_id = auth.uid()
          or public.is_friend_pair(auth.uid(), p.author_id)
        )
    )
  );

drop policy if exists "profile_post_poll_votes_update_friend_or_self" on public.profile_post_poll_votes;
create policy "profile_post_poll_votes_update_friend_or_self"
  on public.profile_post_poll_votes for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profile_post_poll_options o
      join public.profile_post_polls pp on pp.id = o.poll_id
      join public.profile_posts p on p.id = pp.post_id
      where o.id = profile_post_poll_votes.option_id
        and pp.id = profile_post_poll_votes.poll_id
        and (
          p.author_id = auth.uid()
          or public.is_friend_pair(auth.uid(), p.author_id)
        )
    )
  );
