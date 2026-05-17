-- Cleanup for the discontinued establishment scoring / badge / analytics layer.
-- Safe to run multiple times.

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'analytics_reports'
      and c.relkind in ('r', 'p')
  ) then
    execute 'drop policy if exists "analytics_reports_owner_read" on public.analytics_reports';
    execute 'drop table public.analytics_reports';
  end if;
end $$;

alter table if exists public.subscription_plans
  drop column if exists includes_top_weekly,
  drop column if exists includes_incontournables,
  drop column if exists analytics_report_annual;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'establishment_badges_active'
      and c.relkind = 'v'
  ) then
    execute 'drop view public.establishment_badges_active';
  end if;
end $$;

do $$
declare
  rel_name text;
begin
  foreach rel_name in array array[
    'profile_view_dedup',
    'establishment_profile_view_24h',
    'establishment_events',
    'establishment_metrics_daily',
    'establishment_scores',
    'establishment_badges'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = rel_name
        and c.relkind in ('r', 'p')
    ) then
      execute format('drop table public.%I cascade', rel_name);
    elsif exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = rel_name
        and c.relkind = 'v'
    ) then
      execute format('drop view public.%I cascade', rel_name);
    end if;
  end loop;
end $$;
