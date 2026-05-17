-- Jovial Pro — Migration v2 (partie 1/2) : schéma uniquement, sans PL/pgSQL.
-- Colle CE FICHIER seul dans l'éditeur SQL Supabase, puis exécute.
-- Ensuite colle jovial_pro_plans_v2_function.sql dans un NOUVEL onglet.

-- 1. Étendre le CHECK sur establishment_subscriptions.plan pour inclure 'pro'
alter table public.establishment_subscriptions
  drop constraint if exists establishment_subscriptions_plan_check;

alter table public.establishment_subscriptions
  add constraint establishment_subscriptions_plan_check
  check (plan in ('classic', 'premium', 'pro'));

-- 2. Rendre events_quota_year nullable (null = illimité pour Rayonnement et Pro)
alter table public.establishment_subscriptions
  alter column events_quota_year drop not null;

-- 3. Nouvelle colonne de tracking : notifications ciblées utilisées dans l'année
alter table public.establishment_subscriptions
  add column if not exists targeted_notifications_used_year integer not null default 0;

-- 4. Nouvelles colonnes de features dans subscription_plans
alter table public.subscription_plans
  add column if not exists has_reminders boolean not null default false,
  add column if not exists has_club_jovial boolean not null default false,
  add column if not exists targeted_notifications_quota_year integer not null default 0,
  add column if not exists has_analytics boolean not null default false;
