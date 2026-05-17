-- Supabase schema for establishment dashboard (Jovial)
-- Safe to run multiple times with IF NOT EXISTS guards.

-- Venues: ownership + quick fields
alter table if exists public.venues
  add column if not exists owner_user_id uuid references auth.users(id),
  add column if not exists description text,
  add column if not exists instagram_url text,
  add column if not exists website_url text,
  add column if not exists phone text,
  add column if not exists opening_hours jsonb,
  add column if not exists timezone text,
  add column if not exists activities text[],
  add column if not exists tags text[],
  add column if not exists darts_targets_count integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- Reference list (time slots) for dropdowns
create table if not exists public.time_slots (
  minutes int primary key,
  label text not null
);

insert into public.time_slots (minutes, label)
select m, to_char(time '00:00' + (m || ' minutes')::interval, 'HH24:MI')
from generate_series(0, 23 * 60 + 30, 30) as m
on conflict (minutes) do update
  set label = excluded.label;

-- Enum + slots table to power dropdowns in the table editor
do $$ begin
  create type public.weekday as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.venue_opening_slots (
  id bigserial primary key,
  venue_id int not null references public.venues(id) on delete cascade,
  day public.weekday not null,
  slot_index int not null check (slot_index between 1 and 3),
  opens_at int references public.time_slots(minutes),
  closes_at int references public.time_slots(minutes),
  unique (venue_id, day, slot_index)
);

-- Sync opening_hours JSON on venues whenever slots change
create or replace function public.refresh_opening_hours(p_venue_id int)
returns void
language plpgsql
as $$
begin
  update public.venues v
  set opening_hours = (
    select jsonb_object_agg(day, slots)
    from (
      select day, jsonb_agg(jsonb_build_object('open', open_label, 'close', close_label) order by slot_index) as slots
      from (
        select
          vos.day,
          vos.slot_index,
          to_char(time '00:00' + (vos.opens_at || ' minutes')::interval, 'HH24:MI') as open_label,
          to_char(time '00:00' + (vos.closes_at || ' minutes')::interval, 'HH24:MI') as close_label
        from public.venue_opening_slots vos
        where vos.venue_id = p_venue_id
          and vos.opens_at is not null
          and vos.closes_at is not null
      ) slots
      group by day
    ) days
  )
  where v.id = p_venue_id;
end;
$$;

create or replace function public.sync_refresh_opening_hours()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_opening_hours(coalesce(new.venue_id, old.venue_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists venue_opening_slots_sync on public.venue_opening_slots;
create trigger venue_opening_slots_sync
  after insert or update or delete
  on public.venue_opening_slots
  for each row
  execute function public.sync_refresh_opening_hours();

-- Optional backfill if you already store creator in created_by
update public.venues
  set owner_user_id = created_by
  where owner_user_id is null and created_by is not null;

-- Profiles: user vs establishment roles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  firstname text,
  lastname text,
  handle text,
  bio text,
  city text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','establishment')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles
  add column if not exists role text not null default 'user' check (role in ('user','establishment'));

alter table if exists public.profiles
  add column if not exists id uuid default gen_random_uuid();

alter table if exists public.profiles
  add column if not exists user_id uuid;

alter table if exists public.profiles
  add column if not exists firstname text,
  add column if not exists lastname text,
  add column if not exists handle text,
  add column if not exists bio text,
  add column if not exists city text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set user_id = id
where user_id is null
  and exists (
    select 1
    from auth.users u
    where u.id = public.profiles.id
  );

alter table if exists public.profiles
  drop constraint if exists profiles_user_id_fkey;
alter table if exists public.profiles
  add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id);

alter table if exists public.profiles
  drop constraint if exists profiles_id_fkey;

-- Backfill for existing auth users (when profiles has user_id)
insert into public.profiles (user_id, role)
select id, 'user' from auth.users
where not exists (select 1 from public.profiles p where p.user_id = auth.users.id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
        when v_requested_offer in ('rayonnement', 'pro') then 'premium'
        else 'classic'
      end;

    v_events_quota :=
      case
        when v_requested_offer = 'visibilite' then 1
        else 999
      end;

    select v.id
    into v_venue_id
    from public.venues v
    where v.owner_user_id = new.id
    order by v.id
    limit 1;

    if v_venue_id is null then
      insert into public.venues (
        owner_user_id,
        name,
        city,
        timezone,
        activities,
        tags,
        is_active
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
        venue_id,
        plan,
        status,
        current_period_end,
        events_quota_year,
        events_used_year
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
        set plan = excluded.plan,
            status = excluded.status,
            current_period_end = excluded.current_period_end,
            events_quota_year = excluded.events_quota_year,
            updated_at = now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_read" on public.profiles;
create policy "profiles_owner_read"
  on public.profiles for select
  using (user_id = auth.uid());

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
  on public.profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert"
  on public.profiles for insert
  with check (user_id = auth.uid());

-- Events: add publish flags
alter table if exists public.events
  add column if not exists is_published boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- Subscription (quota)
create table if not exists public.establishment_subscriptions (
  id bigserial primary key,
  venue_id integer not null references public.venues(id) on delete cascade,
  plan text not null default 'classic' check (plan in ('classic','premium')),
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  current_period_end date,
  events_quota_year integer not null default 5,
  events_used_year integer not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists establishment_subscriptions_venue_id_key
  on public.establishment_subscriptions (venue_id);

-- Storage bucket (safe to run multiple times)
insert into storage.buckets (id, name, public)
values ('establishment-media', 'establishment-media', true)
on conflict (id) do update set public = true;

-- RLS
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.establishment_subscriptions enable row level security;
alter table public.time_slots enable row level security;
alter table public.venue_opening_slots enable row level security;

-- Venues policies
drop policy if exists "venues_public_read" on public.venues;
create policy "venues_public_read"
  on public.venues for select
  using (is_active = true);

drop policy if exists "venues_owner_read" on public.venues;
create policy "venues_owner_read"
  on public.venues for select
  using (owner_user_id = auth.uid());

drop policy if exists "venues_owner_write" on public.venues;
create policy "venues_owner_write"
  on public.venues for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "venues_owner_insert" on public.venues;
create policy "venues_owner_insert"
  on public.venues for insert
  with check (owner_user_id = auth.uid());

-- Events policies
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read"
  on public.events for select
  using (
    is_published = true
    or exists (
      select 1 from public.venues v
      where v.id = events.venue_id and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write"
  on public.events for insert
  with check (
    exists (
      select 1 from public.venues v
      where v.id = events.venue_id and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "events_owner_update" on public.events;
create policy "events_owner_update"
  on public.events for update
  using (
    exists (
      select 1 from public.venues v
      where v.id = events.venue_id and v.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.venues v
      where v.id = events.venue_id and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "events_owner_delete" on public.events;
create policy "events_owner_delete"
  on public.events for delete
  using (
    exists (
      select 1 from public.venues v
      where v.id = events.venue_id and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "time_slots_read" on public.time_slots;
create policy "time_slots_read"
  on public.time_slots for select
  using (true);

drop policy if exists "venue_opening_slots_read" on public.venue_opening_slots;
create policy "venue_opening_slots_read"
  on public.venue_opening_slots for select
  using (true);

-- Subscriptions policies
drop policy if exists "subs_owner_read" on public.establishment_subscriptions;
create policy "subs_owner_read"
  on public.establishment_subscriptions for select
  using (
    exists (
      select 1 from public.venues v
      where v.id = establishment_subscriptions.venue_id and v.owner_user_id = auth.uid()
    )
  );

drop policy if exists "subs_owner_write" on public.establishment_subscriptions;
create policy "subs_owner_write"
  on public.establishment_subscriptions for update
  using (
    exists (
      select 1 from public.venues v
      where v.id = establishment_subscriptions.venue_id and v.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.venues v
      where v.id = establishment_subscriptions.venue_id and v.owner_user_id = auth.uid()
    )
  );

-- Storage policies
drop policy if exists "establishment_media_read" on storage.objects;
create policy "establishment_media_read"
  on storage.objects for select
  using (bucket_id = 'establishment-media');

drop policy if exists "establishment_media_write" on storage.objects;
create policy "establishment_media_write"
  on storage.objects for insert
  with check (bucket_id = 'establishment-media' and auth.uid() is not null);

drop policy if exists "establishment_media_update" on storage.objects;
create policy "establishment_media_update"
  on storage.objects for update
  using (bucket_id = 'establishment-media' and auth.uid() is not null)
  with check (bucket_id = 'establishment-media' and auth.uid() is not null);
