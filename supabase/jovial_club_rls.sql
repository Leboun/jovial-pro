-- Club Jovial — Migration partie 2/3 : fonctions de sécurité + RLS.
-- Exécuter APRÈS jovial_club_schema.sql (même onglet ou onglet séparé).
-- Ce fichier ne contient que du SQL pur (pas de PL/pgSQL).

-- ─────────────────────────────────────────────────────────────────────────────
-- Fonctions helper (language sql — pas de PL/pgSQL, pas de risque de parsing)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vérifie que l'utilisateur connecté est propriétaire d'un venue.
create or replace function public.auth_user_owns_venue(p_venue_id integer)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = p_venue_id
      and v.owner_user_id = auth.uid()
  );
$$;

-- Vérifie que le venue a un abonnement actif Rayonnement ou Pro.
-- C'est LE verrou central : aucun contournement possible via un compte
-- utilisateur freemium/premium ou une offre Visibilité.
create or replace function public.venue_has_club_jovial_access(p_venue_id integer)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.establishment_subscriptions es
    where es.venue_id = p_venue_id
      and es.status   = 'active'
      and es.plan     in ('premium', 'pro')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Activation RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.clubs               enable row level security;
alter table public.club_members        enable row level security;
alter table public.club_posts          enable row level security;
alter table public.club_comments       enable row level security;
alter table public.club_post_reactions enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Politiques RLS : clubs
-- ─────────────────────────────────────────────────────────────────────────────

-- Lecture : clubs publics lisibles par tous ; clubs privés uniquement par le
-- propriétaire ou les membres.
create policy "clubs_select" on public.clubs for select using (
  is_private = false
  or public.auth_user_owns_venue(venue_id)
  or exists (
    select 1 from public.club_members cm
    where cm.club_id = id and cm.user_id = auth.uid()
  )
);

-- Création : uniquement si l'utilisateur est propriétaire du venue ET que le
-- venue a un abonnement Rayonnement ou Pro actif.
create policy "clubs_insert" on public.clubs for insert with check (
  public.auth_user_owns_venue(venue_id)
  and public.venue_has_club_jovial_access(venue_id)
);

-- Modification : uniquement par le propriétaire du venue.
create policy "clubs_update" on public.clubs for update using (
  public.auth_user_owns_venue(venue_id)
);

-- Suppression : uniquement par le propriétaire du venue.
create policy "clubs_delete" on public.clubs for delete using (
  public.auth_user_owns_venue(venue_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Politiques RLS : club_members
-- ─────────────────────────────────────────────────────────────────────────────

create policy "club_members_select" on public.club_members for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.clubs c
    join public.venues v on v.id = c.venue_id
    where c.id = club_id and v.owner_user_id = auth.uid()
  )
);

-- Un utilisateur peut rejoindre un club actif.
create policy "club_members_insert" on public.club_members for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.clubs c
    where c.id = club_id and c.is_active = true
  )
);

-- Un utilisateur peut quitter un club ; le propriétaire peut retirer un membre.
create policy "club_members_delete" on public.club_members for delete using (
  user_id = auth.uid()
  or exists (
    select 1 from public.clubs c
    join public.venues v on v.id = c.venue_id
    where c.id = club_id and v.owner_user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Politiques RLS : club_posts
-- ─────────────────────────────────────────────────────────────────────────────

-- Lecture : publications approuvées ; visibilité selon la confidentialité du club.
create policy "club_posts_select" on public.club_posts for select using (
  is_approved = true
  and (
    exists (
      select 1 from public.clubs c where c.id = club_id and c.is_private = false
    )
    or exists (
      select 1 from public.clubs c
      join public.venues v on v.id = c.venue_id
      where c.id = club_id and v.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.club_members cm
      where cm.club_id = club_id and cm.user_id = auth.uid()
    )
  )
);

-- Le propriétaire peut voir ses publications non encore approuvées (modération).
create policy "club_posts_select_pending" on public.club_posts for select using (
  is_approved = false
  and exists (
    select 1 from public.clubs c
    join public.venues v on v.id = c.venue_id
    where c.id = club_id and v.owner_user_id = auth.uid()
  )
);

-- Publication par l'établissement (propriétaire du venue).
create policy "club_posts_insert_establishment" on public.club_posts for insert with check (
  author_venue_id is not null
  and author_user_id is null
  and public.auth_user_owns_venue(author_venue_id)
  and exists (
    select 1 from public.clubs c
    where c.id = club_id and c.venue_id = author_venue_id
  )
);

-- Publication par un membre (si le club le permet).
create policy "club_posts_insert_member" on public.club_posts for insert with check (
  author_user_id  = auth.uid()
  and author_venue_id is null
  and exists (
    select 1 from public.clubs c
    join public.club_members cm on cm.club_id = c.id
    where c.id = club_id
      and cm.user_id = auth.uid()
      and c.allow_member_posts = true
  )
);

-- Modification : propriétaire du club (épinglage, approbation) ou auteur (texte).
create policy "club_posts_update" on public.club_posts for update using (
  author_user_id = auth.uid()
  or exists (
    select 1 from public.clubs c
    join public.venues v on v.id = c.venue_id
    where c.id = club_id and v.owner_user_id = auth.uid()
  )
);

-- Suppression : auteur ou propriétaire du club.
create policy "club_posts_delete" on public.club_posts for delete using (
  author_user_id = auth.uid()
  or exists (
    select 1 from public.clubs c
    join public.venues v on v.id = c.venue_id
    where c.id = club_id and v.owner_user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Politiques RLS : club_comments
-- ─────────────────────────────────────────────────────────────────────────────

create policy "club_comments_select" on public.club_comments for select using (
  exists (
    select 1 from public.club_posts p
    join public.clubs c on c.id = p.club_id
    where p.id = post_id
      and p.is_approved = true
      and (
        c.is_private = false
        or exists (
          select 1 from public.venues v
          where v.id = c.venue_id and v.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from public.club_members cm
          where cm.club_id = c.id and cm.user_id = auth.uid()
        )
      )
  )
);

-- Commentaire par l'établissement.
create policy "club_comments_insert_establishment" on public.club_comments for insert with check (
  author_venue_id is not null
  and author_user_id is null
  and public.auth_user_owns_venue(author_venue_id)
);

-- Commentaire par un membre (si le club le permet).
create policy "club_comments_insert_member" on public.club_comments for insert with check (
  author_user_id = auth.uid()
  and author_venue_id is null
  and exists (
    select 1 from public.club_posts p
    join public.clubs c on c.id = p.club_id
    join public.club_members cm on cm.club_id = c.id
    where p.id = post_id
      and cm.user_id = auth.uid()
      and c.allow_member_comments = true
  )
);

-- Suppression : auteur ou propriétaire du club.
create policy "club_comments_delete" on public.club_comments for delete using (
  author_user_id = auth.uid()
  or exists (
    select 1 from public.club_posts p
    join public.clubs c on c.id = p.club_id
    join public.venues v on v.id = c.venue_id
    where p.id = post_id and v.owner_user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Politiques RLS : club_post_reactions
-- ─────────────────────────────────────────────────────────────────────────────

create policy "reactions_select" on public.club_post_reactions for select using (true);

create policy "reactions_insert" on public.club_post_reactions for insert with check (
  user_id = auth.uid()
);

create policy "reactions_delete" on public.club_post_reactions for delete using (
  user_id = auth.uid()
);
