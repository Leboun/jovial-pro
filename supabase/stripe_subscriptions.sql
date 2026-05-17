-- Stripe subscription fields for establishment plans.
-- Safe to run multiple times with IF NOT EXISTS guards.

alter table if exists public.establishment_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_product_id text,
  add column if not exists current_period_end_at timestamptz;

create unique index if not exists establishment_subscriptions_venue_id_key
  on public.establishment_subscriptions (venue_id);

alter table if exists public.subscription_plans
  add column if not exists stripe_price_id text,
  add column if not exists stripe_product_id text,
  add column if not exists tags_limit integer,
  add column if not exists tournaments_quota_year integer,
  add column if not exists boosts_quota_year integer,
  add column if not exists local_spotlight_quota_year integer,
  add column if not exists active boolean not null default true;

create unique index if not exists subscription_plans_stripe_price_id_key
  on public.subscription_plans (stripe_price_id);

create table if not exists public.subscription_plan_prices (
  id bigserial primary key,
  plan_id bigint not null references public.subscription_plans(id) on delete cascade,
  interval text not null check (interval in ('month', 'year')),
  price_cents integer not null,
  stripe_price_id text,
  active boolean not null default true,
  unique (plan_id, interval)
);

create unique index if not exists subscription_plan_prices_stripe_price_id_key
  on public.subscription_plan_prices (stripe_price_id);

alter table if exists public.establishment_subscriptions
  add column if not exists tournaments_used_year integer not null default 0,
  add column if not exists boosts_used_year integer not null default 0,
  add column if not exists local_spotlight_used_year integer not null default 0;

create table if not exists public.venue_boost_purchases (
  id bigserial primary key,
  venue_id integer not null references public.venues(id) on delete cascade,
  stripe_payment_intent_id text,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

alter table if exists public.venue_boost_purchases enable row level security;

drop policy if exists "venue_boosts_owner_read" on public.venue_boost_purchases;
create policy "venue_boosts_owner_read"
  on public.venue_boost_purchases for select
  using (
    exists (
      select 1 from public.venues v
      where v.id = venue_boost_purchases.venue_id and v.owner_user_id = auth.uid()
    )
  );

alter table if exists public.subscription_plans enable row level security;
alter table if exists public.subscription_plan_prices enable row level security;

drop policy if exists "subscription_plans_public_read" on public.subscription_plans;
create policy "subscription_plans_public_read"
  on public.subscription_plans for select
  using (true);

drop policy if exists "subscription_plan_prices_public_read" on public.subscription_plan_prices;
create policy "subscription_plan_prices_public_read"
  on public.subscription_plan_prices for select
  using (true);
