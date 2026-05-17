-- =============================================================================
-- ÉTAPE 1 — Remplis les IDs Stripe ci-dessous avant d'exécuter ce fichier.
-- Va dans Stripe > Products, crée les 3 produits si besoin, puis copie les IDs.
--
-- Produit               Prix mensuel (HT)   Prix annuel (HT)
-- ─────────────────────────────────────────────────────────
-- Offre Visibilité      29,99 €/mois         290 €/an
-- Offre Rayonnement     49,99 €/mois         490 €/an
-- Offre Pro             79,99 €/mois         790 €/an
--
-- Pour chaque produit : crée 2 prices (monthly + yearly), copie les 3 IDs.
-- =============================================================================

-- ── IDs Stripe (référence) ────────────────────────────────────────────────────
-- Visibilité  : prod_TozwdsTV3WdiCE  | month: price_1SrMADHHrzzN81ThHkX2SGGK  | year: price_1SrN3oHHrzzN81ThNZuzvOFm
-- Rayonnement : prod_TozupYdBtusTNH  | month: price_1SrM8XHHrzzN81ThQyGBMAKe  | year: price_1SrMzeHHrzzN81ThqQ8Yprbi
-- Pro         : prod_USKBKAvFtkkbEI  | month: price_1TTPX0HHrzzN81ThZnrKfTg2  | year: price_1TTPSSHHrzzN81Thsx91jGDN

-- =============================================================================
-- Exécute ce fichier dans un onglet Supabase SQL (après la migration v2).
-- =============================================================================

insert into public.subscription_plans (
  code,
  name,
  price_cents,
  event_quota,
  tags_limit,
  tournaments_quota_year,
  boosts_quota_year,
  local_spotlight_quota_year,
  targeted_notifications_quota_year,
  has_reminders,
  has_club_jovial,
  has_analytics,
  stripe_product_id,
  stripe_price_id,
  active
)
values
  (
    'classic',
    'Visibilite',
    2999,
    4,
    1,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    'prod_TozwdsTV3WdiCE',
    'price_1SrMADHHrzzN81ThHkX2SGGK',
    true
  ),
  (
    'premium',
    'Rayonnement',
    4999,
    null,
    2,
    null,
    2,
    1,
    0,
    true,
    true,
    false,
    'prod_TozupYdBtusTNH',
    'price_1SrM8XHHrzzN81ThQyGBMAKe',
    true
  ),
  (
    'pro',
    'Pro',
    7999,
    null,
    3,
    null,
    6,
    12,
    1,
    true,
    true,
    true,
    'prod_USKBKAvFtkkbEI',
    'price_1TTPX0HHrzzN81ThZnrKfTg2',
    true
  )
on conflict (code) do update
set
  name                               = excluded.name,
  price_cents                        = excluded.price_cents,
  event_quota                        = excluded.event_quota,
  tags_limit                         = excluded.tags_limit,
  tournaments_quota_year             = excluded.tournaments_quota_year,
  boosts_quota_year                  = excluded.boosts_quota_year,
  local_spotlight_quota_year         = excluded.local_spotlight_quota_year,
  targeted_notifications_quota_year  = excluded.targeted_notifications_quota_year,
  has_reminders                      = excluded.has_reminders,
  has_club_jovial                    = excluded.has_club_jovial,
  has_analytics                      = excluded.has_analytics,
  active                             = excluded.active;

-- ── Prix Visibilité ───────────────────────────────────────────────────────────

insert into public.subscription_plan_prices (plan_id, interval, price_cents, stripe_price_id, active)
select id, 'month', 2999, 'price_1SrMADHHrzzN81ThHkX2SGGK', true
from public.subscription_plans where code = 'classic'
on conflict (plan_id, interval) do update
set price_cents = excluded.price_cents, stripe_price_id = excluded.stripe_price_id, active = excluded.active;

insert into public.subscription_plan_prices (plan_id, interval, price_cents, stripe_price_id, active)
select id, 'year', 29000, 'price_1SrN3oHHrzzN81ThNZuzvOFm', true
from public.subscription_plans where code = 'classic'
on conflict (plan_id, interval) do update
set price_cents = excluded.price_cents, stripe_price_id = excluded.stripe_price_id, active = excluded.active;

-- ── Prix Rayonnement ──────────────────────────────────────────────────────────

insert into public.subscription_plan_prices (plan_id, interval, price_cents, stripe_price_id, active)
select id, 'month', 4999, 'price_1SrM8XHHrzzN81ThQyGBMAKe', true
from public.subscription_plans where code = 'premium'
on conflict (plan_id, interval) do update
set price_cents = excluded.price_cents, stripe_price_id = excluded.stripe_price_id, active = excluded.active;

insert into public.subscription_plan_prices (plan_id, interval, price_cents, stripe_price_id, active)
select id, 'year', 49000, 'price_1SrMzeHHrzzN81ThqQ8Yprbi', true
from public.subscription_plans where code = 'premium'
on conflict (plan_id, interval) do update
set price_cents = excluded.price_cents, stripe_price_id = excluded.stripe_price_id, active = excluded.active;

-- ── Prix Pro ──────────────────────────────────────────────────────────────────

insert into public.subscription_plan_prices (plan_id, interval, price_cents, stripe_price_id, active)
select id, 'month', 7999, 'price_1TTPX0HHrzzN81ThZnrKfTg2', true
from public.subscription_plans where code = 'pro'
on conflict (plan_id, interval) do update
set price_cents = excluded.price_cents, stripe_price_id = excluded.stripe_price_id, active = excluded.active;

insert into public.subscription_plan_prices (plan_id, interval, price_cents, stripe_price_id, active)
select id, 'year', 79000, 'price_1TTPSSHHrzzN81Thsx91jGDN', true
from public.subscription_plans where code = 'pro'
on conflict (plan_id, interval) do update
set price_cents = excluded.price_cents, stripe_price_id = excluded.stripe_price_id, active = excluded.active;
