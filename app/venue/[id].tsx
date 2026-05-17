// mobile/app/venue/[id].tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/services/supabase";
import { useIsPremium } from "@/hooks/useIsPremium";
import { findDemoVenueById } from "@/services/demoVenues";
import { getOpeningStatus, type OpeningHours } from "@/utils/openingHours";
import {
  createReservation,
  fetchAvailableSlots,
  fetchVenueBookingActivities,
  fetchVenueClosures,
  type SlotOption,
  type VenueClosure,
  type VenueBookingActivity,
} from "@/services/bookings";
import {
  PERK_FREQUENCY_LABELS,
  type VenuePerk,
  checkPerkAvailability,
  fetchActiveVenuePerks,
  isUserPremium,
} from "@/services/perks";
import { useAuth } from "@/providers/AuthProvider";
import { StatusBar } from "expo-status-bar";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import * as Calendar from "expo-calendar";

type SocialPlatform = "instagram" | "facebook";

type Venue = {
  id: number | string;
  name: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  contact: string | null;
  description: string | null;
  venue_type: string | null;
  venue_ambiance: string[] | null;
  service_tags: string[] | null;

  social_platform: SocialPlatform | null;
  social_url: string | null;

  cover_url: string | null;
  photos: string[] | null;
  lat: number | null;
  lng: number | null;
  opening_hours: OpeningHours | null;
  timezone: string | null;
};

type VenueActivity = {
  id: number;
  game_id: number;
  name: string;
  quantity: number;
  reservable_quantity: number;
  booking_mode: "none" | "external" | "jovial";
  booking_url: string | null;
  booking_enabled: boolean;
  slot_duration_minutes: number;
  booking_capacity: number;
  booking_note: string | null;
  price_cents: number;
  currency: string;
  payment_required: boolean;
};

type VenueEvent = {
  id: number;
  title: string;
  starts_at: string;
  cover_url: string | null;
  is_pinned?: boolean;
};

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80";
const PHOTO_SIDE_PADDING = 0;
const PHOTO_WIDTH = Dimensions.get("window").width - PHOTO_SIDE_PADDING * 2;

function isHttpUrlString(v: string) {
  return /^https?:\/\//i.test(v.trim());
}

function normalizeSocialUrl(type: SocialPlatform, raw?: string | null) {
  const v = (raw ?? "").trim();
  if (!v) return "";

  if (isHttpUrlString(v)) return v;

  const handle = v.replace(/^@/, "").replace(/^\//, "").trim();
  if (!handle) return "";

  return type === "instagram"
    ? `https://instagram.com/${handle}`
    : `https://facebook.com/${handle}`;
}

function normalizeActivity(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getQuantityUnit(name: string, quantity: number): string {
  const v = normalizeActivity(name);
  const p = quantity > 1;
  if (v.includes("bowling")) return p ? "pistes" : "piste";
  if (v.includes("billard") || v.includes("pool")) return p ? "tables" : "table";
  if (v.includes("babyfoot") || v.includes("baby foot") || v.includes("baby-foot")) return p ? "tables" : "table";
  if (v.includes("flechette") || v.includes("dart")) return p ? "cibles" : "cible";
  if (v.includes("karaok")) return "box";
  if (v.includes("escape")) return p ? "salles" : "salle";
  if (v.includes("tennis") || v.includes("badminton") || v.includes("squash")) return p ? "courts" : "court";
  if (v.includes("petanque") || v.includes("palet")) return p ? "terrains" : "terrain";
  return p ? "disponibles" : "disponible";
}

function activityEmoji(name: string) {
  const v = normalizeActivity(name);
  if (v.includes("flechette") || v.includes("dart")) return "\u{1F3AF}";
  if (v.includes("beer pong")) return "\u{1F37A}";
  if (v.includes("babyfoot") || v.includes("foosball")) return "\u{26BD}\u{FE0F}";
  if (v.includes("petanque")) return "\u{1F7E2}";
  if (v.includes("bowling")) return "\u{1F3B3}";
  if (v.includes("billard") || v.includes("pool")) return "\u{1F3B1}";
  if (v.includes("karaoke") || v.includes("karaok")) return "\u{1F3A4}";
  if (v.includes("hache") || v.includes("axe")) return "\u{1FA93}";
  if (v.includes("wine") || v.includes("vin")) return "\u{1F377}";
  return "\u{2728}";
}

function normalizePhone(raw?: string | null) {
  return (raw ?? "").trim();
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { isPremium: userIsPremium } = useIsPremium();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<VenueActivity[]>([]);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [perks, setPerks] = useState<VenuePerk[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [perkAvailability, setPerkAvailability] = useState<Record<number, { available: boolean; nextAvailableAt: Date | null }>>({});
  const [photoIndex, setPhotoIndex] = useState(0);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [infosModalOpen, setInfosModalOpen] = useState(false);
  const [perksPreviewOpen, setPerksPreviewOpen] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [bookingActivity, setBookingActivity] = useState<VenueActivity | null>(null);
  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<SlotOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<{ start: Date; end: Date; label: string } | null>(null);
  const [confirmedActivityName, setConfirmedActivityName] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({
    firstname: "",
    lastname: "",
    phone: "",
    phonePrefix: "+33",
    email: "",
    groupSize: 1,
  });
  const [showPrefixPicker, setShowPrefixPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedPerkId, setSelectedPerkId] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [closures, setClosures] = useState<VenueClosure[]>([]);

  useEffect(() => {
    if (!userId || !id) return;
    supabase
      .from("venue_favorites")
      .select("venue_id")
      .eq("user_id", userId)
      .eq("venue_id", Number(id))
      .maybeSingle()
      .then(({ data }) => setIsFavorite(!!data));
  }, [userId, id]);

  const toggleFavorite = async () => {
    if (!userId || !id) return;
    const venueId = Number(id);

    if (!isFavorite && !userIsPremium) {
      const { count } = await supabase
        .from("venue_favorites")
        .select("venue_id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= 4) {
        Alert.alert(
          "Limite atteinte",
          "Tu as atteint la limite de 4 favoris. Passe à Jovial+ pour en ajouter autant que tu veux !",
          [
            { text: "Plus tard", style: "cancel" },
            { text: "Découvrir Jovial+", onPress: () => router.push("/premium" as any) },
          ]
        );
        return;
      }
    }

    setIsFavorite((prev) => !prev);
    if (isFavorite) {
      await supabase.from("venue_favorites").delete().eq("user_id", userId).eq("venue_id", venueId);
    } else {
      await supabase.from("venue_favorites").insert({ user_id: userId, venue_id: venueId });
    }
  };

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchVenue = async () => {
      setLoading(true);
      const demoVenue = findDemoVenueById(String(id));

      if (demoVenue) {
        const demoActivities: VenueActivity[] = demoVenue.activities.map((activityName, index) => ({
          id: -(index + 1),
          game_id: -(index + 1),
          name: activityName,
          quantity: index === 0 ? 2 : 1,
          reservable_quantity: 0,
          booking_mode: "none",
          booking_url: null,
          booking_enabled: false,
          slot_duration_minutes: 60,
          booking_capacity: 1,
          booking_note: null,
          price_cents: 0,
          currency: "EUR",
          payment_required: false,
        }));

        if (!cancelled) {
          setVenue({
            id: demoVenue.id,
            name: demoVenue.name,
            address: demoVenue.address,
            city: demoVenue.city,
            postcode: demoVenue.postcode,
            contact: demoVenue.contact,
            description: null,
            venue_type: null,
            venue_ambiance: null,
            service_tags: null,
            social_platform: demoVenue.social_platform,
            social_url: demoVenue.social_url,
            cover_url: demoVenue.cover_url,
            photos: demoVenue.photos,
            lat: demoVenue.lat,
            lng: demoVenue.lng,
            opening_hours: demoVenue.opening_hours,
            timezone: demoVenue.timezone,
          });
          setActivities(demoActivities);
          setEvents([]);
          setLoading(false);
        }
        return;
      }

      const numericId = Number(id);
      if (!Number.isFinite(numericId)) {
        if (!cancelled) {
          setVenue(null);
          setActivities([]);
          setEvents([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("venues")
        .select(
          "id, name, city, address, postcode, contact, description, venue_type, venue_ambiance, service_tags, lat, lng, cover_url, photos, social_platform, social_url, opening_hours, timezone"
        )
        .eq("id", numericId)
        .maybeSingle();

      if (error) console.error("Error fetching venue", error);

      let cleanActivities: VenueActivity[] = [];
      try {
        const bookingActivities = (await fetchVenueBookingActivities(numericId)).filter(
          (activity): activity is VenueBookingActivity => Boolean(activity)
        );
        cleanActivities = bookingActivities.map((activity) => ({
          id: activity.id,
          game_id: activity.game_id,
          name: activity.name,
          quantity: activity.quantity,
          reservable_quantity: activity.reservable_quantity,
          booking_mode: activity.booking_mode,
          booking_url: activity.booking_url,
          booking_enabled: activity.booking_enabled,
          slot_duration_minutes: activity.slot_duration_minutes,
          booking_capacity: activity.booking_capacity,
          booking_note: activity.booking_note,
          price_cents: activity.price_cents,
          currency: activity.currency,
          payment_required: activity.payment_required,
        }));
      } catch (err) {
        console.error("Error fetching activities", err);
      }
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id, title, starts_at, cover_url, is_pinned")
        .eq("venue_id", numericId)
        .gte("starts_at", new Date().toISOString())
        .order("is_pinned", { ascending: false })
        .order("starts_at", { ascending: true })
        .limit(6);

      if (eventsError) console.error("Error fetching events", eventsError);

      const cleanEvents: VenueEvent[] =
        (eventsData as any[] | null)
          ?.reduce((acc: VenueEvent[], row) => {
            const eventId = Number(row?.id);
            const title = String(row?.title ?? "").trim();
            const startsAt = String(row?.starts_at ?? "").trim();
            if (!Number.isFinite(eventId) || !title || !startsAt) return acc;
            acc.push({
              id: eventId,
              title,
              starts_at: startsAt,
              cover_url: row?.cover_url ?? null,
              is_pinned: Boolean(row?.is_pinned ?? false),
            });
            return acc;
          }, []) ?? [];

      let cleanClosures: VenueClosure[] = [];
      try { cleanClosures = await fetchVenueClosures(numericId); } catch { /* ignore */ }

      let cleanPerks: VenuePerk[] = [];
      try {
        cleanPerks = await fetchActiveVenuePerks(numericId);
      } catch {
        cleanPerks = [];
      }

      let premium = false;
      const availability: Record<number, { available: boolean; nextAvailableAt: Date | null }> = {};
      if (userId && cleanPerks.length > 0) {
        try {
          premium = await isUserPremium(userId);
          if (premium) {
            await Promise.all(
              cleanPerks.map(async (perk) => {
                const avail = await checkPerkAvailability(perk.id, userId, perk.frequency);
                availability[perk.id] = avail;
              })
            );
          }
        } catch {
          premium = false;
        }
      }

      if (!cancelled) {
        setVenue((data as Venue) ?? null);
        setActivities(cleanActivities);
        setEvents(cleanEvents);
        setClosures(cleanClosures);
        setPerks(cleanPerks);
        setIsPremium(premium);
        setPerkAvailability(availability);
        setLoading(false);
      }
    };

    fetchVenue();

    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  const safePhotos = useMemo(() => {
    const list = venue?.photos ?? [];
    return Array.isArray(list)
      ? list.filter((x) => typeof x === "string" && isHttpUrlString(x))
      : [];
  }, [venue]);

  const coverImageUrl = useMemo(() => {
    if (safePhotos.length > 0) return safePhotos[0];
    if (venue?.cover_url && isHttpUrlString(venue.cover_url)) return venue.cover_url;
    return FALLBACK_COVER;
  }, [safePhotos, venue]);

  const photos = useMemo(() => {
    if (safePhotos.length > 0) return safePhotos;
    return [coverImageUrl];
  }, [safePhotos, coverImageUrl]);

  const social = useMemo(() => {
    if (!venue?.social_platform || !venue?.social_url) return null;

    const url = normalizeSocialUrl(venue.social_platform, venue.social_url);
    if (!url) return null;

    return {
      type: venue.social_platform,
      label: venue.social_platform === "instagram" ? "Instagram" : "Facebook",
      icon: venue.social_platform === "instagram" ? "logo-instagram" : "logo-facebook",
      url,
    };
  }, [venue]);

  const primaryActivities = useMemo(() => activities.slice(0, 2), [activities]);

  const venuePitch = useMemo(() => {
    if (activities.length === 0) {
      return "Un lieu a decouvrir pour sortir, se retrouver et prolonger la soiree.";
    }

    const names = activities.slice(0, 3).map((activity) => activity.name);
    if (names.length === 1) {
      return `Une adresse a retenir pour profiter de ${names[0].toLowerCase()} dans une ambiance conviviale.`;
    }
    if (names.length === 2) {
      return `Une bonne adresse pour profiter de ${names[0].toLowerCase()} et ${names[1].toLowerCase()} sans te poser trop de questions.`;
    }
    return `Un lieu vivant pour enchainer ${names[0].toLowerCase()}, ${names[1].toLowerCase()} et ${names[2].toLowerCase()} selon l'envie du moment.`;
  }, [activities]);

  const handleOpenSocial = () => {
    if (!social?.url) return;
    Linking.openURL(social.url).catch((err) =>
      console.error("Cannot open social url", err)
    );
  };

  const handleDirections = () => {
    if (!venue) return;

    const label = encodeURIComponent(venue.name ?? "");

    if (venue.lat != null && venue.lng != null) {
      const url =
        Platform.OS === "ios"
          ? `http://maps.apple.com/?daddr=${venue.lat},${venue.lng}`
          : `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;

      Linking.openURL(url).catch((err) => console.error("Cannot open maps", err));
      return;
    }

    const query = encodeURIComponent((`${venue.address ?? ""} ${venue.postcode ?? ""} ${venue.city ?? ""}`).trim());

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${query || label}`
        : `https://www.google.com/maps/dir/?api=1&destination=${query || label}`;

    Linking.openURL(url).catch((err) => console.error("Cannot open maps", err));
  };

  const handleCall = () => {
    const phone = normalizePhone(venue?.contact);
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch((err) => console.error("Cannot start call", err));
  };

  const parseEventStart = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const [startPart] = trimmed.split(/\s-\s/);
    const normalized = startPart.includes("T")
      ? startPart
      : startPart.replace(" ", "T");
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;

    const match = startPart.match(
      /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/
    );
    if (!match) return null;
    const [, year, month, day, hours = "0", minutes = "0"] = match;
    const fallback = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes)
    );
    if (Number.isNaN(fallback.getTime())) return null;
    return fallback;
  };

  const formatEventDate = (iso: string) => {
    const trimmed = iso.trim();
    const [startPart] = trimmed.split(/\s-\s/);
    const date = parseEventStart(startPart);
    if (!date) {
      return startPart.replace(/(\d{2}:\d{2})(:\d{2})/, "$1");
    }

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${day}/${month}/${year} - ${hours}:${minutes}`;
  };

  const todayDateStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const hasActiveClosure = useMemo(() => {
    return closures.some((c) => c.date_start <= todayDateStr && c.date_end >= todayDateStr);
  }, [closures, todayDateStr]);

  const openingStatus = useMemo(() => {
    if (hasActiveClosure) return { isOpen: false, status: "closed" as const, label: "Fermeture exceptionnelle" };
    return getOpeningStatus(venue?.opening_hours ?? undefined, venue?.timezone ?? null);
  }, [venue?.opening_hours, venue?.timezone, hasActiveClosure]);

  const hasReservationActivity = useMemo(
    () =>
      activities.some(
        (activity) =>
          activity.booking_enabled &&
          (activity.booking_mode === "jovial" ||
            (activity.booking_mode === "external" && activity.booking_url))
      ),
    [activities]
  );

  const featuredActivity = useMemo(() => activities[0] ?? null, [activities]);
  const remainingActivities = useMemo(() => activities.slice(1), [activities]);
  const visibleRemainingActivities = useMemo(
    () => (showAllActivities ? remainingActivities : []),
    [remainingActivities, showAllActivities]
  );
  const featuredEvent = useMemo(() => events.find((e) => e.is_pinned) ?? events[0] ?? null, [events]);
  const remainingEvents = useMemo(() => events.slice(1), [events]);
  const visibleRemainingEvents = useMemo(
    () => (showAllEvents ? remainingEvents : []),
    [remainingEvents, showAllEvents]
  );


  useEffect(() => {
    const loadSlots = async () => {
      if (!bookingActivity || !venue?.opening_hours) {
        setAvailableSlots([]);
        setIsDayClosed(false);
        return;
      }
      const numericVenueId = Number(id);
      const dateStr = [
        bookingDate.getFullYear(),
        String(bookingDate.getMonth() + 1).padStart(2, "0"),
        String(bookingDate.getDate()).padStart(2, "0"),
      ].join("-");
      try {
        // Vérification directe des fermetures (indépendante de fetchAvailableSlots)
        const { data: closureRows } = await supabase
          .from("venue_closures")
          .select("id")
          .eq("venue_id", numericVenueId)
          .lte("date_start", dateStr)
          .gte("date_end", dateStr)
          .limit(1);
        const hasClosure = (closureRows ?? []).length > 0;
        setIsDayClosed(hasClosure);
        const slots = await fetchAvailableSlots(
          numericVenueId,
          bookingActivity.game_id,
          bookingDate,
          bookingActivity.slot_duration_minutes,
          Math.max(bookingActivity.reservable_quantity || bookingActivity.booking_capacity || 1, 1),
          venue.opening_hours
        );
        // Si fermeture détectée, forcer tous les créneaux à indisponible
        setAvailableSlots(hasClosure ? slots.map((s) => ({ ...s, available: false })) : slots);
        setSelectedSlot(null);
      } catch (err) {
        console.error("Error fetching slots", err);
        setAvailableSlots([]);
      }
    };
    loadSlots();
  }, [bookingActivity, bookingDate, id, venue?.opening_hours]);

  const handleBookingOpen = (activity: VenueActivity) => {
    setBookingSuccess(false);
    setBookingError(null);
    if (activity.booking_mode === "external" && activity.booking_url) {
      const trimmed = activity.booking_url.trim();
      const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const safeUrl = encodeURI(url);
      Linking.canOpenURL(safeUrl)
        .then((supported) => {
          if (!supported) {
            console.error("Cannot open booking url", safeUrl);
            return;
          }
          return Linking.openURL(safeUrl);
        })
        .catch((err) => console.error("Cannot open booking url", err));
      return;
    }
    if (activity.booking_mode === "jovial") {
      setBookingActivity(activity);
      setBookingDate(new Date());
      setSelectedSlot(null);
      return;
    }
  };

  const handleConfirmBooking = async () => {
    if (!bookingActivity || !venue) return;
    setBookingError(null);

    if (!bookingForm.firstname.trim()) {
      setBookingError("Le prénom est obligatoire.");
      return;
    }
    if (!bookingForm.lastname.trim()) {
      setBookingError("Le nom est obligatoire.");
      return;
    }
    const rawPhone = bookingForm.phone.trim().replace(/\s/g, "");
    if (!rawPhone) {
      setBookingError("Le numéro de téléphone est obligatoire.");
      return;
    }
    if (!/^\d{6,15}$/.test(rawPhone)) {
      setBookingError("Numéro de téléphone invalide (chiffres uniquement, 6 à 15 chiffres).");
      return;
    }
    if (!bookingForm.email.trim()) {
      setBookingError("L'email est obligatoire.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingForm.email.trim())) {
      setBookingError("Adresse email invalide.");
      return;
    }
    if (!selectedSlot) {
      setBookingError("Sélectionne un créneau horaire.");
      return;
    }

    const venueId = Number(venue.id);
    if (!Number.isFinite(venueId)) return;
    const fullPhone = `${bookingForm.phonePrefix}${rawPhone}`;

    try {
      setBookingLoading(true);
      await createReservation({
        venueId,
        gameId: bookingActivity.game_id,
        startsAt: selectedSlot.start,
        endsAt: selectedSlot.end,
        contact_firstname: bookingForm.firstname.trim(),
        contact_lastname: bookingForm.lastname.trim(),
        contact_phone: fullPhone,
        contact_email: bookingForm.email.trim(),
        group_size: bookingForm.groupSize,
        price_cents: bookingActivity.price_cents ?? 0,
        currency: bookingActivity.currency ?? "EUR",
        payment_required: bookingActivity.payment_required ?? false,
      });

      // Notifications de rappel H-24 et H-1
      try {
        const { scheduleReservationReminders } = await import("@/services/notifications");
        await scheduleReservationReminders({
          activityName: bookingActivity.name ?? "Réservation",
          venueName: venue.name ?? "",
          startsAt: selectedSlot.start,
        });
      } catch { /* notifications non bloquantes */ }

      setConfirmedSlot({ start: selectedSlot.start, end: selectedSlot.end, label: selectedSlot.label });
      setConfirmedActivityName(bookingActivity.name ?? null);
      setBookingSuccess(true);
      setBookingForm({ firstname: "", lastname: "", phone: "", phonePrefix: "+33", email: "", groupSize: 1 });
      setSelectedSlot(null);
    } catch (err) {
      const msg =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Impossible de créer la réservation.";
      setBookingError(msg);
    } finally {
      setBookingLoading(false);
    }
  };

  const todayKey = useMemo(() => {
    const keys: (keyof OpeningHours)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return keys[new Date().getDay()];
  }, []);

  const hoursRows = useMemo(() => {
    if (!venue?.opening_hours) return [];
    const allDays: { key: keyof OpeningHours; label: string }[] = [
      { key: "mon", label: "Lundi" },
      { key: "tue", label: "Mardi" },
      { key: "wed", label: "Mercredi" },
      { key: "thu", label: "Jeudi" },
      { key: "fri", label: "Vendredi" },
      { key: "sat", label: "Samedi" },
      { key: "sun", label: "Dimanche" },
    ];
    const todayIndex = allDays.findIndex((d) => d.key === todayKey);
    const dayOrder = todayIndex >= 0
      ? [...allDays.slice(todayIndex), ...allDays.slice(0, todayIndex)]
      : allDays;

    const formatTime = (value: string) => {
      const match = value.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return value;
      const hours = Number(match[1]);
      const minutes = match[2];
      return minutes === "00" ? `${hours}h` : `${hours}h${minutes}`;
    };

    return dayOrder.map((day) => {
      const isToday = day.key === todayKey;
      const slots = venue.opening_hours?.[day.key] ?? [];
      if (!slots || slots.length === 0) {
        return { label: day.label, value: "Fermé", isToday, closure: false };
      }
      const ranges = slots
        .map((slot) => `${formatTime(slot.open)} - ${formatTime(slot.close)}`)
        .join(", ");
      return { label: day.label, value: ranges, isToday, closure: false };
    }).map((row) => {
      if (!row.isToday || !hasActiveClosure) return row;
      return { ...row, value: "Fermé", closure: true };
    });
  }, [venue?.opening_hours]);
  const openEvent = (eventId: number) => {
    router.push(`/event/${eventId}?fromVenue=1` as any);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Pastel.primary} />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Pastel.textMuted }}>Lieu introuvable.</Text>
        <Pressable
          style={[styles.secondaryButton, { marginTop: 16 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const addToCalendar = async () => {
    if (!confirmedSlot) return;
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Accès au calendrier refusé",
          "Autorisez l'accès au calendrier dans les réglages.",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Réglages", onPress: () => Linking.openSettings().catch(() => undefined) },
          ]
        );
        return;
      }
      let calendarId: string | null = null;
      try {
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        calendarId = defaultCal?.id ?? null;
      } catch {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        calendarId = calendars.find((c) => c.isPrimary)?.id ?? calendars[0]?.id ?? null;
      }
      if (!calendarId) throw new Error("no calendar");
      await Calendar.createEventAsync(calendarId, {
        title: confirmedActivityName ? `${confirmedActivityName} — ${venue?.name ?? ""}` : (venue?.name ?? "Réservation Jovial"),
        startDate: confirmedSlot.start,
        endDate: confirmedSlot.end,
        location: venue?.address ?? undefined,
        notes: "Réservation effectuée via Jovial",
      });
      Alert.alert("Ajouté !", "Ton créneau a été ajouté à ton agenda.");
    } catch {
      Alert.alert("Erreur", "Impossible d'accéder au calendrier sur cet appareil.");
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* Modal horaires */}
      <Modal
        transparent
        visible={hoursModalOpen}
        animationType="fade"
        onRequestClose={() => setHoursModalOpen(false)}
      >
        <Pressable style={styles.hoursModalOverlay} onPress={() => setHoursModalOpen(false)}>
          <Pressable style={styles.hoursModalCard} onPress={() => {}}>
            <View style={styles.hoursModalHeader}>
              <Text style={styles.hoursModalTitle}>Horaires d'ouverture</Text>
              <Pressable onPress={() => setHoursModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={Pastel.textMuted} />
              </Pressable>
            </View>
            {hoursRows.length === 0 ? (
              <Text style={styles.emptyText}>Horaires indisponibles.</Text>
            ) : (
              hoursRows.map((row) => (
                <View key={row.label} style={[styles.hoursRow, row.isToday ? styles.hoursRowToday : null]}>
                  <Text style={[styles.hoursLabel, row.isToday ? styles.hoursLabelToday : null]}>{row.label}</Text>
                  <Text style={[styles.hoursValue, row.isToday ? styles.hoursValueToday : null]}>{row.value}</Text>
                </View>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal infos utiles */}
      <Modal
        transparent
        visible={infosModalOpen}
        animationType="fade"
        onRequestClose={() => setInfosModalOpen(false)}
      >
        <Pressable style={styles.hoursModalOverlay} onPress={() => setInfosModalOpen(false)}>
          <Pressable style={[styles.hoursModalCard, styles.infosModalCard]} onPress={() => {}}>
            <View style={styles.hoursModalHeader}>
              <Text style={styles.hoursModalTitle}>Infos utiles</Text>
              <Pressable onPress={() => setInfosModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={Pastel.textMuted} />
              </Pressable>
            </View>


            {/* Message fermeture exceptionnelle */}
            {hasActiveClosure && (() => {
              const closure = closures.find((c) => c.date_start <= todayDateStr && c.date_end >= todayDateStr);
              return closure?.reason ? (
                <View style={styles.closureMessageBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#B91C1C" />
                  <Text style={styles.closureMessageText}>{closure.reason}</Text>
                </View>
              ) : null;
            })()}

            {/* Horaires */}
            {hoursRows.length > 0 && (
              <View style={styles.infosSection}>
                <Text style={styles.infosSectionTitle}>Horaires</Text>
                {hoursRows.map((row) => (
                  <View key={row.label} style={[styles.hoursRow, row.isToday ? styles.hoursRowToday : null]}>
                    <Text style={[styles.hoursLabel, row.isToday ? styles.hoursLabelToday : null]}>{row.label}</Text>
                    <Text style={[styles.hoursValue, row.isToday ? styles.hoursValueToday : null]}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Services */}
            {venue.service_tags && venue.service_tags.length > 0 && (
              <View style={styles.infosSection}>
                <Text style={styles.infosSectionTitle}>Services</Text>
                <View style={styles.infosTagsRow}>
                  {venue.service_tags.map((tag) => (
                    <View key={tag} style={styles.serviceTagPill}>
                      <Text style={styles.serviceTagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Infos pratiques */}
            {(venue.address || venue.contact) && (
              <View style={styles.infosSection}>
                <Text style={styles.infosSectionTitle}>Infos pratiques</Text>
                {venue.address ? (
                  <Text style={styles.infosDetail}>
                    {[venue.address, venue.postcode, venue.city].filter(Boolean).join(", ")}
                  </Text>
                ) : null}
                {venue.contact ? (
                  <Pressable onPress={handleCall} hitSlop={8}>
                    <Text style={[styles.infosDetail, styles.infosPhone]}>
                      📞 {venue.contact}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal aperçu avantages Premium */}
      <Modal
        transparent
        visible={perksPreviewOpen}
        animationType="fade"
        onRequestClose={() => setPerksPreviewOpen(false)}
      >
        <Pressable style={styles.hoursModalOverlay} onPress={() => setPerksPreviewOpen(false)}>
          <Pressable style={[styles.hoursModalCard, styles.perksPreviewCard]} onPress={() => {}}>
            <View style={styles.hoursModalHeader}>
              <Text style={styles.hoursModalTitle}>Avantages membres</Text>
              <Pressable onPress={() => setPerksPreviewOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={Pastel.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.perksPreviewSubtitle}>
              Rejoins Jovial Premium et profite d'avantages exclusifs dans ce lieu.
            </Text>
            {perks.map((perk, index) => (
              <View key={perk.id}>
                {index > 0 ? <View style={styles.perkPreviewDivider} /> : null}
                <View style={styles.perkPreviewRow}>
                  <Text style={styles.perkPreviewEmoji}>🎁</Text>
                  <View style={styles.perkPreviewText}>
                    <Text style={styles.perkPreviewTitle}>{perk.title}</Text>
                    {perk.description ? (
                      <Text style={styles.perkPreviewDesc}>{perk.description}</Text>
                    ) : null}
                    <Text style={styles.perkPreviewFreq}>{PERK_FREQUENCY_LABELS[perk.frequency]}</Text>
                  </View>
                </View>
              </View>
            ))}
            {!isPremium ? (
              <Pressable
                style={styles.premiumCtaBtn}
                onPress={() => { setPerksPreviewOpen(false); router.push("/premium" as any); }}
              >
                <View style={styles.premiumCtaBtnLeft}>
                  <Text style={styles.premiumCtaBadge}>JOVIAL+</Text>
                  <Text style={styles.premiumCtaTitle}>Passe au niveau supérieur</Text>
                  <Text style={styles.premiumCtaSub}>Débloque ces avantages et bien plus encore</Text>
                </View>
                <View style={styles.premiumCtaArrow}>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </View>
              </Pressable>
            ) : (
              <View style={styles.premiumCtaAlready}>
                <Text style={styles.premiumCtaAlreadyText}>✅ Tu es déjà membre Premium</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const x = event.nativeEvent.contentOffset.x;
              const nextIndex = Math.round(x / PHOTO_WIDTH);
              setPhotoIndex(nextIndex);
            }}
          >
            {photos.map((url, index) => (
              <View key={`${url}-${index}`} style={styles.coverSlide}>
                <Image source={url} style={styles.coverImage} contentFit="cover" transition={200} />
              </View>
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {photos.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[styles.dot, index === photoIndex ? styles.dotActive : null]}
              />
            ))}
          </View>
        </View>


        <Pressable style={[styles.backButton, { top: insets.top + 10 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Pressable style={[styles.favoriteButton, { top: insets.top + 10 }]} onPress={toggleFavorite}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={22}
            color={isFavorite ? "#EF4444" : Pastel.text}
          />
        </Pressable>

        <View style={styles.contentCard}>

          {/* Identité du lieu */}
          <View style={styles.venueHeaderBlock}>
            <View style={styles.statusRow}>
              {openingStatus.status !== "unknown" ? (
                <>
                  <View style={[styles.statusDot, openingStatus.isOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
                  <Text style={[styles.statusText, openingStatus.isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                    {openingStatus.isOpen ? "Ouvert" : "Fermé"}
                  </Text>
                </>
              ) : null}
              {perks.length > 0 ? (
                <Pressable onPress={() => setPerksPreviewOpen(true)} hitSlop={8} style={styles.premiumPill}>
                  <Ionicons name="gift-outline" size={13} color="#92400E" />
                  <Text style={styles.premiumPillText}>Un avantage t'attend ici</Text>
                  <Ionicons name="chevron-forward" size={13} color="#92400E" />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.venueName} adjustsFontSizeToFit numberOfLines={1}>{venue.name}</Text>
          </View>

          <Text style={styles.venueDescription} numberOfLines={2} ellipsizeMode="tail">{venue.description?.trim() || venuePitch}</Text>

          {(venue.venue_type || (venue.venue_ambiance && venue.venue_ambiance.length > 0)) ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsScrollRow}
            >
              {venue.venue_type ? (
                <View style={styles.typeTagPill}>
                  <Text style={styles.typeTagPillText}>{venue.venue_type}</Text>
                </View>
              ) : null}
              {(venue.venue_ambiance ?? []).map((tag) => (
                <View key={tag} style={styles.ambianceTagPill}>
                  <Text style={styles.ambianceTagPillText}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={handleDirections}>
              <Ionicons name="navigate-outline" size={22} color={Pastel.text} />
              <Text style={styles.actionBtnText}>Itinéraire</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => setInfosModalOpen(true)}>
              <Ionicons name="information-circle-outline" size={22} color={Pastel.text} />
              <Text style={styles.actionBtnText}>Infos utiles</Text>
            </Pressable>
            {social ? (
              <Pressable style={[styles.actionBtn, styles.actionBtnSocial]} onPress={handleOpenSocial}>
                <Ionicons name={social.icon as any} size={22} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, styles.actionBtnSocialText]}>{social.label}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sectionDivider} />

          {/* Activités */}
          <View style={styles.venueSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>
                {hasReservationActivity ? "Ce que tu peux faire ici" : "Activités disponibles"}
              </Text>
              {activities.length > 1 ? (
                <Text style={styles.sectionSubCount}>{activities.length} activités</Text>
              ) : null}
            </View>
            {activities.length === 0 ? (
              <Text style={styles.emptyText}>Aucune activité renseignée pour le moment.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activityCardsRow}
              >
                {activities.map((activity) => {
                  const isBookable =
                    activity.booking_enabled &&
                    (activity.booking_mode === "jovial" ||
                      (activity.booking_mode === "external" && activity.booking_url));
                  return (
                    <Pressable
                      key={activity.id}
                      style={[styles.activityCardNew, isBookable && styles.activityCardNewBookable]}
                      onPress={() => isBookable && handleBookingOpen(activity)}
                    >
                      <Text style={styles.activityCardEmojiLarge}>{activityEmoji(activity.name)}</Text>
                      <Text style={[styles.activityCardNameNew, isBookable && { color: "#FFFFFF" }]}>{activity.name}</Text>
                      <Text style={[styles.activityCardQuantityText, isBookable && { color: "rgba(255,255,255,0.6)" }]}>
                        {activity.quantity} {getQuantityUnit(activity.name, activity.quantity)}
                      </Text>
                      {isBookable ? (
                        <View style={styles.activityCardBookBadge}>
                          <Text style={styles.activityCardBookBadgeText}>
                            {activity.payment_required
                              ? `${(activity.price_cents / 100).toFixed(2).replace(".", ",")} ${activity.currency}`
                              : "Réserver · Gratuit"}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.activityCardFreeBadge}>Sur place</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Événements */}
          {events.length > 0 ? (
            <View style={styles.venueSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Événements à venir</Text>
                {events.length > 1 ? (
                  <Text style={styles.sectionSubCount}>{events.length} événements</Text>
                ) : null}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventCardsRow}
              >
                {events.map((event, index) => {
                  const isFeatured = event.id === featuredEvent?.id;
                  return (
                    <Pressable
                      key={event.id}
                      style={[styles.eventCardNew, isFeatured && styles.eventCardNewFeatured]}
                      onPress={() => openEvent(event.id)}
                    >
                      <Image
                        source={event.cover_url || FALLBACK_COVER}
                        style={styles.eventCardImageNew}
                        contentFit="cover"
                        transition={120}
                      />
                      <View style={styles.eventCardOverlay}>
                        {isFeatured ? (
                          <View style={styles.eventCardNextBadge}>
                            <Text style={styles.eventCardNextBadgeText}>{event.is_pinned ? "📌 Épinglé" : "Prochain"}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.eventCardDateNew}>{formatEventDate(event.starts_at)}</Text>
                        <Text style={styles.eventCardTitleNew} numberOfLines={2}>{event.title}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}


        </View>
      </ScrollView>

      <Modal
        visible={!!bookingActivity}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingActivity(null)}
      >
        <View style={styles.bookingBackdrop}>
          <View style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
              <Text style={styles.bookingTitle}>Choisis ton créneau</Text>
              <Pressable onPress={() => setBookingActivity(null)}>
                <Ionicons name="close" size={18} color={Pastel.textMuted} />
              </Pressable>
            </View>

            {bookingSuccess ? (
              <View style={styles.bookingSuccessBlock}>
                <Text style={styles.bookingSuccessEmoji}>✅</Text>
                <Text style={styles.bookingSuccessTitle}>Réservation confirmée !</Text>
                {confirmedActivityName ? (
                  <Text style={styles.bookingSuccessActivity}>{confirmedActivityName}</Text>
                ) : null}
                {confirmedSlot ? (
                  <View style={styles.bookingSuccessSlotBox}>
                    <Text style={styles.bookingSuccessSlotDate}>
                      {confirmedSlot.start.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                    </Text>
                    <Text style={styles.bookingSuccessSlotTime}>{confirmedSlot.label}</Text>
                  </View>
                ) : null}
                <Text style={styles.bookingSuccessSub}>
                  À bientôt !
                </Text>
                <Pressable style={styles.calendarBtn} onPress={addToCalendar}>
                  <Ionicons name="calendar-outline" size={16} color="#059669" />
                  <Text style={styles.calendarBtnText}>Ajouter à mon agenda</Text>
                </Pressable>
                <Pressable
                  style={styles.bookingButton}
                  onPress={() => { setBookingActivity(null); setBookingSuccess(false); }}
                >
                  <Text style={styles.bookingButtonText}>Fermer</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bookingScrollContent}>
                <Text style={styles.bookingSubtitle}>{bookingActivity?.name}</Text>
                {!!bookingActivity?.booking_note ? (
                  <Text style={styles.bookingNote}>{bookingActivity.booking_note}</Text>
                ) : null}

                <View style={styles.bookingField}>
                  <Text style={styles.bookingLabel}>Prénom <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    value={bookingForm.firstname}
                    onChangeText={(value) => setBookingForm((prev) => ({ ...prev, firstname: value }))}
                    placeholder="Votre prénom"
                    placeholderTextColor={Pastel.textMuted}
                    style={styles.bookingInput}
                  />
                </View>
                <View style={styles.bookingField}>
                  <Text style={styles.bookingLabel}>Nom <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    value={bookingForm.lastname}
                    onChangeText={(value) => setBookingForm((prev) => ({ ...prev, lastname: value }))}
                    placeholder="Votre nom"
                    placeholderTextColor={Pastel.textMuted}
                    style={styles.bookingInput}
                  />
                </View>
                <View style={styles.bookingField}>
                  <Text style={styles.bookingLabel}>Téléphone <Text style={styles.required}>*</Text></Text>
                  <View style={styles.phoneRow}>
                    <Pressable
                      style={styles.prefixBtn}
                      onPress={() => {
                        const prefixes = ["+33", "+32", "+41", "+49", "+34", "+39", "+44", "+1", "+212", "+216"];
                        if (Platform.OS === "ios") {
                          const { ActionSheetIOS } = require("react-native");
                          ActionSheetIOS.showActionSheetWithOptions(
                            { options: ["Annuler", ...prefixes], cancelButtonIndex: 0, title: "Indicatif téléphonique" },
                            (i: number) => { if (i > 0) setBookingForm((prev) => ({ ...prev, phonePrefix: prefixes[i - 1] })); }
                          );
                        } else {
                          Alert.alert("Indicatif", "Choisis ton indicatif", [
                            { text: "Annuler", style: "cancel" },
                            ...prefixes.map((p) => ({ text: p, onPress: () => setBookingForm((prev) => ({ ...prev, phonePrefix: p })) })),
                          ]);
                        }
                      }}
                    >
                      <Text style={styles.prefixBtnText}>{bookingForm.phonePrefix}</Text>
                      <Ionicons name="chevron-down" size={12} color={Pastel.textMuted} />
                    </Pressable>
                    <TextInput
                      value={bookingForm.phone}
                      onChangeText={(value) => setBookingForm((prev) => ({ ...prev, phone: value.replace(/[^\d\s]/g, "") }))}
                      placeholder="6 12 34 56 78"
                      placeholderTextColor={Pastel.textMuted}
                      style={[styles.bookingInput, styles.phoneInput]}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
                <View style={styles.bookingField}>
                  <Text style={styles.bookingLabel}>Email <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    value={bookingForm.email}
                    onChangeText={(value) => setBookingForm((prev) => ({ ...prev, email: value }))}
                    placeholder="votre@email.com"
                    placeholderTextColor={Pastel.textMuted}
                    style={styles.bookingInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.bookingField}>
                  <Text style={styles.bookingLabel}>Taille du groupe</Text>
                  <View style={styles.groupSizeRow}>
                    {([1, 2, 3, 4, 5, 6, 7, 8] as const).map((n) => (
                      <Pressable
                        key={n}
                        style={[styles.groupSizeChip, bookingForm.groupSize === n ? styles.groupSizeChipActive : null]}
                        onPress={() => setBookingForm((prev) => ({ ...prev, groupSize: n }))}
                      >
                        <Text style={[styles.groupSizeChipText, bookingForm.groupSize === n ? styles.groupSizeChipTextActive : null]}>
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      style={[styles.groupSizeChip, bookingForm.groupSize >= 9 ? styles.groupSizeChipActive : null]}
                      onPress={() => setBookingForm((prev) => ({ ...prev, groupSize: 9 }))}
                    >
                      <Text style={[styles.groupSizeChipText, bookingForm.groupSize >= 9 ? styles.groupSizeChipTextActive : null]}>
                        9+
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.bookingLabel}>Date</Text>
                {/* Calendrier mensuel */}
                <View style={styles.calendarCard}>
                  {/* Navigation mois */}
                  <View style={styles.calendarNav}>
                    <Pressable
                      style={styles.calendarNavBtn}
                      onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                    >
                      <Ionicons name="chevron-back" size={16} color={Pastel.text} />
                    </Pressable>
                    <Text style={styles.calendarMonthLabel}>
                      {calendarMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    </Text>
                    <Pressable
                      style={styles.calendarNavBtn}
                      onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                    >
                      <Ionicons name="chevron-forward" size={16} color={Pastel.text} />
                    </Pressable>
                  </View>
                  {/* Jours de la semaine */}
                  <View style={styles.calendarWeekdays}>
                    {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                      <Text key={i} style={styles.calendarWeekday}>{d}</Text>
                    ))}
                  </View>
                  {/* Grille des jours */}
                  <View style={styles.calendarGrid}>
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const year = calendarMonth.getFullYear();
                      const month = calendarMonth.getMonth();
                      const firstDay = new Date(year, month, 1);
                      // Lundi = 0 (européen)
                      const blanks = (firstDay.getDay() + 6) % 7;
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const cells: React.ReactNode[] = [];
                      for (let i = 0; i < blanks; i++) {
                        cells.push(<View key={`b-${i}`} style={styles.calendarEmpty} />);
                      }
                      for (let d = 1; d <= daysInMonth; d++) {
                        const dayDate = new Date(year, month, d);
                        const isPast = dayDate < today;
                        const isSelected = dayDate.toDateString() === bookingDate.toDateString();
                        const isToday = dayDate.toDateString() === today.toDateString();
                        cells.push(
                          <Pressable
                            key={d}
                            style={[
                              styles.calendarDay,
                              isSelected ? styles.calendarDaySelected : null,
                              isToday && !isSelected ? styles.calendarDayToday : null,
                              isPast ? styles.calendarDayPast : null,
                            ]}
                            onPress={() => !isPast && setBookingDate(dayDate)}
                            disabled={isPast}
                          >
                            <Text style={[
                              styles.calendarDayText,
                              isSelected ? styles.calendarDayTextSelected : null,
                              isPast ? styles.calendarDayTextPast : null,
                            ]}>
                              {d}
                            </Text>
                          </Pressable>
                        );
                      }
                      return cells;
                    })()}
                  </View>
                </View>

                <Text style={styles.bookingLabel}>Créneaux</Text>
                {isDayClosed ? (
                  <View style={styles.closureNotice}>
                    <Text style={styles.closureNoticeText}>🔒 L'établissement est fermé ce jour-là.</Text>
                  </View>
                ) : null}
                <View style={styles.slotGrid}>
                  {availableSlots.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun créneau disponible.</Text>
                  ) : (
                    availableSlots.map((slot) => {
                      const isSelected = selectedSlot?.label === slot.label;
                      return (
                        <Pressable
                          key={slot.label}
                          style={[
                            styles.slotChip,
                            isSelected ? styles.slotChipActive : null,
                            !slot.available ? styles.slotChipDisabled : null,
                          ]}
                          onPress={() => slot.available && setSelectedSlot(slot)}
                          disabled={!slot.available}
                        >
                          <Text
                            style={[
                              styles.slotChipText,
                              isSelected ? styles.slotChipTextActive : null,
                              !slot.available ? styles.slotChipTextDisabled : null,
                            ]}
                          >
                            {slot.label}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>

                {!!bookingError ? (
                  <View style={styles.bookingErrorBox}>
                    <Text style={styles.bookingErrorText}>{bookingError}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={[styles.bookingButton, bookingLoading ? styles.bookingButtonLoading : null]}
                  onPress={handleConfirmBooking}
                  disabled={bookingLoading}
                >
                  <Text style={styles.bookingButtonText}>
                    {bookingLoading ? "Réservation en cours..." : "Confirmer la réservation"}
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.background,
    paddingHorizontal: 16,
  },
  scrollContent: { paddingBottom: 40 },

  coverWrapper: { paddingHorizontal: PHOTO_SIDE_PADDING, paddingTop: 0 },
  coverSlide: { width: PHOTO_WIDTH },
  coverImage: { width: "100%", height: 280, borderRadius: 0 },
  dotsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  dotActive: { backgroundColor: Pastel.surface, width: 16 },

  backButton: {
    position: "absolute",
    left: 26,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: Pastel.border,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButton: {
    position: "absolute",
    right: 26,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: Pastel.border,
    alignItems: "center",
    justifyContent: "center",
  },

  contentCard: {
    backgroundColor: Pastel.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  venueHeaderBlock: { marginBottom: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotOpen: { backgroundColor: "#10B981" },
  statusDotClosed: { backgroundColor: "#9CA3AF" },
  statusText: { fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  statusTextOpen: { color: "#10B981" },
  statusTextClosed: { color: Pastel.textMuted },
  statusMeta: { fontSize: 13, color: Pastel.textMuted, flex: 1, includeFontPadding: false },
  hoursLinkBtn: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: "auto" as any },
  hoursLinkText: { fontSize: 13, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  venueName: { fontSize: 30, fontFamily: Font.display, color: Pastel.text, letterSpacing: -0.5, marginBottom: 4, includeFontPadding: false },
  venueCity: { fontSize: 14, color: Pastel.textMuted, fontFamily: Font.medium, includeFontPadding: false },
  venueDescription: { fontSize: 15, lineHeight: 23, color: Pastel.text, marginBottom: 16, includeFontPadding: false },
  tagsScrollRow: { flexDirection: "row", gap: 8, paddingBottom: 4, marginBottom: 4 },
  typeTagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  typeTagPillText: { fontSize: 13, fontFamily: Font.bold, color: "#6D28D9", includeFontPadding: false },
  ambianceTagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  ambianceTagPillText: { fontSize: 13, fontFamily: Font.semiBold, color: "#92400E", includeFontPadding: false },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 4 },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  actionBtnText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  actionBtnSocial: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  actionBtnSocialText: { color: "#FFFFFF" },
  sectionDivider: { height: 1, backgroundColor: Pastel.border, marginVertical: 24 },
  venueSection: { marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionHeaderTitle: { fontSize: 19, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  sectionBadge: {
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  activityList: { gap: 10 },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  toggleButtonText: { fontSize: 14, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  serviceTagPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  serviceTagPillText: { fontSize: 12, fontFamily: Font.semiBold, color: "#166534", includeFontPadding: false },
  infosModalCard: { gap: 0 },
  premiumPill: {
    marginLeft: "auto" as any,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  premiumPillText: { fontSize: 12, fontFamily: Font.bold, color: "#92400E", includeFontPadding: false },
  perksPreviewCard: { gap: 0 },
  perksPreviewSubtitle: { fontSize: 14, color: Pastel.textMuted, lineHeight: 20, marginBottom: 16, includeFontPadding: false },
  perkPreviewDivider: { height: 1, backgroundColor: Pastel.border, marginVertical: 8 },
  perkPreviewRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 4 },
  perkPreviewEmoji: { fontSize: 18, lineHeight: 22, includeFontPadding: false },
  perkPreviewText: { flex: 1, gap: 2 },
  perkPreviewTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  perkPreviewDesc: { fontSize: 13, color: Pastel.textMuted, lineHeight: 18, includeFontPadding: false },
  perkPreviewFreq: { fontSize: 12, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  premiumCtaBtn: {
    marginTop: 20,
    backgroundColor: Pastel.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  premiumCtaBtnLeft: { flex: 1, gap: 3 },
  premiumCtaBadge: { color: "#D97706", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, includeFontPadding: false },
  premiumCtaTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  premiumCtaSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, includeFontPadding: false },
  premiumCtaArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  premiumCtaAlready: {
    marginTop: 16,
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  premiumCtaAlreadyText: { fontSize: 14, fontFamily: Font.bold, color: "#059669", includeFontPadding: false },
  infosSection: { marginBottom: 16 },
  infosSectionTitle: { fontSize: 12, fontFamily: Font.extraBold, color: Pastel.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, includeFontPadding: false },
  infosTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  infosDetail: { fontSize: 14, color: Pastel.text, fontFamily: Font.medium, lineHeight: 20, includeFontPadding: false },
  infosPhone: { color: Pastel.primary, fontFamily: Font.bold, includeFontPadding: false },
  sectionSubCount: { fontSize: 13, fontFamily: Font.semiBold, color: Pastel.textMuted, includeFontPadding: false },

  /* Nouvelle grille activités */
  activityCardsRow: { gap: 12, paddingRight: 20, paddingBottom: 4 },
  activityCardNew: {
    width: 148,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: Pastel.background,
    borderWidth: 1,
    borderColor: Pastel.border,
    alignItems: "center",
    gap: 6,
  },
  activityCardNewBookable: {
    backgroundColor: Pastel.primary,
    borderColor: Pastel.primary,
  },
  activityCardEmojiLarge: { fontSize: 48, lineHeight: 58, includeFontPadding: false },
  activityCardNameNew: {
    fontSize: 14,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    textAlign: "center",
    includeFontPadding: false,
  },
  activityCardQuantityText: {
    fontSize: 12,
    fontFamily: Font.semiBold,
    color: Pastel.textMuted,
    textAlign: "center",
    includeFontPadding: false,
  },
  activityCardBookBadge: {
    marginTop: 6,
    backgroundColor: "#F97316",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activityCardBookBadgeText: { fontSize: 11, fontFamily: Font.extraBold, color: "#FFFFFF", includeFontPadding: false },
  activityCardFreeBadge: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: Font.semiBold,
    color: Pastel.textMuted,
    includeFontPadding: false,
  },

  /* Nouveaux cards événements */
  eventCardsRow: { gap: 12, paddingRight: 20, paddingBottom: 4 },
  eventCardNew: {
    width: 220,
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
  },
  eventCardNewFeatured: { width: 260, height: 180 },
  eventCardImageNew: { width: "100%", height: "100%" },
  eventCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
    padding: 14,
    gap: 3,
  },
  eventCardNextBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F97316",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  eventCardNextBadgeText: { fontSize: 11, fontFamily: Font.extraBold, color: "#FFFFFF", includeFontPadding: false },
  eventCardDateNew: { fontSize: 11, fontFamily: Font.semiBold, color: "rgba(255,255,255,0.75)", includeFontPadding: false },
  eventCardTitleNew: { fontSize: 14, fontFamily: Font.extraBold, color: "#FFFFFF", lineHeight: 19, includeFontPadding: false },

  heroActivityPillText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  nameHours: { fontSize: 13, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  address: { fontSize: 14, color: Pastel.textMuted, marginBottom: 18, includeFontPadding: false },
  phoneRow: { marginTop: -10, marginBottom: 18 },
  phoneText: { fontSize: 14, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  mainButtonsRow: { flexDirection: "row", gap: 12, marginBottom: 12, flexWrap: "wrap" },

  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Pastel.surface,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  secondaryButtonText: { fontSize: 15, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },

  socialButton: {
    flex: 1,
    backgroundColor: Pastel.primary,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  socialButtonText: { fontSize: 15, fontFamily: Font.bold, color: "#FFFFFF", includeFontPadding: false },

  sectionTitle: {
    fontSize: 18,
    fontFamily: Font.bold,
    color: Pastel.text,
    marginTop: 8,
    marginBottom: 4,
    includeFontPadding: false,
  },
  sectionIntro: {
    fontSize: 13,
    lineHeight: 19,
    color: Pastel.textMuted,
    marginBottom: 8,
    includeFontPadding: false,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusPillOpen: { backgroundColor: "#2F9E44" },
  statusPillClosed: { backgroundColor: "#8A8F98" },
  statusPillText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  hoursInline: { flexDirection: "row", alignItems: "center", gap: 6 },
  hoursModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  hoursModalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Pastel.surface,
    borderRadius: 24,
    padding: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  hoursModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  hoursModalTitle: {
    fontSize: 18,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    includeFontPadding: false,
  },
  hoursRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Pastel.border },
  hoursRowToday: { backgroundColor: Pastel.surfaceAlt, marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 8, borderBottomWidth: 0 },
  hoursLabel: { color: Pastel.text, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  hoursLabelToday: { color: Pastel.text, fontFamily: Font.extraBold, includeFontPadding: false },
  hoursValue: { color: Pastel.textMuted, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  hoursValueToday: { color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  sectionLink: { fontSize: 14, color: Pastel.text, marginTop: 12, includeFontPadding: false },
  activityCard: {
    gap: 6,
    padding: 12,
    borderRadius: 18,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  activityCardFeatured: {
    padding: 14,
    borderColor: Pastel.primary,
    backgroundColor: Pastel.background,
  },
  activityCardInteractive: {
    borderColor: Pastel.primary,
    backgroundColor: Pastel.background,
  },
  featuredCardEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  featuredActivityTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  featuredCardEyebrow: {
    color: Pastel.text,
    fontSize: 12,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  activityCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  activityCardTitle: {
    flex: 1,
    color: Pastel.text,
    fontSize: 15,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  activityQuantityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  activityQuantityText: {
    color: Pastel.textMuted,
    fontSize: 11,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  activityCardText: {
    color: Pastel.text,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
  },
  activityCardFooter: {
    color: Pastel.text,
    fontSize: 12,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  emptyText: { color: Pastel.textMuted, fontSize: 13, includeFontPadding: false },
  closureMessageBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  closureMessageText: { flex: 1, fontSize: 13, color: "#B91C1C", fontFamily: Font.medium, lineHeight: 18, includeFontPadding: false },
  closureBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  closureBannerText: { color: "#B91C1C", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },

  bookingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  bookingCard: {
    backgroundColor: Pastel.surface,
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    gap: 12,
  },
  bookingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bookingTitle: { fontSize: 18, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  bookingSubtitle: { fontSize: 14, color: Pastel.textMuted, includeFontPadding: false },
  bookingNote: { fontSize: 12, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  bookingField: { gap: 6 },
  bookingLabel: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  required: { color: "#EF4444", fontFamily: Font.bold, includeFontPadding: false },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefixBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderBottomWidth: 1, borderBottomColor: Pastel.border,
    paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: Pastel.surfaceAlt, borderRadius: 6,
  },
  prefixBtnText: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  phoneInput: { flex: 1 },
  prefixPicker: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    backgroundColor: Pastel.surfaceAlt, borderRadius: 10,
    padding: 10, marginTop: 4,
  },
  prefixOption: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  prefixOptionActive: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  prefixOptionText: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  prefixOptionTextActive: { color: "#FFFFFF" },
  bookingInput: {
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
    paddingVertical: 8,
    color: Pastel.text,
  },
  calendarCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  calendarNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarMonthLabel: {
    fontSize: 14,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    textTransform: "capitalize",
    includeFontPadding: false,
  },
  calendarWeekdays: { flexDirection: "row" },
  calendarWeekday: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 11,
    color: Pastel.textMuted,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  calendarEmpty: { width: "14.2857%", aspectRatio: 1 },
  calendarDay: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  calendarDaySelected: { backgroundColor: Pastel.primary },
  calendarDayToday: { backgroundColor: Pastel.primarySoft, borderWidth: 1, borderColor: "#BFDBFE" },
  calendarDayPast: { opacity: 0.3 },
  calendarDayText: { fontSize: 13, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  calendarDayTextSelected: { color: "#FFFFFF", fontFamily: Font.extraBold, includeFontPadding: false },
  calendarDayTextPast: { color: Pastel.textMuted },
  dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  dateChipActive: { backgroundColor: Pastel.primary },
  dateChipText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  dateChipTextActive: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  slotChipActive: { backgroundColor: Pastel.primary },
  slotChipDisabled: { backgroundColor: Pastel.surfaceAlt },
  closureNotice: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  closureNoticeText: { fontSize: 13, color: "#92400E", fontFamily: Font.semiBold, includeFontPadding: false },
  slotChipText: { fontSize: 12, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  slotChipTextActive: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },
  slotChipTextDisabled: { color: Pastel.textMuted },
  bookingScrollContent: { gap: 12, paddingBottom: 8 },
  bookingSuccessBlock: { alignItems: "center", gap: 14, paddingVertical: 20 },
  bookingSuccessEmoji: { fontSize: 56 },
  bookingSuccessTitle: { fontSize: 20, fontFamily: Font.extraBold, color: "#059669", textAlign: "center", includeFontPadding: false },
  bookingSuccessActivity: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, textAlign: "center", includeFontPadding: false },
  bookingSuccessSlotBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  bookingSuccessSlotDate: { fontSize: 14, fontFamily: Font.bold, color: "#065F46", textTransform: "capitalize", includeFontPadding: false },
  bookingSuccessSlotTime: { fontSize: 22, fontFamily: Font.extraBold, color: "#059669", includeFontPadding: false },
  bookingSuccessSub: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, includeFontPadding: false },
  calendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    width: "100%",
    justifyContent: "center",
  },
  calendarBtnText: { fontSize: 14, fontFamily: Font.bold, color: "#059669", includeFontPadding: false },
  groupSizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  groupSizeChip: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  groupSizeChipActive: { backgroundColor: Pastel.primary },
  groupSizeChipText: { fontSize: 13, color: Pastel.textMuted, fontFamily: Font.bold, includeFontPadding: false },
  groupSizeChipTextActive: { color: "#FFFFFF" },
  bookingErrorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  bookingErrorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  bookingButton: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: Pastel.primary,
    alignItems: "center",
  },
  bookingButtonLoading: { opacity: 0.6 },
  bookingButtonText: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },

  eventCard: {
    backgroundColor: Pastel.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Pastel.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  eventCardFeatured: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderColor: Pastel.primary,
    backgroundColor: Pastel.background,
  },
  eventCardMedia: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  eventCardImage: { width: "100%", height: "100%" },
  eventCardContent: { flex: 1, gap: 4 },
  eventTitle: { fontSize: 15, fontFamily: Font.semiBold, color: Pastel.text, marginBottom: 4, includeFontPadding: false },
  eventDate: { fontSize: 13, color: Pastel.textMuted, includeFontPadding: false },
  eventCta: { fontSize: 13, color: Pastel.text, fontFamily: Font.semiBold, marginTop: 6, includeFontPadding: false },

  premiumBadge: {
    backgroundColor: "#FEF9C3",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FDE047",
  },
  premiumBadgeText: { fontSize: 11, fontFamily: Font.extraBold, color: "#854D0E", includeFontPadding: false },
  perkLockedBanner: {
    backgroundColor: "#FEF9C3",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#FDE047",
  },
  perkLockedBannerIcon: { fontSize: 14 },
  perkLockedBannerText: { color: "#854D0E", fontSize: 12, fontFamily: Font.bold, flex: 1, includeFontPadding: false },
  perkCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 16,
    gap: 12,
    marginBottom: 10,
  },
  perkCardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  perkCardEmoji: { fontSize: 28 },
  perkCardTextBlock: { flex: 1, gap: 4 },
  perkCardTitle: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  perkCardType: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  perkCardDesc: { color: Pastel.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2, includeFontPadding: false },
  perkCardFreq: { color: Pastel.text, fontSize: 12, fontFamily: Font.bold, marginTop: 2, includeFontPadding: false },
  perkGroupCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    overflow: "hidden",
    marginBottom: 10,
  },
  perkGroupDivider: {
    height: 1,
    backgroundColor: Pastel.border,
  },
  perkGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  perkGroupRowSelected: {
    backgroundColor: Pastel.surfaceAlt,
  },
  perkCardDimmed: { opacity: 0.45 },
  perkCardFreqUsed: { color: Pastel.textMuted },
  perkRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Pastel.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  perkRadioSelected: { borderColor: Pastel.primary, backgroundColor: Pastel.primary },
  perkRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Pastel.surface,
  },
  perkGroupCta: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "#059669",
  },
  perkGroupCtaDisabled: {
    backgroundColor: Pastel.surfaceAlt,
  },
  perkGroupCtaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  perkGroupCtaTextDisabled: {
    color: Pastel.textMuted,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },
  perkGroupCtaLocked: {
    color: "#854D0E",
    fontSize: 13,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  perkUseButton: {
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  perkUseButtonDisabled: { backgroundColor: Pastel.surfaceAlt },
  perkUseButtonText: { color: "#FFFFFF", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  perkUsedBanner: {
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  perkUsedText: { color: Pastel.textMuted, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
});







