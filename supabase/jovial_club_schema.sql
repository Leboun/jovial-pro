-- Club Jovial — Migration partie 1/3 : schéma (tables + index).
-- Exécuter CE FICHIER seul dans un premier onglet SQL Supabase.
-- Ensuite exécuter jovial_club_rls.sql puis jovial_club_triggers.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table clubs  (une par établissement)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.clubs (
  id                      serial primary key,
  venue_id                integer not null unique references public.venues(id) on delete cascade,
  name                    text    not null,
  description             text,
  profile_photo_url       text,
  cover_photo_url         text,
  is_private              boolean not null default false,
  allow_member_posts      boolean not null default true,
  allow_member_comments   boolean not null default true,
  require_post_approval   boolean not null default false,
  member_count            integer not null default 0,
  post_count              integer not null default 0,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table club_members  (utilisateurs abonnés à un club)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.club_members (
  id        serial primary key,
  club_id   integer not null references public.clubs(id) on delete cascade,
  user_id   uuid    not null references auth.users(id)   on delete cascade,
  role      text    not null default 'member'
              check (role in ('member', 'moderator')),
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Table club_posts  (publications dans un club)
-- ─────────────────────────────────────────────────────────────────────────────
-- author_venue_id  → publication de l'établissement
-- author_user_id   → publication d'un membre
-- Exactement l'un des deux doit être renseigné (contrainte CHECK).
-- event_id         → partage optionnel d'un événement de l'établissement.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.club_posts (
  id               serial primary key,
  club_id          integer not null references public.clubs(id)   on delete cascade,
  author_venue_id  integer          references public.venues(id)  on delete set null,
  author_user_id   uuid             references auth.users(id)     on delete set null,
  content          text    not null,
  photo_urls       text[]  not null default '{}',
  event_id         integer          references public.events(id)  on delete set null,
  is_pinned        boolean not null default false,
  is_approved      boolean not null default true,
  likes_count      integer not null default 0,
  comments_count   integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint club_posts_author_check check (
    (author_venue_id is not null and author_user_id is null) or
    (author_venue_id is null    and author_user_id is not null)
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Table club_comments  (commentaires sur les publications)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.club_comments (
  id               serial primary key,
  post_id          integer not null references public.club_posts(id) on delete cascade,
  author_venue_id  integer          references public.venues(id)     on delete set null,
  author_user_id   uuid             references auth.users(id)        on delete set null,
  content          text not null,
  created_at       timestamptz not null default now(),
  constraint club_comments_author_check check (
    (author_venue_id is not null and author_user_id is null) or
    (author_venue_id is null    and author_user_id is not null)
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Table club_post_reactions  (likes sur les publications)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.club_post_reactions (
  id         serial primary key,
  post_id    integer not null references public.club_posts(id) on delete cascade,
  user_id    uuid    not null references auth.users(id)        on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Index de performance
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_clubs_venue_id           on public.clubs(venue_id);
create index if not exists idx_club_members_club_id     on public.club_members(club_id);
create index if not exists idx_club_members_user_id     on public.club_members(user_id);
create index if not exists idx_club_posts_club_id       on public.club_posts(club_id);
create index if not exists idx_club_posts_event_id      on public.club_posts(event_id);
create index if not exists idx_club_comments_post_id    on public.club_comments(post_id);
create index if not exists idx_club_reactions_post_id   on public.club_post_reactions(post_id);
create index if not exists idx_club_reactions_user_id   on public.club_post_reactions(user_id);
