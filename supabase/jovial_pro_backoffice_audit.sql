-- Jovial Pro audit helpers.
-- Replace the values in the params CTE, then run the queries one by one.

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as owner_user_id,
    null::bigint as venue_id
)
select
  p.user_id,
  p.role,
  p.city,
  p.updated_at
from public.profiles p
join params on params.owner_user_id = p.user_id;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as owner_user_id,
    null::bigint as venue_id
)
select
  v.id,
  v.owner_user_id,
  v.name,
  v.city,
  v.address,
  v.postcode,
  v.lat,
  v.lng,
  v.tags,
  v.activities,
  v.opening_hours,
  v.updated_at
from public.venues v
join params on params.owner_user_id = v.owner_user_id
order by v.updated_at desc;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as owner_user_id,
    null::bigint as venue_id
),
resolved_venue as (
  select coalesce(params.venue_id, v.id) as venue_id
  from params
  left join public.venues v on v.owner_user_id = params.owner_user_id
  order by v.updated_at desc nulls last
  limit 1
)
select *
from public.establishment_subscriptions s
join resolved_venue rv on rv.venue_id = s.venue_id;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as owner_user_id,
    null::bigint as venue_id
),
resolved_venue as (
  select coalesce(params.venue_id, v.id) as venue_id
  from params
  left join public.venues v on v.owner_user_id = params.owner_user_id
  order by v.updated_at desc nulls last
  limit 1
)
select
  e.id,
  e.title,
  e.starts_at,
  e.ends_at,
  e.is_published,
  e.updated_at
from public.events e
join resolved_venue rv on rv.venue_id = e.venue_id
order by e.starts_at asc;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as owner_user_id,
    null::bigint as venue_id
),
resolved_venue as (
  select coalesce(params.venue_id, v.id) as venue_id
  from params
  left join public.venues v on v.owner_user_id = params.owner_user_id
  order by v.updated_at desc nulls last
  limit 1
)
select
  vg.id,
  vg.venue_id,
  g.name as game_name,
  vg.quantity,
  vg.booking_mode,
  vg.booking_enabled,
  vg.price_cents,
  vg.payment_required
from public.venue_games vg
left join public.games g on g.id = vg.game_id
join resolved_venue rv on rv.venue_id = vg.venue_id
order by g.name asc nulls last;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as owner_user_id,
    null::bigint as venue_id
),
resolved_venue as (
  select coalesce(params.venue_id, v.id) as venue_id
  from params
  left join public.venues v on v.owner_user_id = params.owner_user_id
  order by v.updated_at desc nulls last
  limit 1
)
select
  v.id as venue_id,
  v.tags as venue_tags_array,
  array_remove(array_agg(distinct vt.name), null) as normalized_tag_names
from public.venues v
join resolved_venue rv on rv.venue_id = v.id
left join public.venue_venue_tags vvt on vvt.venue_id = v.id
left join public.venue_tags vt on vt.id = vvt.tag_id
group by v.id, v.tags;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as owner_user_id,
    null::bigint as venue_id
),
resolved_venue as (
  select coalesce(params.venue_id, v.id) as venue_id
  from params
  left join public.venues v on v.owner_user_id = params.owner_user_id
  order by v.updated_at desc nulls last
  limit 1
)
select
  v.id as venue_id,
  v.opening_hours,
  array_agg(
    jsonb_build_object(
      'day', vos.day,
      'slot_index', vos.slot_index,
      'opens_at', vos.opens_at,
      'closes_at', vos.closes_at
    )
    order by vos.day, vos.slot_index
  ) filter (where vos.id is not null) as opening_slots
from public.venues v
join resolved_venue rv on rv.venue_id = v.id
left join public.venue_opening_slots vos on vos.venue_id = v.id
group by v.id, v.opening_hours;
