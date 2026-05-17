begin;

-- 1. Enrichit chaque etablissement actif avec une cover et au moins 2 photos.
with base_venues as (
  select
    v.id,
    coalesce(v.cover_url, format('https://picsum.photos/seed/venue-%s-cover/1400/900', v.id)) as next_cover_url,
    format('https://picsum.photos/seed/venue-%s-1/1400/900', v.id) as photo_1,
    format('https://picsum.photos/seed/venue-%s-2/1400/900', v.id) as photo_2,
    format('https://picsum.photos/seed/venue-%s-3/1400/900', v.id) as photo_3
  from public.venues v
  where coalesce(v.is_active, true) = true
)
update public.venues v
set
  cover_url = b.next_cover_url,
  photos = case
    when coalesce(array_length(v.photos, 1), 0) >= 2 then v.photos
    when coalesce(array_length(v.photos, 1), 0) = 1 then array[
      v.photos[1],
      case when v.photos[1] = b.photo_2 then b.photo_3 else b.photo_2 end
    ]::text[]
    when v.cover_url is not null then array[
      v.cover_url,
      b.photo_2,
      b.photo_3
    ]::text[]
    else array[
      b.photo_1,
      b.photo_2,
      b.photo_3
    ]::text[]
  end,
  updated_at = now()
from base_venues b
where v.id = b.id;

-- 2. Supprime les evenements de demo precedemment generes par ce script.
delete from public.events
where description like '[JOVIAL_DEMO_2026]%'
  and venue_id in (
    select id
    from public.venues
    where coalesce(is_active, true) = true
  );

-- 3. Cree 3 evenements de demonstration par etablissement.
insert into public.events (
  venue_id,
  title,
  description,
  starts_at,
  ends_at,
  cover_url,
  category_id,
  is_published,
  updated_at
)
select
  v.id,
  'Soiree jeux du printemps',
  '[JOVIAL_DEMO_2026] Une soiree jeux conviviale pour decouvrir le lieu, partager un verre et tester les activites entre amis.',
  timestamptz '2026-04-17 19:30:00 Europe/Paris',
  timestamptz '2026-04-17 23:30:00 Europe/Paris',
  format('https://picsum.photos/seed/event-%s-april/1400/900', v.id),
  3,
  true,
  now()
from public.venues v
where coalesce(v.is_active, true) = true;

insert into public.events (
  venue_id,
  title,
  description,
  starts_at,
  ends_at,
  cover_url,
  category_id,
  is_published,
  updated_at
)
select
  v.id,
  'Live music & bonne ambiance',
  '[JOVIAL_DEMO_2026] Une soiree musicale pensee pour faire revenir du monde au printemps avec une ambiance simple, festive et chaleureuse.',
  timestamptz '2026-05-22 20:00:00 Europe/Paris',
  timestamptz '2026-05-23 00:30:00 Europe/Paris',
  format('https://picsum.photos/seed/event-%s-may/1400/900', v.id),
  1,
  true,
  now()
from public.venues v
where coalesce(v.is_active, true) = true;

insert into public.events (
  venue_id,
  title,
  description,
  starts_at,
  ends_at,
  cover_url,
  category_id,
  is_published,
  updated_at
)
select
  v.id,
  'Rentree sportive & retransmission',
  '[JOVIAL_DEMO_2026] Un temps fort de rentree pour relancer la frequentation avec diffusion sportive, animation et atmosphere de comptoir.',
  timestamptz '2026-09-18 19:00:00 Europe/Paris',
  timestamptz '2026-09-18 23:45:00 Europe/Paris',
  format('https://picsum.photos/seed/event-%s-september/1400/900', v.id),
  10,
  true,
  now()
from public.venues v
where coalesce(v.is_active, true) = true;

commit;
