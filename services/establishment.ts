import { supabase } from "./supabase";

import {
  ESTABLISHMENT_PREVIEW_VENUE_ID,
  isEstablishmentPreviewRuntimeEnabled,
} from "@/constants/establishmentPreview";
import { STUB_ESTABLISHMENT_CITY, STUB_ESTABLISHMENT_NAME } from "@/constants/jovialProOnboarding";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export type EstablishmentProfile = {
  id: number;
  owner_user_id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  description: string | null;
  contact: string | null;
  instagram_url: string | null;
  website_url: string | null;
  phone: string | null;
  social_platform: "instagram" | "facebook" | null;
  social_url: string | null;
  cover_url: string | null;
  logo_url: string | null;
  pin_emoji: string | null;
  pro_notes: string | null;
  photos: string[] | null;
  opening_hours: Record<string, { open: string; close: string }[]> | null;
  timezone: string | null;
  activities: string[] | null;
  tags: string[] | null;
  venue_type: string | null;
  venue_ambiance: string[] | null;
  service_tags: string[] | null;
  food_tags: string[] | null;
  payment_tags: string[] | null;
  darts_targets_count: number | null;
  lat: number | null;
  lng: number | null;
};

export type EstablishmentEvent = {
  id: number;
  venue_id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  category_id: number | null;
  is_published: boolean;
  is_pinned?: boolean;
};

export type EventParticipant = {
  user_id: string;
  status: "interested" | "going";
  firstname: string | null;
  lastname: string | null;
  handle: string | null;
  avatar_url: string | null;
};

export type EstablishmentSubscription = {
  id: number;
  venue_id: number;
  plan: "visibilite" | "rayonnement" | "pro";
  status: "active" | "past_due" | "canceled";
  current_period_end: string | null;
  events_quota_year: number | null;
  events_used_year: number;
  tournaments_used_year?: number | null;
  boosts_used_year?: number | null;
  local_spotlight_used_year?: number | null;
  targeted_notifications_used_year?: number | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
};

export type SubscriptionPlan = {
  id: number;
  code: "visibilite" | "rayonnement" | "pro";
  name: string;
  price_cents: number;
  event_quota: number | null;
  tags_limit: number | null;
  tournaments_quota_year: number | null;
  boosts_quota_year: number | null;
  local_spotlight_quota_year: number | null;
  targeted_notifications_quota_year: number | null;
  has_reminders: boolean;
  has_club_jovial: boolean;
  has_analytics: boolean;
  active: boolean;
};

export type SubscriptionPlanPrice = {
  id: number;
  plan_id: number;
  interval: "month" | "year";
  price_cents: number;
  stripe_price_id: string | null;
  active: boolean;
};

const PREVIEW_VENUE_ID = ESTABLISHMENT_PREVIEW_VENUE_ID;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
let previewEstablishment: EstablishmentProfile | null = null;
let previewEvents: EstablishmentEvent[] = [];
let previewSubscription: EstablishmentSubscription | null = null;
const ESTABLISHMENT_SELECT =
  "id, owner_user_id, name, city, address, postcode, description, contact, instagram_url, website_url, phone, social_platform, social_url, cover_url, logo_url, pin_emoji, pro_notes, photos, opening_hours, timezone, activities, tags, venue_type, venue_ambiance, service_tags, food_tags, payment_tags, darts_targets_count, lat, lng";
const SUBSCRIPTION_SELECT =
  "id, venue_id, plan, status, current_period_end, events_quota_year, events_used_year, tournaments_used_year, boosts_used_year, local_spotlight_used_year, targeted_notifications_used_year, stripe_customer_id, stripe_subscription_id, stripe_price_id";

export type PreparedUploadImage = {
  uri: string;
  contentType: string;
  extension: string;
};

const ensurePreviewState = (userId: string) => {
  if (!isEstablishmentPreviewRuntimeEnabled()) return;

  if (!previewEstablishment || previewEstablishment.owner_user_id !== userId) {
    previewEstablishment = {
      id: PREVIEW_VENUE_ID,
      owner_user_id: userId,
      name: "Le QG Jovial",
      city: "Brest",
      address: "12 rue de la Paix",
      postcode: "29200",
      description: "Espace de prévisualisation pour tester les écrans.",
      contact: "02 98 00 00 00",
      instagram_url: "https://instagram.com/jovial.app",
      website_url: "https://jovial.app",
      phone: "02 98 00 00 00",
      social_platform: "facebook",
      social_url: "https://facebook.com/jovial.app",
      cover_url: null,
      logo_url: null,
      pin_emoji: null,
      pro_notes: null,
      photos: [],
      opening_hours: {
        thu: [{ open: "18:00", close: "01:00" }],
        fri: [{ open: "18:00", close: "02:00" }],
        sat: [{ open: "18:00", close: "02:00" }],
      },
      timezone: "Europe/Paris",
      activities: ["Karaoke", "Blind Test", "Quiz"],
      tags: ["Cocktail bar", "Afterwork"],
      venue_type: "Bar à cocktails",
      venue_ambiance: ["Festif", "Animé"],
      service_tags: ["Wi-Fi", "Terrasse", "Happy Hour"],
      food_tags: null,
      payment_tags: null,
      darts_targets_count: 2,
      lat: 48.3904,
      lng: -4.4861,
    };
  }

  if (!previewSubscription) {
    const periodEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    previewSubscription = {
      id: 1,
      venue_id: PREVIEW_VENUE_ID,
      plan: "pro" as const,
      status: "active" as const,
      current_period_end: periodEnd,
      events_quota_year: null,
      events_used_year: 3,
      tournaments_used_year: 1,
      boosts_used_year: 0,
      local_spotlight_used_year: 0,
      targeted_notifications_used_year: 0,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
    };
  }

  if (previewEvents.length === 0) {
    previewEvents = [
      {
        id: 101,
        venue_id: PREVIEW_VENUE_ID,
        title: "Soirée quiz & cocktails",
        description: "Un quiz musical suivi d'un blind test convivial.",
        starts_at: "2026-02-20T19:30:00.000Z",
        ends_at: "2026-02-20T23:30:00.000Z",
        cover_url: null,
        category_id: 2,
        is_published: true,
      },
      {
        id: 102,
        venue_id: PREVIEW_VENUE_ID,
        title: "Afterwork DJ set",
        description: "DJ set électro/lounge pour finir la semaine.",
        starts_at: "2026-02-27T18:30:00.000Z",
        ends_at: "2026-02-27T23:59:00.000Z",
        cover_url: null,
        category_id: 3,
        is_published: false,
      },
    ];
  }
};

const buildPreviewSubscription = (venueId: number) => {
  const periodEnd =
    previewSubscription?.current_period_end ??
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  return {
    id: previewSubscription?.id ?? 1,
    venue_id: venueId,
    plan: previewSubscription?.plan ?? "pro",
    status: previewSubscription?.status ?? "active",
    current_period_end: periodEnd,
    events_quota_year: previewSubscription?.events_quota_year ?? null,
    events_used_year: previewSubscription?.events_used_year ?? 3,
    tournaments_used_year: previewSubscription?.tournaments_used_year ?? 1,
    boosts_used_year: previewSubscription?.boosts_used_year ?? 0,
    local_spotlight_used_year: previewSubscription?.local_spotlight_used_year ?? 0,
    targeted_notifications_used_year: previewSubscription?.targeted_notifications_used_year ?? 0,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
  } satisfies EstablishmentSubscription;
};

const isPreviewVenue = (venueId: number) =>
  isEstablishmentPreviewRuntimeEnabled() && venueId === PREVIEW_VENUE_ID;

async function ensurePreviewEventsForVenue(venueId: number) {
  if (!isEstablishmentPreviewRuntimeEnabled() || previewEvents.length === 0) return;

  const { data: existingEvents, error: existingEventsError } = await supabase
    .from("events")
    .select("id")
    .eq("venue_id", venueId)
    .limit(1);

  if (existingEventsError) throw existingEventsError;
  if ((existingEvents ?? []).length > 0) return;

  const payload = previewEvents.map((event) => ({
    venue_id: venueId,
    title: event.title,
    description: event.description,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    cover_url: event.cover_url,
    category_id: event.category_id,
    is_published: event.is_published,
  }));

  const { error } = await supabase.from("events").insert(payload);
  if (error) throw error;
}

async function ensurePreviewSubscriptionForVenue(venueId: number) {
  const fallback = buildPreviewSubscription(venueId);
  const { data: existing, error: existingError } = await supabase
    .from("establishment_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as EstablishmentSubscription;

  const { data, error } = await supabase
    .from("establishment_subscriptions")
    .insert({
      venue_id: venueId,
      plan: fallback.plan,
      status: fallback.status,
      current_period_end: fallback.current_period_end,
      events_quota_year: fallback.events_quota_year,
      events_used_year: fallback.events_used_year,
      tournaments_used_year: fallback.tournaments_used_year ?? 0,
      boosts_used_year: fallback.boosts_used_year ?? 0,
      local_spotlight_used_year: fallback.local_spotlight_used_year ?? 0,
      targeted_notifications_used_year: fallback.targeted_notifications_used_year ?? 0,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
    })
    .select(SUBSCRIPTION_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data as EstablishmentSubscription | null;
}

async function ensurePreviewBackOfficeSynced(userId: string) {
  if (!isEstablishmentPreviewRuntimeEnabled()) return null;

  ensurePreviewState(userId);
  if (!previewEstablishment) return null;

  const existing = await fetchRealVenueByOwner(userId);
  if (existing) {
    try {
      await ensurePreviewEventsForVenue(existing.id);
    } catch {
      // Keep the real venue even if the seed events fail.
    }
    try {
      await ensurePreviewSubscriptionForVenue(existing.id);
    } catch {
      // Subscription insert can be blocked by policies in some environments.
    }
    return existing;
  }

  await setProfileRole(
    userId,
    "establishment",
    previewEstablishment.city ?? STUB_ESTABLISHMENT_CITY
  );

  const created = await createMyEstablishment({
    userId,
    name: previewEstablishment.name ?? STUB_ESTABLISHMENT_NAME,
    city: previewEstablishment.city,
    address: previewEstablishment.address,
    description: previewEstablishment.description,
    phone: previewEstablishment.phone,
    website_url: previewEstablishment.website_url,
    instagram_url: previewEstablishment.instagram_url,
    timezone: previewEstablishment.timezone,
  });

  if (!created) return null;

  const enriched =
    (await updateMyEstablishment(created.id, {
      postcode: previewEstablishment.postcode,
      contact: previewEstablishment.contact,
      phone: previewEstablishment.phone,
      social_platform: previewEstablishment.social_platform,
      social_url: previewEstablishment.social_url,
      cover_url: previewEstablishment.cover_url,
      photos: previewEstablishment.photos,
      opening_hours: previewEstablishment.opening_hours,
      activities: previewEstablishment.activities,
      tags: previewEstablishment.tags,
      darts_targets_count: previewEstablishment.darts_targets_count,
      lat: previewEstablishment.lat,
      lng: previewEstablishment.lng,
    })) ?? created;

  try {
    await ensurePreviewEventsForVenue(enriched.id);
  } catch {
    // Non-blocking: the venue must still exist in Supabase.
  }
  try {
    await ensurePreviewSubscriptionForVenue(enriched.id);
  } catch {
    // Non-blocking: local preview can still provide a dev subscription fallback.
  }

  return enriched;
}

export async function getMyEstablishment(userId: string) {
  const previewEnabled = isEstablishmentPreviewRuntimeEnabled();
  const { data, error } = await supabase
    .from("venues")
    .select(ESTABLISHMENT_SELECT)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    if (previewEnabled) {
      return ensurePreviewBackOfficeSynced(userId);
    }
    throw error;
  }
  if (data) return data as EstablishmentProfile;
  if (previewEnabled) {
    return ensurePreviewBackOfficeSynced(userId);
  }
  return null;
}

export async function getBackOfficeEstablishment(userId: string) {
  try {
    const existing = await getMyEstablishment(userId);
    if (existing) return existing;
  } catch {
    if (!isEstablishmentPreviewRuntimeEnabled()) {
      throw new Error("Impossible de charger l'etablissement.");
    }
  }

  try {
    const ensured = await ensureStubEstablishmentForPro(userId);
    if (ensured) return ensured;
  } catch {
    if (!isEstablishmentPreviewRuntimeEnabled()) {
      throw new Error("Impossible de preparer l'etablissement.");
    }
  }

  if (isEstablishmentPreviewRuntimeEnabled()) {
    return ensurePreviewBackOfficeSynced(userId);
  }

  return null;
}

/** Lecture directe en base, sans fallback « preview » (paiement, onboarding). */
export async function fetchRealVenueByOwner(userId: string): Promise<EstablishmentProfile | null> {
  const { data, error } = await supabase
    .from("venues")
    .select(ESTABLISHMENT_SELECT)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as EstablishmentProfile | null) ?? null;
}

/**
 * Garantit une ligne `venues` pour l’utilisateur (nécessaire pour lier un abonnement Stripe).
 * Ne remplace pas un établissement déjà créé par l’utilisateur.
 */
export async function ensureStubEstablishmentForPro(userId: string): Promise<EstablishmentProfile | null> {
  if (isEstablishmentPreviewRuntimeEnabled()) {
    return ensurePreviewBackOfficeSynced(userId);
  }

  const existing = await fetchRealVenueByOwner(userId);
  if (existing) return existing;

  await setProfileRole(userId, "establishment", STUB_ESTABLISHMENT_CITY);
  await createMyEstablishment({
    userId,
    name: STUB_ESTABLISHMENT_NAME,
    city: STUB_ESTABLISHMENT_CITY,
    address: "—",
    description: null,
    phone: null,
    website_url: null,
    instagram_url: null,
    timezone: "Europe/Paris",
  });

  return fetchRealVenueByOwner(userId);
}

export async function updateMyEstablishment(id: number, patch: Partial<EstablishmentProfile>) {
  if (isPreviewVenue(id)) {
    if (!previewEstablishment) {
      throw new Error("Mode preview indisponible.");
    }
    previewEstablishment = {
      ...previewEstablishment,
      ...patch,
      id: previewEstablishment.id,
      owner_user_id: previewEstablishment.owner_user_id,
    };
    return previewEstablishment;
  }

  const { data, error } = await supabase
    .from("venues")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EstablishmentProfile | null;
}

export async function createMyEstablishment(input: {
  userId: string;
  name: string;
  city?: string | null;
  address?: string | null;
  description?: string | null;
  phone?: string | null;
  website_url?: string | null;
  instagram_url?: string | null;
  timezone?: string | null;
}) {
  const { data: existing, error: existingError } = await supabase
    .from("venues")
    .select(ESTABLISHMENT_SELECT)
    .eq("owner_user_id", input.userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as EstablishmentProfile;

  const payload = {
    owner_user_id: input.userId,
    name: input.name.trim(),
    city: input.city?.trim() || null,
    address: input.address?.trim() || null,
    postcode: null,
    description: input.description?.trim() || null,
    contact: input.phone?.trim() || null,
    phone: input.phone?.trim() || null,
    website_url: input.website_url?.trim() || null,
    instagram_url: input.instagram_url?.trim() || null,
    social_platform: null,
    social_url: null,
    timezone: input.timezone?.trim() || "Europe/Paris",
    activities: [] as string[],
    tags: [] as string[],
    lat: null,
    lng: null,
    is_active: true,
  };

  const { data, error } = await supabase.from("venues").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data as EstablishmentProfile | null;
}

export async function setProfileRole(userId: string, role: "user" | "establishment", city?: string | null) {
  const patch = {
    user_id: userId,
    role,
    city: city?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", userId)
    .select("user_id, role")
    .maybeSingle();

  if (error) throw error;
  if (data) {
    return data as { user_id: string; role: "user" | "establishment" } | null;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .upsert({
      ...patch,
      created_at: new Date().toISOString(),
    })
    .select("user_id, role")
    .maybeSingle();

  if (insertError) throw insertError;
  return inserted as { user_id: string; role: "user" | "establishment" } | null;
}

export type EventCategory = { id: number; name: string };

export async function fetchEventCategories(): Promise<EventCategory[]> {
  const { data, error } = await supabase
    .from("event_categories")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventCategory[];
}

export async function listMyEvents(venueId: number) {
  if (isPreviewVenue(venueId)) {
    return [...previewEvents].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, venue_id, title, description, starts_at, ends_at, cover_url, category_id, is_published, is_pinned"
    )
    .eq("venue_id", venueId)
    .order("is_pinned", { ascending: false })
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const rawCategoryId = row?.category_id;
    const parsedCategoryId = rawCategoryId == null ? null : Number(rawCategoryId);
    return {
      ...row,
      category_id: Number.isFinite(parsedCategoryId) ? parsedCategoryId : null,
    } as EstablishmentEvent;
  });
}

export async function getEventById(eventId: number) {
  const previewEvent = previewEvents.find((event) => event.id === eventId) ?? null;
  if (previewEvent) {
    return previewEvent;
  }

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, venue_id, title, description, starts_at, ends_at, cover_url, category_id, is_published"
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const rawCategoryId = (data as any)?.category_id;
  const parsedCategoryId = rawCategoryId == null ? null : Number(rawCategoryId);
  return {
    ...(data as EstablishmentEvent),
    category_id: Number.isFinite(parsedCategoryId) ? parsedCategoryId : null,
  };
}

export async function getSubscription(venueId: number) {
  if (isPreviewVenue(venueId)) {
    ensurePreviewState(previewEstablishment?.owner_user_id ?? "preview-user");
    return previewSubscription;
  }

  const { data, error } = await supabase
    .from("establishment_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error) {
    if (isEstablishmentPreviewRuntimeEnabled()) {
      return buildPreviewSubscription(venueId);
    }
    throw error;
  }
  if (data) return data as EstablishmentSubscription | null;
  if (isEstablishmentPreviewRuntimeEnabled()) {
    try {
      const seeded = await ensurePreviewSubscriptionForVenue(venueId);
      if (seeded) return seeded;
    } catch {
      return buildPreviewSubscription(venueId);
    }
    return buildPreviewSubscription(venueId);
  }
  return null;
}

export async function listSubscriptionPlans() {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(
      "id, code, name, price_cents, event_quota, tags_limit, tournaments_quota_year, boosts_quota_year, local_spotlight_quota_year, active"
    )
    .eq("active", true)
    .order("price_cents", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SubscriptionPlan[];
}

export async function listSubscriptionPlanPrices() {
  const { data, error } = await supabase
    .from("subscription_plan_prices")
    .select("id, plan_id, interval, price_cents, stripe_price_id, active")
    .eq("active", true);

  if (error) throw error;
  return (data ?? []) as SubscriptionPlanPrice[];
}

export async function createEvent(event: Omit<EstablishmentEvent, "id">) {
  if (isPreviewVenue(event.venue_id)) {
    const nextId = previewEvents.reduce((maxId, current) => Math.max(maxId, current.id), 100) + 1;
    const createdEvent: EstablishmentEvent = { ...event, id: nextId };
    previewEvents = [...previewEvents, createdEvent].sort((a, b) =>
      a.starts_at.localeCompare(b.starts_at)
    );
    return createdEvent;
  }

  const { data, error } = await supabase.from("events").insert(event).select().maybeSingle();
  if (error) throw error;
  return data as EstablishmentEvent | null;
}

export async function updateEvent(eventId: number, patch: Partial<EstablishmentEvent>) {
  const previewIndex = previewEvents.findIndex((event) => event.id === eventId);
  if (previewIndex >= 0) {
    const current = previewEvents[previewIndex];
    const updated: EstablishmentEvent = {
      ...current,
      ...patch,
      id: current.id,
      venue_id: current.venue_id,
    };
    previewEvents = previewEvents.map((event) => (event.id === eventId ? updated : event)).sort(
      (a, b) => a.starts_at.localeCompare(b.starts_at)
    );
    return updated;
  }

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as EstablishmentEvent | null;
}

export async function deleteEvent(eventId: number) {
  const previewIndex = previewEvents.findIndex((e) => e.id === eventId);
  if (previewIndex >= 0) {
    previewEvents = previewEvents.filter((e) => e.id !== eventId);
    return;
  }
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function togglePinEvent(eventId: number, pinned: boolean) {
  return updateEvent(eventId, { is_pinned: pinned });
}

export async function listEventParticipants(eventId: number) {
  const { data: rsvpData, error: rsvpError } = await supabase
    .from("rsvps")
    .select("user_id, status")
    .eq("event_id", eventId);

  if (rsvpError) throw rsvpError;

  const rows = ((rsvpData ?? []) as { user_id?: unknown; status?: unknown }[])
    .map((row) => {
      const userId = typeof row.user_id === "string" ? row.user_id : null;
      const status = row.status === "interested" || row.status === "going" ? row.status : null;
      if (!userId || !status) return null;
      return { user_id: userId, status };
    })
    .filter(Boolean) as { user_id: string; status: "interested" | "going" }[];

  if (rows.length === 0) return [] as EventParticipant[];

  let profilesByUserId = new Map<
    string,
    Pick<EventParticipant, "firstname" | "lastname" | "handle" | "avatar_url">
  >();

  try {
    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, firstname, lastname, handle, avatar_url")
      .in("user_id", userIds);

    if (profilesError) throw profilesError;

    profilesByUserId = new Map(
      ((profilesData ?? []) as {
        user_id?: unknown;
        firstname?: unknown;
        lastname?: unknown;
        handle?: unknown;
        avatar_url?: unknown;
      }[])
        .map((row) => {
          const userId = typeof row.user_id === "string" ? row.user_id : null;
          if (!userId) return null;
          return [
            userId,
            {
              firstname: typeof row.firstname === "string" ? row.firstname : null,
              lastname: typeof row.lastname === "string" ? row.lastname : null,
              handle: typeof row.handle === "string" ? row.handle : null,
              avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
            },
          ] as const;
        })
        .filter(Boolean) as [string, Pick<EventParticipant, "firstname" | "lastname" | "handle" | "avatar_url">][]
    );
  } catch {
    profilesByUserId = new Map();
  }

  return rows
    .map((row) => {
      const profile = profilesByUserId.get(row.user_id);
      return {
        user_id: row.user_id,
        status: row.status,
        firstname: profile?.firstname ?? null,
        lastname: profile?.lastname ?? null,
        handle: profile?.handle ?? null,
        avatar_url: profile?.avatar_url ?? null,
      } satisfies EventParticipant;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "going" ? -1 : 1;
      const nameA = `${a.firstname ?? ""} ${a.lastname ?? ""} ${a.handle ?? ""}`.trim().toLowerCase();
      const nameB = `${b.firstname ?? ""} ${b.lastname ?? ""} ${b.handle ?? ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
}

export async function incrementEventsUsed(venueId: number, nextValue: number) {
  if (isPreviewVenue(venueId)) {
    if (previewSubscription) {
      previewSubscription = {
        ...previewSubscription,
        events_used_year: nextValue,
      };
    }
    return;
  }

  const { error } = await supabase
    .from("establishment_subscriptions")
    .update({ events_used_year: nextValue })
    .eq("venue_id", venueId);

  if (error) throw error;
}

export async function pickAndPrepareImage(options?: {
  targetWidth?: number;
  quality?: number;
}) {
  const picker = await import("expo-image-picker");
  if (Platform.OS !== "web") {
    const permission = await picker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Autorise l'acces a tes photos.");
    }
  }

  const result = await picker.launchImageLibraryAsync({
    mediaTypes: picker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: options?.quality ?? 0.85,
    base64: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  let uri = asset.uri;
  if (uri.startsWith("ph://") && asset.assetId) {
    try {
      const media = await import("expo-media-library");
      const info = await media.getAssetInfoAsync(asset.assetId);
      if (info.localUri) uri = info.localUri;
    } catch {
      // Keep the original URI and let the next step produce the final error.
    }
  }

  const manipulator = await import("expo-image-manipulator");
  const processed = await manipulator.manipulateAsync(
    uri,
    [{ resize: { width: options?.targetWidth ?? 1600 } }],
    { compress: options?.quality ?? 0.85, format: manipulator.SaveFormat.JPEG }
  );

  if (!processed.uri) {
    throw new Error("Impossible de preparer l'image selectionnee.");
  }

  return {
    uri: processed.uri,
    contentType: "image/jpeg",
    extension: "jpg",
  } satisfies PreparedUploadImage;
}

export async function uploadImage(params: {
  bucket: string;
  path: string;
  uri: string;
  contentType?: string;
}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Configuration Supabase manquante.");
  }

  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token ?? null;
  if (!accessToken) {
    throw new Error("Session expiree. Reconnecte-toi.");
  }

  const cleanPath = params.path.replace(/^\/+/, "");
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${params.bucket}/${cleanPath}`;
  let uploadStatus = 0;
  let uploadBody = "";

  if (Platform.OS === "web") {
    const fileResponse = await fetch(params.uri);
    if (!fileResponse.ok) {
      throw new Error("Impossible de lire l'image selectionnee.");
    }

    const blob = await fileResponse.blob();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": params.contentType ?? "image/jpeg",
        "x-upsert": "true",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: blob,
    });

    uploadStatus = response.status;
    uploadBody = await response.text();
  } else {
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, params.uri, {
      httpMethod: "POST",
      headers: {
        "Content-Type": params.contentType ?? "image/jpeg",
        "x-upsert": "true",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    uploadStatus = uploadResult.status;
    uploadBody = uploadResult.body;
  }

  if (uploadStatus < 200 || uploadStatus >= 300) {
    throw new Error(`Upload echoue (${uploadStatus}). ${uploadBody}`);
  }

  const { data } = supabase.storage.from(params.bucket).getPublicUrl(cleanPath);
  return data.publicUrl;
}
