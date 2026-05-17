-- Club Jovial — Correctif RLS : boucle infinie inter-tables.
-- Problème : clubs_select → club_members → club_members_select → clubs → boucle.
-- Solution : fonctions security definer qui contournent le RLS pour briser la chaîne.
-- Exécuter CE FICHIER dans un nouvel onglet SQL Supabase (remplace les politiques existantes).

-- ─────────────────────────────────────────────────────────────────────────────
-- Fonctions helper security definer (contournent le RLS — pas de boucle)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vérifie si l'utilisateur connecté est propriétaire du club (via le venue).
create or replace function public.is_club_owner(p_club_id integer)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.clubs c
    join public.venues v on v.id = c.venue_id
    where c.id = p_club_id
      and v.owner_user_id = auth.uid()
  );
$$;

-- Vérifie si l'utilisateur connecté est membre du club.
create or replace function public.is_club_member(p_club_id integer)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = auth.uid()
  );
$$;

-- Vérifie si le club est public.
create or replace function public.is_club_public(p_club_id integer)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.clubs c
    where c.id = p_club_id
      and c.is_private = false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Remplacement des politiques clubs
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "clubs_select" on public.clubs;
create policy "clubs_select" on public.clubs for select using (
  is_private = false
  or public.auth_user_owns_venue(venue_id)
  or public.is_club_member(id)         -- security definer : pas de boucle
);

drop policy if exists "clubs_insert" on public.clubs;
create policy "clubs_insert" on public.clubs for insert with check (
  public.auth_user_owns_venue(venue_id)
  and public.venue_has_club_jovial_access(venue_id)
);

drop policy if exists "clubs_update" on public.clubs;
create policy "clubs_update" on public.clubs for update using (
  public.auth_user_owns_venue(venue_id)
);

drop policy if exists "clubs_delete" on public.clubs;
create policy "clubs_delete" on public.clubs for delete using (
  public.auth_user_owns_venue(venue_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Remplacement des politiques club_members
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "club_members_select" on public.club_members;
create policy "club_members_select" on public.club_members for select using (
  user_id = auth.uid()
  or public.is_club_owner(club_id)     -- security definer : pas de boucle
);

drop policy if exists "club_members_insert" on public.club_members;
create policy "club_members_insert" on public.club_members for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.clubs c
    where c.id = club_id and c.is_active = true
  )
);

drop policy if exists "club_members_delete" on public.club_members;
create policy "club_members_delete" on public.club_members for delete using (
  user_id = auth.uid()
  or public.is_club_owner(club_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Remplacement des politiques club_posts
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "club_posts_select" on public.club_posts;
create policy "club_posts_select" on public.club_posts for select using (
  is_approved = true
  and (
    public.is_club_public(club_id)
    or public.is_club_owner(club_id)
    or public.is_club_member(club_id)
  )
);

drop policy if exists "club_posts_select_pending" on public.club_posts;
create policy "club_posts_select_pending" on public.club_posts for select using (
  is_approved = false
  and public.is_club_owner(club_id)
);

drop policy if exists "club_posts_insert_establishment" on public.club_posts;
create policy "club_posts_insert_establishment" on public.club_posts for insert with check (
  author_venue_id is not null
  and author_user_id is null
  and public.auth_user_owns_venue(author_venue_id)
  and exists (
    select 1 from public.clubs c
    where c.id = club_id and c.venue_id = author_venue_id
  )
);

drop policy if exists "club_posts_insert_member" on public.club_posts;
create policy "club_posts_insert_member" on public.club_posts for insert with check (
  author_user_id = auth.uid()
  and author_venue_id is null
  and public.is_club_member(club_id)
  and exists (
    select 1 from public.clubs c
    where c.id = club_id and c.allow_member_posts = true
  )
);

drop policy if exists "club_posts_update" on public.club_posts;
create policy "club_posts_update" on public.club_posts for update using (
  author_user_id = auth.uid()
  or public.is_club_owner(club_id)
);

drop policy if exists "club_posts_delete" on public.club_posts;
create policy "club_posts_delete" on public.club_posts for delete using (
  author_user_id = auth.uid()
  or public.is_club_owner(club_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Remplacement des politiques club_comments
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "club_comments_select" on public.club_comments;
create policy "club_comments_select" on public.club_comments for select using (
  exists (
    select 1 from public.club_posts p
    where p.id = post_id
      and p.is_approved = true
      and (
        public.is_club_public(p.club_id)
        or public.is_club_owner(p.club_id)
        or public.is_club_member(p.club_id)
      )
  )
);

drop policy if exists "club_comments_insert_establishment" on public.club_comments;
create policy "club_comments_insert_establishment" on public.club_comments for insert with check (
  author_venue_id is not null
  and author_user_id is null
  and public.auth_user_owns_venue(author_venue_id)
);

drop policy if exists "club_comments_insert_member" on public.club_comments;
create policy "club_comments_insert_member" on public.club_comments for insert with check (
  author_user_id = auth.uid()
  and author_venue_id is null
  and exists (
    select 1 from public.club_posts p
    join public.clubs c on c.id = p.club_id
    where p.id = post_id
      and public.is_club_member(c.id)
      and c.allow_member_comments = true
  )
);

drop policy if exists "club_comments_delete" on public.club_comments;
create policy "club_comments_delete" on public.club_comments for delete using (
  author_user_id = auth.uid()
  or exists (
    select 1 from public.club_posts p
    where p.id = post_id
      and public.is_club_owner(p.club_id)
  )
);
