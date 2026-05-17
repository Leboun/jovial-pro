-- Réservations Boost Explore (un seul établissement par jour par zone 15km)
CREATE TABLE public.explore_boost_bookings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  venue_id integer NOT NULL,
  booked_date date NOT NULL,
  venue_lat double precision NOT NULL,
  venue_lng double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT explore_boost_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT explore_boost_bookings_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id)
);

-- Index pour la vérification de conflit géographique rapide
CREATE INDEX idx_explore_boost_bookings_date ON public.explore_boost_bookings (booked_date);

-- Réservations Carrousel "Top lieux" (plusieurs établissements autorisés par date)
CREATE TABLE public.carousel_boost_bookings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  venue_id integer NOT NULL,
  booked_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT carousel_boost_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT carousel_boost_bookings_venue_id_date UNIQUE (venue_id, booked_date),
  CONSTRAINT carousel_boost_bookings_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id)
);

CREATE INDEX idx_carousel_boost_bookings_date ON public.carousel_boost_bookings (booked_date);

-- Fonction : vérifie si une date Explore est disponible dans un rayon de 15km
-- Retourne true si libre, false si pris
CREATE OR REPLACE FUNCTION public.is_explore_date_available(
  p_date date,
  p_lat double precision,
  p_lng double precision,
  p_exclude_venue_id integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.explore_boost_bookings b
    WHERE b.booked_date = p_date
      AND (p_exclude_venue_id IS NULL OR b.venue_id <> p_exclude_venue_id)
      AND (
        6371 * acos(
          cos(radians(p_lat)) * cos(radians(b.venue_lat))
          * cos(radians(b.venue_lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(b.venue_lat))
        )
      ) <= 15
  );
$$;

-- RLS
ALTER TABLE public.explore_boost_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_boost_bookings ENABLE ROW LEVEL SECURITY;

-- Les établissements peuvent voir toutes les dates (sans voir qui a réservé)
CREATE POLICY "explore_boost_read" ON public.explore_boost_bookings
  FOR SELECT USING (true);

CREATE POLICY "carousel_boost_read" ON public.carousel_boost_bookings
  FOR SELECT USING (true);

-- Les établissements ne peuvent insérer que pour leur propre venue
CREATE POLICY "explore_boost_insert" ON public.explore_boost_bookings
  FOR INSERT WITH CHECK (
    venue_id IN (
      SELECT id FROM public.venues WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "carousel_boost_insert" ON public.carousel_boost_bookings
  FOR INSERT WITH CHECK (
    venue_id IN (
      SELECT id FROM public.venues WHERE owner_user_id = auth.uid()
    )
  );

-- Les établissements peuvent annuler leurs propres réservations futures
CREATE POLICY "explore_boost_delete" ON public.explore_boost_bookings
  FOR DELETE USING (
    venue_id IN (
      SELECT id FROM public.venues WHERE owner_user_id = auth.uid()
    )
    AND booked_date > CURRENT_DATE
  );

CREATE POLICY "carousel_boost_delete" ON public.carousel_boost_bookings
  FOR DELETE USING (
    venue_id IN (
      SELECT id FROM public.venues WHERE owner_user_id = auth.uid()
    )
    AND booked_date > CURRENT_DATE
  );
