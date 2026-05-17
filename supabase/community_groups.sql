-- Community groups (clubs) with posts, media, likes, comments, tags, and notifications.
-- Safe to run multiple times with IF NOT EXISTS guards.

create table if not exists public.community_groups (
  id bigserial primary key,
  name text not null,
  description text,
  visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  created_by uuid references auth.users(id) on delete set null,
  cover_image_url text,
  avatar_image_url text,
  location_place_id text,
  location_lat double precision,
  location_lng double precision,
  post_permission text not null default 'members'
    check (post_permission in ('members', 'admins')),
  charter_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_groups
  add column if not exists location_place_id text;
alter table public.community_groups
  add column if not exists location_lat double precision;
alter table public.community_groups
  add column if not exists location_lng double precision;
alter table public.community_groups
  add column if not exists post_permission text;

create index if not exists community_groups_visibility_idx
  on public.community_groups (visibility);

create table if not exists public.community_group_game_tags (
  group_id bigint not null references public.community_groups(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete restrict,
  rank smallint not null check (rank in (1, 2, 3)),
  created_at timestamptz not null default now(),
  primary key (group_id, game_id),
  unique (group_id, rank)
);

create index if not exists community_group_game_tags_game_idx
  on public.community_group_game_tags (game_id, group_id);

create table if not exists public.community_group_topics (
  id bigserial primary key,
  category text not null,
  label text not null,
  slug text not null unique,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists community_group_topics_category_idx
  on public.community_group_topics (category, sort_order, label);

create table if not exists public.community_group_topic_tags (
  group_id bigint not null references public.community_groups(id) on delete cascade,
  topic_id bigint not null references public.community_group_topics(id) on delete restrict,
  rank smallint not null check (rank in (1, 2, 3)),
  created_at timestamptz not null default now(),
  primary key (group_id, topic_id),
  unique (group_id, rank)
);

create index if not exists community_group_topic_tags_topic_idx
  on public.community_group_topic_tags (topic_id, group_id);

create table if not exists public.community_group_event_categories (
  group_id bigint not null references public.community_groups(id) on delete cascade,
  category_id bigint not null references public.event_categories(id) on delete restrict,
  rank smallint not null check (rank in (1, 2, 3)),
  created_at timestamptz not null default now(),
  primary key (group_id, category_id),
  unique (group_id, rank)
);

create index if not exists community_group_event_categories_category_idx
  on public.community_group_event_categories (category_id, group_id);

create table if not exists public.community_group_members (
  group_id bigint not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('member', 'admin', 'founder')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'banned')),
  joined_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  primary key (group_id, user_id)
);

create index if not exists community_group_members_user_idx
  on public.community_group_members (user_id, status);

create table if not exists public.community_group_posts (
  id bigserial primary key,
  group_id bigint not null references public.community_groups(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text,
  is_pinned boolean not null default false,
  is_important boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_group_posts_group_idx
  on public.community_group_posts (group_id, created_at desc);

create table if not exists public.community_group_post_media (
  id bigserial primary key,
  post_id bigint not null references public.community_group_posts(id) on delete cascade,
  url text not null,
  media_type text not null
    check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index if not exists community_group_post_media_post_idx
  on public.community_group_post_media (post_id);

create table if not exists public.community_group_post_comments (
  id bigserial primary key,
  post_id bigint not null references public.community_group_posts(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_group_post_comments_post_idx
  on public.community_group_post_comments (post_id, created_at);

create table if not exists public.community_group_post_likes (
  post_id bigint not null references public.community_group_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists community_group_post_likes_user_idx
  on public.community_group_post_likes (user_id, created_at);

create table if not exists public.community_group_post_polls (
  id bigserial primary key,
  post_id bigint not null unique references public.community_group_posts(id) on delete cascade,
  question text not null check (char_length(trim(question)) > 0 and char_length(question) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.community_group_post_poll_options (
  id bigserial primary key,
  poll_id bigint not null references public.community_group_post_polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0 and char_length(label) <= 120),
  position smallint not null default 1 check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (poll_id, position)
);

create index if not exists community_group_post_poll_options_poll_idx
  on public.community_group_post_poll_options (poll_id, position, id);

create table if not exists public.community_group_post_poll_votes (
  poll_id bigint not null references public.community_group_post_polls(id) on delete cascade,
  option_id bigint not null references public.community_group_post_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists community_group_post_poll_votes_option_idx
  on public.community_group_post_poll_votes (option_id, poll_id);

create table if not exists public.community_group_invite_links (
  id bigserial primary key,
  group_id bigint not null references public.community_groups(id) on delete cascade,
  token text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text
);

create index if not exists community_group_invite_links_group_idx
  on public.community_group_invite_links (group_id, created_at desc);

create table if not exists public.community_group_notification_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id bigint not null references public.community_groups(id) on delete cascade,
  level text not null default 'all'
    check (level in ('all', 'important', 'none')),
  notify_mentions boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create table if not exists public.user_group_notification_defaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  default_level text not null default 'all'
    check (default_level in ('all', 'important', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_group_charter_acceptance (
  group_id bigint not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_version integer not null,
  accepted_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists community_group_charter_acceptance_group_idx
  on public.community_group_charter_acceptance (group_id, accepted_at desc);

create table if not exists public.community_group_reports (
  id bigserial primary key,
  group_id bigint not null references public.community_groups(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  post_id bigint references public.community_group_posts(id) on delete set null,
  comment_id bigint references public.community_group_post_comments(id) on delete set null,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists community_group_reports_group_idx
  on public.community_group_reports (group_id, status, created_at desc);

create table if not exists public.community_group_sanctions (
  id bigserial primary key,
  group_id bigint not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  imposed_by uuid references auth.users(id) on delete set null,
  sanction_type text not null
    check (sanction_type in ('warning', 'suspension', 'ban')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists community_group_sanctions_user_idx
  on public.community_group_sanctions (user_id, group_id, starts_at desc);

create table if not exists public.community_group_audit_logs (
  id bigserial primary key,
  group_id bigint not null references public.community_groups(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists community_group_audit_logs_group_idx
  on public.community_group_audit_logs (group_id, created_at desc);

-- RLS
alter table public.community_groups enable row level security;
alter table public.community_group_game_tags enable row level security;
alter table public.community_group_topics enable row level security;
alter table public.community_group_topic_tags enable row level security;
alter table public.community_group_event_categories enable row level security;
alter table public.community_group_members enable row level security;
alter table public.community_group_posts enable row level security;
alter table public.community_group_post_media enable row level security;
alter table public.community_group_post_comments enable row level security;
alter table public.community_group_post_likes enable row level security;
alter table public.community_group_post_polls enable row level security;
alter table public.community_group_post_poll_options enable row level security;
alter table public.community_group_post_poll_votes enable row level security;
alter table public.community_group_invite_links enable row level security;
alter table public.community_group_notification_settings enable row level security;
alter table public.user_group_notification_defaults enable row level security;
alter table public.community_group_charter_acceptance enable row level security;
alter table public.community_group_reports enable row level security;
alter table public.community_group_sanctions enable row level security;
alter table public.community_group_audit_logs enable row level security;

grant select, insert on table public.community_group_post_polls to authenticated;
grant select, insert on table public.community_group_post_poll_options to authenticated;
grant select, insert, update on table public.community_group_post_poll_votes to authenticated;

-- Helper functions to avoid recursive RLS checks
create or replace function public.is_group_member(gid bigint, uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_group_members m
    where m.group_id = gid
      and m.user_id = uid
      and m.status = 'approved'
  );
$$;

create or replace function public.is_group_admin(gid bigint, uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_group_members m
    where m.group_id = gid
      and m.user_id = uid
      and m.status = 'approved'
      and m.role in ('admin', 'founder')
  );
$$;

create or replace function public.is_group_public(gid bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_groups g
    where g.id = gid
      and g.visibility = 'public'
  );
$$;

-- Groups: public readable; members/admins manage their own groups
drop policy if exists "community_groups_public_read" on public.community_groups;
create policy "community_groups_public_read"
  on public.community_groups for select
  using (
    visibility = 'public'
    or created_by = auth.uid()
    or public.is_group_member(community_groups.id, auth.uid())
  );

drop policy if exists "community_groups_owner_write" on public.community_groups;
create policy "community_groups_owner_write"
  on public.community_groups for insert
  with check (created_by = auth.uid());

drop policy if exists "community_groups_admin_update" on public.community_groups;
create policy "community_groups_admin_update"
  on public.community_groups for update
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_groups.id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_groups.id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

drop policy if exists "community_groups_admin_delete" on public.community_groups;
create policy "community_groups_admin_delete"
  on public.community_groups for delete
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_groups.id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Group tags: readable when group is visible to user
drop policy if exists "community_group_game_tags_read" on public.community_group_game_tags;
create policy "community_group_game_tags_read"
  on public.community_group_game_tags for select
  using (
    exists (
      select 1 from public.community_groups g
      where g.id = community_group_game_tags.group_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_topics_read" on public.community_group_topics;
create policy "community_group_topics_read"
  on public.community_group_topics for select
  using (is_active = true);

drop policy if exists "community_group_topic_tags_read" on public.community_group_topic_tags;
create policy "community_group_topic_tags_read"
  on public.community_group_topic_tags for select
  using (
    exists (
      select 1 from public.community_groups g
      where g.id = community_group_topic_tags.group_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_event_categories_read" on public.community_group_event_categories;
create policy "community_group_event_categories_read"
  on public.community_group_event_categories for select
  using (
    exists (
      select 1 from public.community_groups g
      where g.id = community_group_event_categories.group_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_tags_write" on public.community_group_game_tags;
create policy "community_group_tags_write"
  on public.community_group_game_tags for insert
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_game_tags.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_tags_update" on public.community_group_game_tags;
create policy "community_group_tags_update"
  on public.community_group_game_tags for update
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_game_tags.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_game_tags.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_topic_tags_write" on public.community_group_topic_tags;
create policy "community_group_topic_tags_write"
  on public.community_group_topic_tags for insert
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_topic_tags.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_topic_tags_update" on public.community_group_topic_tags;
create policy "community_group_topic_tags_update"
  on public.community_group_topic_tags for update
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_topic_tags.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_topic_tags.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_event_tags_write" on public.community_group_event_categories;
create policy "community_group_event_tags_write"
  on public.community_group_event_categories for insert
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_event_categories.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Members: users can see their own membership; admins can manage
drop policy if exists "community_group_members_read_self" on public.community_group_members;
create policy "community_group_members_read_self"
  on public.community_group_members for select
  using (user_id = auth.uid());

drop policy if exists "community_group_members_read_public" on public.community_group_members;
create policy "community_group_members_read_public"
  on public.community_group_members for select
  using (public.is_group_public(community_group_members.group_id));

drop policy if exists "community_group_members_read_admin" on public.community_group_members;
create policy "community_group_members_read_admin"
  on public.community_group_members for select
  using (public.is_group_admin(community_group_members.group_id, auth.uid()));

drop policy if exists "community_group_members_join" on public.community_group_members;
create policy "community_group_members_join"
  on public.community_group_members for insert
  with check (
    user_id = auth.uid()
    and (
      status = 'pending'
      or (
        status = 'approved'
        and role = 'founder'
        and exists (
          select 1 from public.community_groups g
          where g.id = community_group_members.group_id
            and g.created_by = auth.uid()
        )
      )
    )
  );

drop policy if exists "community_group_members_admin_update" on public.community_group_members;
create policy "community_group_members_admin_update"
  on public.community_group_members for update
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_members.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_members.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Posts: public read if group public; write if approved member
drop policy if exists "community_group_posts_read" on public.community_group_posts;
create policy "community_group_posts_read"
  on public.community_group_posts for select
  using (
    exists (
      select 1 from public.community_groups g
      where g.id = community_group_posts.group_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_posts_write" on public.community_group_posts;
create policy "community_group_posts_write"
  on public.community_group_posts for insert
  with check (
    exists (
      select 1 from public.community_groups g
      where g.id = community_group_posts.group_id
        and (
          (g.post_permission = 'members' and exists (
            select 1 from public.community_group_members m
            where m.group_id = g.id
              and m.user_id = auth.uid()
              and m.status = 'approved'
          ))
          or (g.post_permission = 'admins' and public.is_group_admin(g.id, auth.uid()))
        )
    )
  );

drop policy if exists "community_group_posts_update_owner_or_admin" on public.community_group_posts;
create policy "community_group_posts_update_owner_or_admin"
  on public.community_group_posts for update
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_posts.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    author_id = auth.uid()
    or exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_posts.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Post media/comments/likes: follow post visibility + member rules
drop policy if exists "community_group_post_media_read" on public.community_group_post_media;
create policy "community_group_post_media_read"
  on public.community_group_post_media for select
  using (
    exists (
      select 1 from public.community_group_posts p
      join public.community_groups g on g.id = p.group_id
      where p.id = community_group_post_media.post_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_post_media_write" on public.community_group_post_media;
create policy "community_group_post_media_write"
  on public.community_group_post_media for insert
  with check (
    exists (
      select 1 from public.community_group_posts p
      join public.community_group_members m on m.group_id = p.group_id
      where p.id = community_group_post_media.post_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_post_comments_read" on public.community_group_post_comments;
create policy "community_group_post_comments_read"
  on public.community_group_post_comments for select
  using (
    exists (
      select 1 from public.community_group_posts p
      join public.community_groups g on g.id = p.group_id
      where p.id = community_group_post_comments.post_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_post_comments_write" on public.community_group_post_comments;
create policy "community_group_post_comments_write"
  on public.community_group_post_comments for insert
  with check (
    exists (
      select 1 from public.community_group_posts p
      join public.community_group_members m on m.group_id = p.group_id
      where p.id = community_group_post_comments.post_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_post_likes_read" on public.community_group_post_likes;
create policy "community_group_post_likes_read"
  on public.community_group_post_likes for select
  using (
    exists (
      select 1 from public.community_group_posts p
      join public.community_groups g on g.id = p.group_id
      where p.id = community_group_post_likes.post_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_post_likes_write" on public.community_group_post_likes;
create policy "community_group_post_likes_write"
  on public.community_group_post_likes for insert
  with check (
    exists (
      select 1 from public.community_group_posts p
      join public.community_group_members m on m.group_id = p.group_id
      where p.id = community_group_post_likes.post_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_post_polls_read" on public.community_group_post_polls;
create policy "community_group_post_polls_read"
  on public.community_group_post_polls for select
  using (
    exists (
      select 1 from public.community_group_posts p
      join public.community_groups g on g.id = p.group_id
      where p.id = community_group_post_polls.post_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_post_polls_write" on public.community_group_post_polls;
create policy "community_group_post_polls_write"
  on public.community_group_post_polls for insert
  with check (
    exists (
      select 1 from public.community_group_posts p
      join public.community_group_members m on m.group_id = p.group_id
      where p.id = community_group_post_polls.post_id
        and p.author_id = auth.uid()
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_post_poll_options_read" on public.community_group_post_poll_options;
create policy "community_group_post_poll_options_read"
  on public.community_group_post_poll_options for select
  using (
    exists (
      select 1 from public.community_group_post_polls pp
      join public.community_group_posts p on p.id = pp.post_id
      join public.community_groups g on g.id = p.group_id
      where pp.id = community_group_post_poll_options.poll_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_post_poll_options_write" on public.community_group_post_poll_options;
create policy "community_group_post_poll_options_write"
  on public.community_group_post_poll_options for insert
  with check (
    exists (
      select 1 from public.community_group_post_polls pp
      join public.community_group_posts p on p.id = pp.post_id
      join public.community_group_members m on m.group_id = p.group_id
      where pp.id = community_group_post_poll_options.poll_id
        and p.author_id = auth.uid()
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_post_poll_votes_read" on public.community_group_post_poll_votes;
create policy "community_group_post_poll_votes_read"
  on public.community_group_post_poll_votes for select
  using (
    exists (
      select 1 from public.community_group_post_polls pp
      join public.community_group_posts p on p.id = pp.post_id
      join public.community_groups g on g.id = p.group_id
      where pp.id = community_group_post_poll_votes.poll_id
        and (g.visibility = 'public' or exists (
          select 1 from public.community_group_members m
          where m.group_id = g.id
            and m.user_id = auth.uid()
            and m.status = 'approved'
        ))
    )
  );

drop policy if exists "community_group_post_poll_votes_write" on public.community_group_post_poll_votes;
create policy "community_group_post_poll_votes_write"
  on public.community_group_post_poll_votes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_group_post_polls pp
      join public.community_group_posts p on p.id = pp.post_id
      join public.community_group_members m on m.group_id = p.group_id
      where pp.id = community_group_post_poll_votes.poll_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
    and exists (
      select 1
      from public.community_group_post_poll_options o
      where o.id = community_group_post_poll_votes.option_id
        and o.poll_id = community_group_post_poll_votes.poll_id
    )
  );

drop policy if exists "community_group_post_poll_votes_update" on public.community_group_post_poll_votes;
create policy "community_group_post_poll_votes_update"
  on public.community_group_post_poll_votes for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_group_post_polls pp
      join public.community_group_posts p on p.id = pp.post_id
      join public.community_group_members m on m.group_id = p.group_id
      where pp.id = community_group_post_poll_votes.poll_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
    and exists (
      select 1
      from public.community_group_post_poll_options o
      where o.id = community_group_post_poll_votes.option_id
        and o.poll_id = community_group_post_poll_votes.poll_id
    )
  );

-- Invite links: admins manage; everyone can resolve token to group if public
drop policy if exists "community_group_invite_links_read" on public.community_group_invite_links;
create policy "community_group_invite_links_read"
  on public.community_group_invite_links for select
  using (
    exists (
      select 1 from public.community_groups g
      where g.id = community_group_invite_links.group_id
        and g.visibility = 'public'
    )
    or exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_invite_links.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_invite_links_write" on public.community_group_invite_links;
create policy "community_group_invite_links_write"
  on public.community_group_invite_links for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_invite_links.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Notification settings: owner-only
drop policy if exists "community_group_notification_settings_owner" on public.community_group_notification_settings;
create policy "community_group_notification_settings_owner"
  on public.community_group_notification_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_group_notification_defaults_owner" on public.user_group_notification_defaults;
create policy "user_group_notification_defaults_owner"
  on public.user_group_notification_defaults for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Charter acceptance: owner-only
drop policy if exists "community_group_charter_acceptance_owner" on public.community_group_charter_acceptance;
create policy "community_group_charter_acceptance_owner"
  on public.community_group_charter_acceptance for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Reports: members can create; admins can read/manage
drop policy if exists "community_group_reports_insert" on public.community_group_reports;
create policy "community_group_reports_insert"
  on public.community_group_reports for insert
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_reports.group_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_reports_read" on public.community_group_reports;
create policy "community_group_reports_read"
  on public.community_group_reports for select
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_reports.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

drop policy if exists "community_group_reports_update" on public.community_group_reports;
create policy "community_group_reports_update"
  on public.community_group_reports for update
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_reports.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_reports.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Sanctions: admins only
drop policy if exists "community_group_sanctions_manage" on public.community_group_sanctions;
create policy "community_group_sanctions_manage"
  on public.community_group_sanctions for all
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_sanctions.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_sanctions.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Audit logs: admins only
drop policy if exists "community_group_audit_logs_manage" on public.community_group_audit_logs;
create policy "community_group_audit_logs_manage"
  on public.community_group_audit_logs for all
  using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_audit_logs.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_audit_logs.group_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'founder')
        and m.status = 'approved'
    )
  );

-- Storage buckets (safe to run multiple times)
insert into storage.buckets (id, name, public)
values ('group-media', 'group-media', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Storage policies (adjust if you want stricter access)
drop policy if exists "group_media_read" on storage.objects;
create policy "group_media_read"
  on storage.objects for select
  using (bucket_id = 'group-media');

drop policy if exists "group_media_write" on storage.objects;
create policy "group_media_write"
  on storage.objects for insert
  with check (bucket_id = 'group-media' and auth.uid() is not null);

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_write" on storage.objects;
create policy "avatars_write"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);
