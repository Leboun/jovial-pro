-- Jovial Pro — Migration v2 (partie 2/2) : fonction handle_new_user.
-- IMPORTANT : exécuter jovial_pro_plans_v2.sql EN PREMIER (onglet séparé).
-- Colle CE FICHIER seul dans un nouvel onglet de l'éditeur SQL Supabase.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_new_user_v2$
declare
  v_role text;
  v_establishment_name text;
  v_establishment_city text;
  v_requested_offer text;
  v_plan text;
  v_events_quota integer;
  v_venue_id integer;
begin
  v_role :=
    case
      when new.raw_user_meta_data->>'role' = 'establishment' then 'establishment'
      when new.raw_user_meta_data->>'account_type' = 'establishment' then 'establishment'
      else 'user'
    end;

  if exists (select 1 from public.profiles p where p.user_id = new.id) then
    update public.profiles
    set user_id = coalesce(public.profiles.user_id, new.id),
        role = v_role,
        city = coalesce(public.profiles.city, nullif(new.raw_user_meta_data->>'establishment_city', '')),
        updated_at = now()
    where public.profiles.user_id = new.id;
  else
    insert into public.profiles (user_id, role, handle, city)
    values (
      new.id,
      v_role,
      nullif(new.raw_user_meta_data->>'establishment_name', ''),
      nullif(new.raw_user_meta_data->>'establishment_city', '')
    );
  end if;

  if v_role = 'establishment' then
    v_establishment_name := nullif(new.raw_user_meta_data->>'establishment_name', '');
    v_establishment_city := nullif(new.raw_user_meta_data->>'establishment_city', '');
    v_requested_offer := coalesce(new.raw_user_meta_data->>'requested_offer', 'visibilite');

    v_plan :=
      case
        when v_requested_offer = 'pro'         then 'pro'
        when v_requested_offer = 'rayonnement' then 'premium'
        else                                        'classic'
      end;

    v_events_quota :=
      case
        when v_plan = 'classic' then 4
        else null
      end;

    select v.id
    into v_venue_id
    from public.venues v
    where v.owner_user_id = new.id
    order by v.id
    limit 1;

    if v_venue_id is null then
      insert into public.venues (
        owner_user_id, name, city, timezone, activities, tags, is_active
      )
      values (
        new.id,
        coalesce(v_establishment_name, 'Mon etablissement'),
        v_establishment_city,
        'Europe/Paris',
        '{}'::text[],
        '{}'::text[],
        true
      )
      returning id into v_venue_id;
    end if;

    if v_venue_id is not null then
      insert into public.establishment_subscriptions (
        venue_id, plan, status, current_period_end, events_quota_year, events_used_year
      )
      values (
        v_venue_id,
        v_plan,
        'active',
        (now() + interval '1 year')::date,
        v_events_quota,
        0
      )
      on conflict (venue_id) do update
        set plan               = excluded.plan,
            status             = excluded.status,
            current_period_end = excluded.current_period_end,
            events_quota_year  = excluded.events_quota_year,
            updated_at         = now();
    end if;
  end if;

  return new;
end;
$handle_new_user_v2$;
