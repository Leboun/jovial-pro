-- 1. Colonne éditoriale sur venues (gérée par toi, admin Jovial)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 2. Fonction principale : retourne les lieux du carrousel pour aujourd'hui
--    Logique :
--      a) Lieux ayant réservé le carrousel pour aujourd'hui (max 4, ordre aléatoire)
--      b) Complété jusqu'à 4 avec : lieux is_featured=true d'abord, puis lieux actifs les plus récents
--      Jamais de doublon, jamais plus de 4
CREATE OR REPLACE FUNCTION public.get_carousel_venues(
  p_date date DEFAULT CURRENT_DATE,
  p_max integer DEFAULT 4
)
RETURNS TABLE (
  venue_id bigint,
  source text  -- 'booked' | 'featured' | 'auto'
)
LANGUAGE sql
STABLE
AS $$
  -- a) Lieux ayant réservé
  WITH booked AS (
    SELECT cb.venue_id::bigint, 'booked'::text AS source
    FROM public.carousel_boost_bookings cb
    JOIN public.venues v ON v.id = cb.venue_id AND v.is_active = true
    WHERE cb.booked_date = p_date
    ORDER BY random()
    LIMIT p_max
  ),
  -- b) Lieux éditoriaux (is_featured) non déjà inclus
  featured AS (
    SELECT v.id::bigint AS venue_id, 'featured'::text AS source
    FROM public.venues v
    WHERE v.is_featured = true
      AND v.is_active = true
      AND v.id NOT IN (SELECT venue_id FROM booked)
    ORDER BY random()
    LIMIT p_max
  ),
  -- c) Lieux actifs récents (fallback auto) non déjà inclus
  auto_fill AS (
    SELECT v.id::bigint AS venue_id, 'auto'::text AS source
    FROM public.venues v
    WHERE v.is_active = true
      AND v.is_featured = false
      AND v.id NOT IN (SELECT venue_id FROM booked)
      AND v.id NOT IN (SELECT venue_id FROM featured)
    ORDER BY v.updated_at DESC
    LIMIT p_max
  ),
  combined AS (
    SELECT * FROM booked
    UNION ALL
    SELECT * FROM featured
    UNION ALL
    SELECT * FROM auto_fill
  )
  SELECT venue_id, source
  FROM combined
  LIMIT p_max;
$$;

-- 3. Fonction : retourne le lieu "Coup de projecteur" pour aujourd'hui dans une zone
--    Un seul lieu, celui qui a réservé le boost Explore
--    Fallback : le lieu is_featured le plus proche, sinon le plus récent dans le rayon
CREATE OR REPLACE FUNCTION public.get_spotlight_venue(
  p_lat double precision,
  p_lng double precision,
  p_date date DEFAULT CURRENT_DATE,
  p_radius_km double precision DEFAULT 15
)
RETURNS TABLE (
  venue_id bigint,
  source text,
  distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH distances AS (
    SELECT
      v.id::bigint AS venue_id,
      (
        6371 * acos(
          LEAST(1.0, cos(radians(p_lat)) * cos(radians(v.lat))
          * cos(radians(v.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(v.lat)))
        )
      ) AS distance_km
    FROM public.venues v
    WHERE v.is_active = true
      AND v.lat IS NOT NULL
      AND v.lng IS NOT NULL
  ),
  -- Lieu ayant réservé le boost Explore dans la zone
  booked AS (
    SELECT d.venue_id, 'booked'::text AS source, d.distance_km
    FROM public.explore_boost_bookings eb
    JOIN distances d ON d.venue_id = eb.venue_id::bigint
    WHERE eb.booked_date = p_date
      AND d.distance_km <= p_radius_km
    ORDER BY d.distance_km
    LIMIT 1
  ),
  -- Fallback : lieu featured le plus proche
  featured AS (
    SELECT d.venue_id, 'featured'::text AS source, d.distance_km
    FROM public.venues v
    JOIN distances d ON d.venue_id = v.id::bigint
    WHERE v.is_featured = true
      AND v.is_active = true
      AND d.distance_km <= p_radius_km
      AND NOT EXISTS (SELECT 1 FROM booked)
    ORDER BY d.distance_km
    LIMIT 1
  ),
  -- Fallback auto : lieu actif le plus récent dans la zone
  auto_fill AS (
    SELECT d.venue_id, 'auto'::text AS source, d.distance_km
    FROM public.venues v
    JOIN distances d ON d.venue_id = v.id::bigint
    WHERE v.is_active = true
      AND d.distance_km <= p_radius_km
      AND NOT EXISTS (SELECT 1 FROM booked)
      AND NOT EXISTS (SELECT 1 FROM featured)
    ORDER BY v.updated_at DESC
    LIMIT 1
  )
  SELECT * FROM booked
  UNION ALL
  SELECT * FROM featured
  UNION ALL
  SELECT * FROM auto_fill
  LIMIT 1;
$$;
