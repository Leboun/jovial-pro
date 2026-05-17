import { supabase } from "./supabase";

export type BoostType = "explore" | "carousel";
export type CarouselVenueSource = "booked" | "featured" | "auto";
export type SpotlightVenueSource = "booked" | "featured" | "auto";

export type CarouselVenue = {
  venue_id: number;
  source: CarouselVenueSource;
};

export type SpotlightVenue = {
  venue_id: number;
  source: SpotlightVenueSource;
  distance_km: number;
};

// Retourne les venues du carrousel du jour (max 4, avec fallback éditorial/auto)
export async function getCarouselVenues(lat: number, lng: number, date?: string): Promise<CarouselVenue[]> {
  const { data, error } = await supabase.rpc("get_carousel_venues", {
    p_lat: lat,
    p_lng: lng,
    p_date: date ?? new Date().toISOString().split("T")[0],
    p_max: 4,
  });
  if (error) throw error;
  return (data ?? []) as CarouselVenue[];
}

// Retourne le lieu "Coup de projecteur" du jour dans une zone
export async function getSpotlightVenue(
  lat: number,
  lng: number,
  date?: string
): Promise<SpotlightVenue | null> {
  const { data, error } = await supabase.rpc("get_spotlight_venue", {
    p_lat: lat,
    p_lng: lng,
    p_date: date ?? new Date().toISOString().split("T")[0],
    p_radius_km: 15,
  });
  if (error) throw error;
  return (data?.[0] ?? null) as SpotlightVenue | null;
}

export type ExploreBooking = {
  id: number;
  venue_id: number;
  booked_date: string;
  created_at: string;
};

export type CarouselBooking = {
  id: number;
  venue_id: number;
  booked_date: string;
  created_at: string;
};

// Dates déjà réservées pour le carrousel (toutes zones confondues)
export async function getCarouselBookedDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from("carousel_boost_bookings")
    .select("booked_date")
    .gte("booked_date", new Date().toISOString().split("T")[0]);
  if (error) throw error;
  return (data ?? []).map((r) => r.booked_date);
}

// Dates réservées par cet établissement (carrousel) — booked_date = lundi de la semaine
export async function getMyCarouselBookings(venueId: number): Promise<CarouselBooking[]> {
  // On récupère les semaines dont le dimanche (booked_date + 6j) est >= aujourd'hui
  const sixDaysAgo = new Date();
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  const { data, error } = await supabase
    .from("carousel_boost_bookings")
    .select("*")
    .eq("venue_id", venueId)
    .gte("booked_date", sixDaysAgo.toISOString().split("T")[0])
    .order("booked_date");
  if (error) throw error;
  return data ?? [];
}

// Dates indisponibles pour Explore dans la zone de cet établissement
export async function getExploreUnavailableDates(
  venueLat: number,
  venueLng: number,
  excludeVenueId?: number
): Promise<string[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("explore_boost_bookings")
    .select("booked_date, venue_lat, venue_lng, venue_id")
    .gte("booked_date", today);
  if (error) throw error;

  return (data ?? [])
    .filter((row) => {
      if (excludeVenueId && row.venue_id === excludeVenueId) return false;
      const dist = haversineKm(venueLat, venueLng, row.venue_lat, row.venue_lng);
      return dist <= 15;
    })
    .map((row) => row.booked_date);
}

// Dates réservées par cet établissement (Explore)
export async function getMyExploreBookings(venueId: number): Promise<ExploreBooking[]> {
  const { data, error } = await supabase
    .from("explore_boost_bookings")
    .select("*")
    .eq("venue_id", venueId)
    .gte("booked_date", new Date().toISOString().split("T")[0])
    .order("booked_date");
  if (error) throw error;
  return data ?? [];
}

// Réserver une date Explore
export async function bookExploreDate(
  venueId: number,
  date: string,
  venueLat: number,
  venueLng: number
): Promise<{ ok: boolean; error?: string }> {
  // Vérifier côté serveur via la fonction SQL
  const { data: available } = await supabase.rpc("is_explore_date_available", {
    p_date: date,
    p_lat: venueLat,
    p_lng: venueLng,
    p_exclude_venue_id: venueId,
  });

  if (!available) {
    return { ok: false, error: "Cette date est déjà prise dans ta zone." };
  }

  const { error } = await supabase.from("explore_boost_bookings").insert({
    venue_id: venueId,
    booked_date: date,
    venue_lat: venueLat,
    venue_lng: venueLng,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function getMondayOfDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().split("T")[0];
}

// Réserver une semaine Carrousel — on stocke toujours le lundi
export async function bookCarouselDate(
  venueId: number,
  date: string
): Promise<{ ok: boolean; error?: string }> {
  const monday = getMondayOfDate(date);
  const { error } = await supabase.from("carousel_boost_bookings").insert({
    venue_id: venueId,
    booked_date: monday,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Tu as déjà réservé cette date." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// Annuler une réservation
export async function cancelBooking(
  type: BoostType,
  bookingId: number
): Promise<{ ok: boolean; error?: string }> {
  const table = type === "explore" ? "explore_boost_bookings" : "carousel_boost_bookings";
  const { error } = await supabase.from(table).delete().eq("id", bookingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
