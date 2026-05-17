-- Jovial Pro back-office coherence helpers.
-- Safe to run multiple times.
--
-- Canonical sources used by the app:
-- - public.venues: main establishment profile
-- - public.establishment_subscriptions: active offer / quotas
-- - public.events: establishment events
-- - public.venue_games: reservable activities
--
-- Compatibility mirrors maintained here:
-- - public.venues.tags -> public.venue_tags / public.venue_venue_tags
-- - public.venues.opening_hours -> public.venue_opening_slots

alter table if exists public.venue_games enable row level security;
alter table if exists public.venue_game_blackouts enable row level security;

drop policy if exists "venue_games_public_read" on public.venue_games;
create policy "venue_games_public_read"
  on public.venue_games for select
  using (
    exists (
      select 1
      from public.venues v
      where v.id = venue_games.venue_id
        and v.is_active = true
    )
  );

drop policy if exists "venue_games_owner_write" on public.venue_games;
create policy "venue_games_owner_write"
  on public.venue_games for insert
  with check (
    exists (
      select 1
      from public.venues v
      where v.id = venue_games.venue_id
        and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "venue_games_owner_update" on public.venue_games;
create policy "venue_games_owner_update"
  on public.venue_games for update
  using (
    exists (
      select 1
      from public.venues v
      where v.id = venue_games.venue_id
        and v.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.venues v
      where v.id = venue_games.venue_id
        and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "venue_games_owner_delete" on public.venue_games;
create policy "venue_games_owner_delete"
  on public.venue_games for delete
  using (
    exists (
      select 1
      from public.venues v
      where v.id = venue_games.venue_id
        and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "venue_game_blackouts_owner_read" on public.venue_game_blackouts;
create policy "venue_game_blackouts_owner_read"
  on public.venue_game_blackouts for select
  using (
    exists (
      select 1
      from public.venues v
      where v.id = venue_game_blackouts.venue_id
        and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "venue_game_blackouts_owner_write" on public.venue_game_blackouts;
create policy "venue_game_blackouts_owner_write"
  on public.venue_game_blackouts for insert
  with check (
    exists (
      select 1
      from public.venues v
      where v.id = venue_game_blackouts.venue_id
        and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "venue_game_blackouts_owner_update" on public.venue_game_blackouts;
create policy "venue_game_blackouts_owner_update"
  on public.venue_game_blackouts for update
  using (
    exists (
      select 1
      from public.venues v
      where v.id = venue_game_blackouts.venue_id
        and v.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.venues v
      where v.id = venue_game_blackouts.venue_id
        and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "venue_game_blackouts_owner_delete" on public.venue_game_blackouts;
create policy "venue_game_blackouts_owner_delete"
  on public.venue_game_blackouts for delete
  using (
    exists (
      select 1
      from public.venues v
      where v.id = venue_game_blackouts.venue_id
        and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "establishment_media_update" on storage.objects;
create policy "establishment_media_update"
  on storage.objects for update
  using (bucket_id = 'establishment-media' and auth.uid() is not null)
  with check (bucket_id = 'establishment-media' and auth.uid() is not null);

drop policy if exists "establishment_media_delete" on storage.objects;
create policy "establishment_media_delete"
  on storage.objects for delete
  using (bucket_id = 'establishment-media' and auth.uid() is not null);

create or replace function public.hhmm_to_minutes(raw text)
returns integer
language plpgsql
immutable
as $$
declare
  v_hours integer;
  v_minutes integer;
  v_match text[];
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  v_match := regexp_match(lower(btrim(raw)), '^([0-9]{1,2})(?::|h)?([0-9]{2})?$');
  if v_match is null then
    return null;
  end if;

  v_hours := v_match[1]::integer;
  v_minutes := coalesce(v_match[2], '00')::integer;

  if v_hours < 0 or v_hours > 23 or v_minutes < 0 or v_minutes > 59 then
    return null;
  end if;

  return (v_hours * 60) + v_minutes;
end;
$$;

create or replace function public.sync_venue_opening_slots_from_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day text;
  v_slot jsonb;
  v_slot_index integer;
  v_open integer;
  v_close integer;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  delete from public.venue_opening_slots
  where venue_id = new.id;

  if new.opening_hours is null then
    return new;
  end if;

  for v_day in
    select jsonb_object_keys(new.opening_hours)
  loop
    v_slot_index := 0;

    for v_slot in
      select value
      from jsonb_array_elements(coalesce(new.opening_hours -> v_day, '[]'::jsonb))
    loop
      v_slot_index := v_slot_index + 1;
      exit when v_slot_index > 3;

      v_open := public.hhmm_to_minutes(v_slot ->> 'open');
      v_close := public.hhmm_to_minutes(v_slot ->> 'close');

      if v_open is null or v_close is null then
        continue;
      end if;

      insert into public.venue_opening_slots (
        venue_id,
        day,
        slot_index,
        opens_at,
        closes_at
      )
      values (
        new.id,
        v_day::public.weekday,
        v_slot_index,
        v_open,
        v_close
      )
      on conflict (venue_id, day, slot_index) do update
        set opens_at = excluded.opens_at,
            closes_at = excluded.closes_at;
    end loop;
  end loop;

  return new;
end;
$$;

drop trigger if exists venues_opening_hours_sync_to_slots on public.venues;
create trigger venues_opening_hours_sync_to_slots
  after insert or update of opening_hours
  on public.venues
  for each row
  execute function public.sync_venue_opening_slots_from_hours();

create or replace function public.sync_venue_tags_from_array()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_tag_id bigint;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  delete from public.venue_venue_tags
  where venue_id = new.id;

  if coalesce(array_length(new.tags, 1), 0) = 0 then
    return new;
  end if;

  foreach v_name in array new.tags
  loop
    v_name := btrim(v_name);
    if v_name is null or v_name = '' then
      continue;
    end if;

    select vt.id
    into v_tag_id
    from public.venue_tags vt
    where lower(vt.name) = lower(v_name)
    order by vt.id
    limit 1;

    if v_tag_id is null then
      insert into public.venue_tags (name, category)
      values (v_name, 'service')
      returning id into v_tag_id;
    end if;

    insert into public.venue_venue_tags (venue_id, tag_id)
    values (new.id, v_tag_id)
    on conflict (venue_id, tag_id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists venues_tags_sync_to_join on public.venues;
create trigger venues_tags_sync_to_join
  after insert or update of tags
  on public.venues
  for each row
  execute function public.sync_venue_tags_from_array();

create or replace function public.refresh_venue_activities_from_games(p_venue_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.venues v
  set activities = coalesce(
    (
      select array_agg(distinct g.name order by g.name)
      from public.venue_games vg
      join public.games g on g.id = vg.game_id
      where vg.venue_id = p_venue_id
    ),
    '{}'::text[]
  )
  where v.id = p_venue_id;
end;
$$;

create or replace function public.sync_refresh_venue_activities_from_games()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_venue_activities_from_games(coalesce(new.venue_id, old.venue_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists venue_games_sync_to_activities on public.venue_games;
create trigger venue_games_sync_to_activities
  after insert or update or delete
  on public.venue_games
  for each row
  execute function public.sync_refresh_venue_activities_from_games();

update public.venues
set tags = tags
where coalesce(array_length(tags, 1), 0) > 0;

update public.venues v
set activities = coalesce(
  (
    select array_agg(distinct g.name order by g.name)
    from public.venue_games vg
    join public.games g on g.id = vg.game_id
    where vg.venue_id = v.id
  ),
  '{}'::text[]
);

update public.venues
set opening_hours = opening_hours
where opening_hours is not null;
