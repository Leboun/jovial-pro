import { supabase } from "./supabase";
import type { OpeningHours } from "../utils/openingHours";

export type BookingMode = "none" | "external" | "jovial";

export type VenueBookingActivity = {
  id: number;
  game_id: number;
  name: string;
  quantity: number;
  reservable_quantity: number;
  booking_mode: BookingMode;
  booking_url: string | null;
  booking_enabled: boolean;
  slot_duration_minutes: number;
  booking_capacity: number;
  booking_note: string | null;
  price_cents: number;
  currency: string;
  payment_required: boolean;
  is_featured: boolean;
};

export type GameOption = {
  id: number;
  name: string;
};

export type SlotOption = {
  start: Date;
  end: Date;
  label: string;
  available: boolean;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const parseTimeToMinutes = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  const match = trimmed.match(/^(\d{1,2})(?::|h)?(\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatSlotLabel = (date: Date) => {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}h${minutes}`;
};

const getDayKey = (date: Date) => DAY_KEYS[date.getDay()];

export async function syncVenueActivitiesSummary(venueId: number) {
  const rows = await fetchVenueBookingActivities(venueId);
  const featured = rows.filter((a): a is VenueBookingActivity => !!a && a.is_featured).map((a) => a.name.trim());
  const rest = rows.filter((a): a is VenueBookingActivity => !!a && !a.is_featured).map((a) => a.name.trim());
  const names = Array.from(new Set([...featured, ...rest])).filter(Boolean);

  const { error } = await supabase.from("venues").update({ activities: names }).eq("id", venueId);
  if (error) throw error;
}

const buildSlotsForDate = (
  openingHours: OpeningHours,
  date: Date,
  durationMinutes: number
): { start: Date; end: Date; label: string }[] => {
  const dayKey = getDayKey(date);
  const periods = openingHours?.[dayKey] ?? [];
  if (!Array.isArray(periods) || periods.length === 0) return [];

  const slots: { start: Date; end: Date; label: string }[] = [];
  periods.forEach((period) => {
    const openMinutes = parseTimeToMinutes(period?.open);
    const closeMinutes = parseTimeToMinutes(period?.close);
    if (openMinutes == null || closeMinutes == null) return;

    const endLimit = closeMinutes <= openMinutes ? 24 * 60 : closeMinutes;
    // Aligner le premier créneau sur le multiple suivant de durationMinutes (ex: 05h30 → 06h00)
    const firstSlot = openMinutes % durationMinutes === 0
      ? openMinutes
      : openMinutes + (durationMinutes - (openMinutes % durationMinutes));
    for (let start = firstSlot; start + durationMinutes <= endLimit; start += durationMinutes) {
      const startDate = new Date(date);
      startDate.setHours(Math.floor(start / 60), start % 60, 0, 0);
      const endDate = new Date(date);
      const endMinutes = start + durationMinutes;
      endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      slots.push({
        start: startDate,
        end: endDate,
        label: `${formatSlotLabel(startDate)} - ${formatSlotLabel(endDate)}`,
      });
    }
  });

  return slots;
};

export async function fetchVenueBookingActivities(venueId: number) {
  const { data, error } = await supabase
    .from("venue_games")
    .select(
      "id, game_id, quantity, booking_mode, booking_url, booking_enabled, slot_duration_minutes, booking_capacity, booking_note, price_cents, currency, payment_required, is_featured, games(name)"
    )
    .eq("venue_id", venueId);

  if (error) throw error;
  const clean =
    (data as any[] | null)
      ?.map((row) => {
        const name = String(row?.games?.name ?? "").trim();
        if (!name) return null;
        return {
          id: Number(row?.id),
          game_id: Number(row?.game_id),
          name,
          quantity: Number(row?.quantity ?? 0),
          reservable_quantity: Math.max(
            0,
            Number(row?.booking_enabled ?? false ? row?.booking_capacity ?? 1 : 0)
          ),
          booking_mode: (row?.booking_mode ?? "none") as BookingMode,
          booking_url: row?.booking_url ?? null,
          booking_enabled: Boolean(row?.booking_enabled ?? false),
          slot_duration_minutes: Number(row?.slot_duration_minutes ?? 60),
          booking_capacity: Number(row?.booking_capacity ?? 1),
          booking_note: row?.booking_note ?? null,
          price_cents: Number(row?.price_cents ?? 0),
          currency: String(row?.currency ?? "EUR"),
          payment_required: Boolean(row?.payment_required ?? false),
          is_featured: Boolean(row?.is_featured ?? false),
        } as VenueBookingActivity;
      })
      .filter(Boolean) ?? [];

  return clean;
}

export async function fetchGamesCatalog() {
  const { data, error } = await supabase.from("games").select("id, name").order("name", { ascending: true });
  if (error) throw error;
  return (
    (data as any[] | null)
      ?.map((row) => {
        const id = Number(row?.id);
        const name = String(row?.name ?? "").trim();
        if (!Number.isFinite(id) || !name) return null;
        return { id, name } satisfies GameOption;
      })
      .filter(Boolean) ?? []
  ) as GameOption[];
}

export async function upsertVenueBookingActivity(params: {
  venueId: number;
  activityId?: number | null;
  gameId: number;
  quantity: number;
  reservableQuantity: number;
  bookingEnabled: boolean;
  bookingMode: BookingMode;
  bookingUrl: string | null;
  paymentRequired: boolean;
  priceCents: number;
}) {
  const normalizedQuantity = Math.max(1, Math.trunc(params.quantity || 1));
  const normalizedReservableQuantity = params.bookingEnabled
    ? Math.max(1, Math.min(normalizedQuantity, Math.trunc(params.reservableQuantity || 1)))
    : 0;
  const payload = {
    venue_id: params.venueId,
    game_id: params.gameId,
    quantity: normalizedQuantity,
    booking_enabled: params.bookingEnabled,
    booking_mode: params.bookingMode,
    booking_url: params.bookingMode === "external" ? (params.bookingUrl?.trim() || null) : null,
    booking_capacity: normalizedReservableQuantity,
    payment_required: params.paymentRequired,
    price_cents: params.paymentRequired ? Math.max(0, Math.trunc(params.priceCents || 0)) : 0,
    currency: "EUR",
  };

  if (params.activityId) {
    const { error } = await supabase.from("venue_games").update(payload).eq("id", params.activityId);
    if (error) throw error;
    await syncVenueActivitiesSummary(params.venueId);
    return;
  }

  const { error } = await supabase.from("venue_games").insert(payload);
  if (error) throw error;
  await syncVenueActivitiesSummary(params.venueId);
}

export async function deleteVenueBookingActivity(activityId: number) {
  const { data, error } = await supabase
    .from("venue_games")
    .delete()
    .eq("id", activityId)
    .select("venue_id")
    .maybeSingle();
  if (error) throw error;

  const venueId = Number((data as { venue_id?: unknown } | null)?.venue_id);
  if (Number.isFinite(venueId)) {
    await syncVenueActivitiesSummary(venueId);
  }
}

export async function toggleActivityFeatured(
  activityId: number,
  venueId: number,
  newValue: boolean
): Promise<void> {
  const { error } = await supabase
    .from("venue_games")
    .update({ is_featured: newValue })
    .eq("id", activityId);
  if (error) throw error;
  await syncVenueActivitiesSummary(venueId);
}

export type VenueClosure = {
  id: number;
  venue_id: number;
  date_start: string;
  date_end: string;
  reason: string | null;
  created_at: string;
};

export type VenueBlackout = {
  id: number;
  venue_id: number;
  game_id: number;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  quantity_blocked: number | null;
};

export async function fetchVenueClosures(venueId: number): Promise<VenueClosure[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("venue_closures")
    .select("*")
    .eq("venue_id", venueId)
    .gte("date_end", today)
    .order("date_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VenueClosure[];
}

export async function addVenueClosure(
  venueId: number,
  dateStart: string,
  dateEnd: string,
  reason?: string | null
): Promise<void> {
  const { error } = await supabase.from("venue_closures").insert({
    venue_id: venueId,
    date_start: dateStart,
    date_end: dateEnd,
    reason: reason?.trim() || null,
  });
  if (error) throw error;
}

export async function deleteVenueClosure(id: number): Promise<void> {
  const { error } = await supabase.from("venue_closures").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchVenueBlackouts(venueId: number): Promise<VenueBlackout[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("venue_game_blackouts")
    .select("id, venue_id, game_id, starts_at, ends_at, reason, quantity_blocked")
    .eq("venue_id", venueId)
    .gte("ends_at", now)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VenueBlackout[];
}

export async function addVenueBlackout(
  venueId: number,
  gameId: number,
  startsAt: string,
  endsAt: string,
  reason?: string | null,
  quantityBlocked?: number | null
): Promise<number> {
  const { data, error } = await supabase
    .from("venue_game_blackouts")
    .insert({ venue_id: venueId, game_id: gameId, starts_at: startsAt, ends_at: endsAt, reason: reason?.trim() || null, quantity_blocked: quantityBlocked ?? null })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Number(data?.id);
}

export async function deleteVenueBlackout(id: number): Promise<void> {
  const { error } = await supabase.from("venue_game_blackouts").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchVenueOpeningHours(venueId: number) {
  const { data, error } = await supabase
    .from("venues")
    .select("opening_hours")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw error;
  return (data?.opening_hours ?? null) as OpeningHours | null;
}

export async function fetchAvailableSlots(
  venueId: number,
  gameId: number,
  date: Date,
  durationMinutes: number,
  capacity: number,
  openingHours: OpeningHours | null
): Promise<SlotOption[]> {
  if (!openingHours) return [];

  const slots = buildSlotsForDate(openingHours, date, durationMinutes);
  if (slots.length === 0) return [];

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const effectiveCapacity = Math.max(Number(capacity ?? 1), 1);

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const [
    { data: reservations, error },
    { data: blackouts, error: blackoutError },
    { data: closures, error: closureError },
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, starts_at, ends_at")
      .eq("venue_id", venueId)
      .eq("game_id", gameId)
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString()),
    supabase
      .from("venue_game_blackouts")
      .select("starts_at, ends_at")
      .eq("venue_id", venueId)
      .eq("game_id", gameId)
      .lte("starts_at", dayEnd.toISOString())
      .gte("ends_at", dayStart.toISOString()),
    supabase
      .from("venue_closures")
      .select("date_start, date_end")
      .eq("venue_id", venueId)
      .lte("date_start", dateStr)
      .gte("date_end", dateStr),
  ]);

  if (error) throw error;
  if (blackoutError) throw blackoutError;
  if (closureError) throw closureError;

  if ((closures ?? []).length > 0) return slots.map((slot) => ({ ...slot, available: false }));
  const list = (reservations as any[] | null) ?? [];
  const blackoutList = (blackouts as any[] | null) ?? [];

  return slots.map((slot) => {
    const overlaps = list.filter((row) => {
      const start = new Date(row.starts_at);
      const end = new Date(row.ends_at);
      return start < slot.end && end > slot.start;
    }).length;
    const blockedQty = blackoutList
      .filter((row) => {
        const start = new Date(row.starts_at);
        const end = new Date(row.ends_at);
        return start < slot.end && end > slot.start;
      })
      .reduce((sum, row) => sum + (row.quantity_blocked != null ? Number(row.quantity_blocked) : effectiveCapacity), 0);
    const remainingCapacity = Math.max(0, effectiveCapacity - blockedQty);
    return {
      start: slot.start,
      end: slot.end,
      label: slot.label,
      available: overlaps < remainingCapacity,
    };
  });
}

export async function createReservation(params: {
  venueId: number;
  gameId: number;
  startsAt: Date;
  endsAt: Date;
  contact_firstname: string;
  contact_lastname: string;
  contact_phone: string;
  contact_email: string;
  group_size: number;
  price_cents: number;
  currency: string;
  payment_required: boolean;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const { data, error } = await supabase.from("reservations").insert({
    user_id: userId,
    venue_id: params.venueId,
    game_id: params.gameId,
    starts_at: params.startsAt.toISOString(),
    ends_at: params.endsAt.toISOString(),
    contact_firstname: params.contact_firstname,
    contact_lastname: params.contact_lastname,
    contact_phone: params.contact_phone,
    contact_email: params.contact_email,
    group_size: params.group_size,
    price_cents: params.price_cents,
    currency: params.currency,
    status: "confirmed",
    payment_status: params.payment_required ? "unpaid" : "paid",
    source: "in_app",
  }).select("id").maybeSingle();

  if (error) throw error;

  // Notify venue via email (fire & forget — don't block on failure)
  const reservationId = (data as { id?: number } | null)?.id;
  if (reservationId) {
    supabase.functions.invoke("reservation-notify", { body: { reservation_id: reservationId } }).catch(() => {});
  }

  return data;
}
