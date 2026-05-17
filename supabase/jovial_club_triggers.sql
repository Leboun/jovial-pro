-- Club Jovial — Migration partie 3/3 : triggers de compteurs.
-- Exécuter APRÈS jovial_club_rls.sql, dans un NOUVEL onglet SQL Supabase.
-- Chaque fonction utilise un dollar-quoting unique pour éviter les erreurs
-- de parsing de l'éditeur SQL Supabase.

-- ─────────────────────────────────────────────────────────────────────────────
-- Compteur de membres dans clubs.member_count
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_update_club_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg_club_member_count$
begin
  if TG_OP = 'INSERT' then
    update public.clubs
    set member_count = member_count + 1
    where id = NEW.club_id;
  elsif TG_OP = 'DELETE' then
    update public.clubs
    set member_count = greatest(0, member_count - 1)
    where id = OLD.club_id;
  end if;
  return null;
end;
$trg_club_member_count$;

drop trigger if exists trg_club_member_count on public.club_members;
create trigger trg_club_member_count
after insert or delete on public.club_members
for each row execute function public.trg_update_club_member_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- Compteur de publications dans clubs.post_count
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_update_club_post_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg_club_post_count$
begin
  if TG_OP = 'INSERT' then
    update public.clubs
    set post_count = post_count + 1,
        updated_at = now()
    where id = NEW.club_id;
  elsif TG_OP = 'DELETE' then
    update public.clubs
    set post_count = greatest(0, post_count - 1)
    where id = OLD.club_id;
  end if;
  return null;
end;
$trg_club_post_count$;

drop trigger if exists trg_club_post_count on public.club_posts;
create trigger trg_club_post_count
after insert or delete on public.club_posts
for each row execute function public.trg_update_club_post_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- Compteur de commentaires dans club_posts.comments_count
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_update_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg_post_comment_count$
begin
  if TG_OP = 'INSERT' then
    update public.club_posts
    set comments_count = comments_count + 1
    where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.club_posts
    set comments_count = greatest(0, comments_count - 1)
    where id = OLD.post_id;
  end if;
  return null;
end;
$trg_post_comment_count$;

drop trigger if exists trg_post_comment_count on public.club_comments;
create trigger trg_post_comment_count
after insert or delete on public.club_comments
for each row execute function public.trg_update_post_comment_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- Compteur de likes dans club_posts.likes_count
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_update_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg_post_likes_count$
begin
  if TG_OP = 'INSERT' then
    update public.club_posts
    set likes_count = likes_count + 1
    where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.club_posts
    set likes_count = greatest(0, likes_count - 1)
    where id = OLD.post_id;
  end if;
  return null;
end;
$trg_post_likes_count$;

drop trigger if exists trg_post_likes_count on public.club_post_reactions;
create trigger trg_post_likes_count
after insert or delete on public.club_post_reactions
for each row execute function public.trg_update_post_likes_count();
