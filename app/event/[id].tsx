// mobile/app/event/[id].tsx
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import * as Calendar from "expo-calendar";
import { supabase } from "@/services/supabase";
import { cancelEventReminder, scheduleEventReminder } from "@/services/notifications";
import { getOpeningStatus, type OpeningHours } from "@/utils/openingHours";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type Event = {
  id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  venue_id: number;
  venues?: {
    name?: string | null;
    city?: string | null;
    address?: string | null;
    cover_url?: string | null;
    venue_type?: string | null;
    opening_hours?: OpeningHours | null;
    timezone?: string | null;
  } | null;
};

type EventMedia = {
  id: number;
  url: string;
  media_type: "photo" | "video";
  position: number;
};

type RsvpStatus = "interested" | "going";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80";
const CALENDAR_PROMPT_KEY = "events.calendarPrompted";


function VenuePreviewCard({
  venue,
  venueId,
  onPress,
}: {
  venue: NonNullable<Event["venues"]>;
  venueId: number;
  onPress: () => void;
}) {
  const openingStatus = getOpeningStatus(venue.opening_hours ?? undefined, venue.timezone ?? null);

  return (
    <Pressable style={venueCard.wrapper} onPress={onPress} hitSlop={8}>
      <View style={venueCard.eyebrow}>
        <Ionicons name="location-outline" size={12} color={Pastel.textMuted} />
        <Text style={venueCard.eyebrowText}>Organisé par</Text>
      </View>
      <View style={venueCard.row}>
        {venue.cover_url ? (
          <Image source={venue.cover_url} style={venueCard.photo} contentFit="cover" transition={120} />
        ) : (
          <View style={[venueCard.photo, venueCard.photoFallback]}>
            <Text style={venueCard.photoFallbackLetter}>
              {(venue.name ?? "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={venueCard.info}>
          <Text style={venueCard.name} numberOfLines={1}>{venue.name ?? "Lieu"}</Text>
          {(venue.city || venue.venue_type) ? (
            <Text style={venueCard.meta} numberOfLines={1}>
              {[venue.venue_type, venue.city].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          {openingStatus.status !== "unknown" ? (
            <View style={[venueCard.statusPill, openingStatus.isOpen ? venueCard.pillOpen : venueCard.pillClosed]}>
              <View style={[venueCard.dot, openingStatus.isOpen ? venueCard.dotOpen : venueCard.dotClosed]} />
              <Text style={[venueCard.statusText, openingStatus.isOpen ? venueCard.statusTextOpen : venueCard.statusTextClosed]}>
                {openingStatus.isOpen ? "Ouvert" : "Fermé"}
                {openingStatus.nextChangeLabel ? ` · ${openingStatus.nextChangeLabel}` : ""}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={venueCard.chevron}>
          <Ionicons name="chevron-forward" size={16} color={Pastel.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const venueCard = StyleSheet.create({
  wrapper: {
    marginTop: 20,
    gap: 10,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eyebrowText: {
    fontSize: 11,
    fontFamily: Font.semiBold,
    color: Pastel.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Pastel.surfaceAlt,
  },
  photoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  photoFallbackLetter: {
    fontSize: 22,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    opacity: 0.35,
    includeFontPadding: false,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    includeFontPadding: false,
  },
  meta: {
    fontSize: 12,
    color: Pastel.textMuted,
    fontFamily: Font.medium,
    includeFontPadding: false,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 2,
  },
  pillOpen: { backgroundColor: "#F0FDF4" },
  pillClosed: { backgroundColor: "#FEF2F2" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOpen: { backgroundColor: "#16A34A" },
  dotClosed: { backgroundColor: "#DC2626" },
  statusText: { fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  statusTextOpen: { color: "#15803D" },
  statusTextClosed: { color: "#B91C1C" },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function EventScreen() {
  const { id, fromVenue } = useLocalSearchParams<{ id: string; fromVenue?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<Event | null>(null);
  const [media, setMedia] = useState<EventMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(null);
  const [interestedCount, setInterestedCount] = useState<number | null>(null);
  const [goingCount, setGoingCount] = useState<number | null>(null);

  const eventId = useMemo(() => Number(id), [id]);
  const showVenueButton = !(fromVenue === "1" || fromVenue === "true");

  useEffect(() => {
    if (!eventId || Number.isNaN(eventId)) return;

    let cancelled = false;

    const fetchEvent = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, description, starts_at, ends_at, cover_url, venue_id, venues(name, city, address, cover_url, venue_type, opening_hours, timezone)"
        )
        .eq("id", eventId)
        .maybeSingle();

      if (error) console.error("Error fetching event", error);

      const { data: mediaData, error: mediaError } = await supabase
        .from("event_media")
        .select("id, url, media_type, position")
        .eq("event_id", eventId)
        .order("position", { ascending: true });

      if (mediaError) console.error("Error fetching event media", mediaError);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      let status: RsvpStatus | null = null;
      if (userId) {
        const { data: rsvpData } = await supabase
          .from("rsvps")
          .select("status")
          .eq("event_id", eventId)
          .eq("user_id", userId)
          .maybeSingle();
        status = (rsvpData?.status as RsvpStatus | undefined) ?? null;
      }

      const { count: interested } = await supabase
        .from("rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "interested");

      const { count: going } = await supabase
        .from("rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "going");

      if (!cancelled) {
        setEvent((data as Event) ?? null);
        setMedia((mediaData as EventMedia[] | null) ?? []);
        setRsvpStatus(status);
        setInterestedCount(interested ?? 0);
        setGoingCount(going ?? 0);
        setLoading(false);
      }
    };

    fetchEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const coverUrl = useMemo(() => {
    if (event?.cover_url) return event.cover_url;
    if (media.length > 0) return media[0].url;
    return FALLBACK_COVER;
  }, [event, media]);

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
    if (match) {
      const [, year, month, day, hours = "0", minutes = "0"] = match;
      const fallback = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes)
      );
      if (!Number.isNaN(fallback.getTime())) return fallback;
    }

    const frMatch = startPart.match(
      /(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/
    );
    if (!frMatch) return null;
    const [, day, month, year, hours = "0", minutes = "0"] = frMatch;
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

  const formatDate = (iso?: string | null) => {
    if (!iso) return "";
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

  const formatInterestedLabel = (count: number | null) => {
    const value = count ?? 0;
    return value <= 1
      ? value + " personne intéressée"
      : value + " personnes intéressées";
  };

  const formatGoingLabel = (count: number | null) => {
    const value = count ?? 0;
    return value <= 1 ? value + " participant" : value + " participants";
  };

  const getVenueLabel = () => {
    const venue = event?.venues;
    if (!venue) return "Voir dans l'app";
    const nameCity = [venue.name, venue.city].filter(Boolean).join(" - ");
    if (nameCity) return nameCity;
    const address = [venue.address, venue.city].filter(Boolean).join(" ");
    return address || "Voir dans l'app";
  };

  const addEventToCalendar = async () => {
    if (!event) return;

    const startDate = parseEventStart(event.starts_at);
    if (!startDate) {
      Alert.alert("Date invalide", "Impossible de lire la date de l'événement.");
      return;
    }
    let endDate =
      parseEventStart(event.ends_at ?? "") ??
      new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    if (endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    }

    const openGoogleCalendarFallback = () => {
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${fmt(startDate)}/${fmt(endDate)}`,
        location: getVenueLabel(),
      });
      Linking.openURL(`https://calendar.google.com/calendar/render?${params.toString()}`).catch(() => undefined);
    };

    if (Platform.OS === "web") {
      openGoogleCalendarFallback();
      return;
    }

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
        title: event.title,
        startDate,
        endDate,
        location: getVenueLabel(),
      });

      Alert.alert("Ajouté !", "L'événement a été ajouté à votre calendrier.");
    } catch {
      // Expo Go : module natif indisponible → fallback Google Calendar
      openGoogleCalendarFallback();
    }
  };

  const markCalendarPrompted = async () => {
    await AsyncStorage.setItem(CALENDAR_PROMPT_KEY, "1");
  };

  const maybePromptCalendar = async (nextStatus: RsvpStatus | null) => {
    if (!nextStatus || !event) return;
    const alreadyPrompted = await AsyncStorage.getItem(CALENDAR_PROMPT_KEY);
    if (alreadyPrompted) return;

    Alert.alert(
      "Ajouter au calendrier ?",
      "Souhaitez-vous ajouter cet événement à votre calendrier ?",
      [
        {
          text: "Ajouter",
          onPress: () => {
            markCalendarPrompted().catch(() => undefined);
            addEventToCalendar().catch(() => undefined);
          },
        },
        {
          text: "Plus tard",
          style: "cancel",
          onPress: () => {
            markCalendarPrompted().catch(() => undefined);
          },
        },
        {
          text: "Ne plus demander",
          onPress: () => {
            markCalendarPrompted().catch(() => undefined);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleRsvp = async (status: RsvpStatus) => {
    if (!event || !eventId || Number.isNaN(eventId)) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    if (!userId) {
      console.error("RSVP requires login");
      return;
    }

    const nextStatus: RsvpStatus | null = rsvpStatus === status ? null : status;
    const deltas = { interested: 0, going: 0 };

    if (rsvpStatus === "interested") deltas.interested -= 1;
    if (rsvpStatus === "going") deltas.going -= 1;
    if (nextStatus === "interested") deltas.interested += 1;
    if (nextStatus === "going") deltas.going += 1;

    if (nextStatus) {
      const { error } = await supabase
        .from("rsvps")
        .upsert(
          { event_id: eventId, user_id: userId, status: nextStatus },
          { onConflict: "event_id,user_id" }
        );
      if (error) {
        console.error("Error updating RSVP", error);
        return;
      }
    } else {
      const { error } = await supabase
        .from("rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);
      if (error) {
        console.error("Error removing RSVP", error);
        return;
      }
    }

    setRsvpStatus(nextStatus);
    if (deltas.interested !== 0) {
      setInterestedCount((prev) => Math.max(0, (prev ?? 0) + deltas.interested));
    }
    if (deltas.going !== 0) {
      setGoingCount((prev) => Math.max(0, (prev ?? 0) + deltas.going));
    }

    if (nextStatus) {
      scheduleEventReminder({
        eventId,
        title: event.title,
        startsAt: event.starts_at,
        status: nextStatus,
      }).catch((err) => console.error("Error scheduling reminder", err));
      maybePromptCalendar(nextStatus).catch(() => undefined);
    } else {
      cancelEventReminder(eventId).catch((err) =>
        console.error("Error canceling reminder", err)
      );
    }
  };

  const openVenue = () => {
    if (!event?.venue_id) return;
    router.push(`/venue/${event.venue_id}` as any);
  };

  const handleShare = async () => {
    if (!event) return;

    const dateStr = formatDate(event.starts_at);
    const venue = getVenueLabel();
    const desc = event.description?.trim();

    // URL universelle : redirige vers App Store (iOS) ou Play Store (Android) selon le device
    const downloadUrl = "https://jovial.app/telecharger";

    const lines = [
      `🎉 ${event.title}`,
      `📅 ${dateStr}`,
      venue !== "Voir dans l'app" ? `📍 ${venue}` : null,
      desc ? `\n${desc}` : null,
      `\n👉 Retrouve cet événement et bien d'autres sur Jovial :`,
      downloadUrl,
    ].filter(Boolean).join("\n");

    try {
      await Share.share({
        message: lines,
        url: Platform.OS === "ios" ? downloadUrl : undefined,
      });
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  const handleAddToCalendar = async () => {
    try {
      await addEventToCalendar();
    } catch (err) {
      console.error("Calendar add failed", err);
      Alert.alert("Erreur", "Impossible d'ajouter l'événement au calendrier.");
    }
  };
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Pastel.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Événement introuvable.</Text>
        <Pressable
          style={[styles.secondaryButton, { marginTop: 16 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrapper}>
          <Image source={coverUrl} style={styles.coverImage} contentFit="cover" transition={200} />
        </View>

        <Pressable style={[styles.backButton, { top: insets.top + 10 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Pastel.text} />
        </Pressable>

        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.date}>{formatDate(event.starts_at)}</Text>

          {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

          {media.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaRow}
            >
              {media.map((item) => (
                <View key={item.id} style={styles.mediaCard}>
                  <Image source={item.url} style={styles.mediaImage} contentFit="cover" transition={120} />
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.rsvpRow}>
            <Pressable
              style={[styles.rsvpButton, rsvpStatus === "interested" ? styles.rsvpActive : null]}
              onPress={() => handleRsvp("interested")}
            >
              <Text style={[styles.rsvpText, rsvpStatus === "interested" ? styles.rsvpTextActive : null]}>Intéressé</Text>
              <Text style={[styles.rsvpSubtext, rsvpStatus === "interested" ? styles.rsvpSubtextActive : null]}>{formatInterestedLabel(interestedCount)}</Text>
            </Pressable>
            <Pressable
              style={[styles.rsvpButton, rsvpStatus === "going" ? styles.rsvpActive : null]}
              onPress={() => handleRsvp("going")}
            >
              <Text style={[styles.rsvpText, rsvpStatus === "going" ? styles.rsvpTextActive : null]}>J'y vais</Text>
              <Text style={[styles.rsvpSubtext, rsvpStatus === "going" ? styles.rsvpSubtextActive : null]}>{formatGoingLabel(goingCount)}</Text>
            </Pressable>
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.ghostButton} onPress={handleAddToCalendar}>
              <Ionicons name="calendar-outline" size={15} color={Pastel.textMuted} />
              <Text style={styles.ghostButtonText}>Calendrier</Text>
            </Pressable>
            <View style={styles.actionDivider} />
            <Pressable style={styles.ghostButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={15} color={Pastel.textMuted} />
              <Text style={styles.ghostButtonText}>Partager</Text>
            </Pressable>
          </View>
          {event.venue_id && event.venues ? (
            <VenuePreviewCard venue={event.venues} venueId={event.venue_id} onPress={openVenue} />
          ) : null}
        </View>
      </ScrollView>
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

  coverWrapper: { paddingHorizontal: 16, paddingTop: 60 },
  coverImage: { width: "100%", height: 240, borderRadius: 28 },

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

  content: { paddingHorizontal: 16, marginTop: 18 },
  title: { fontSize: 24, fontFamily: Font.display, color: Pastel.text, marginBottom: 6, includeFontPadding: false },
  date: { fontSize: 14, color: Pastel.textMuted, marginBottom: 2, includeFontPadding: false },
  description: { fontSize: 14, color: Pastel.textMuted, lineHeight: 20, marginTop: 12, includeFontPadding: false },

  mediaRow: { paddingVertical: 12, gap: 12 },
  mediaCard: {
    width: 220,
    height: 140,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  mediaImage: { width: "100%", height: "100%" },

  rsvpRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  rsvpButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  rsvpActive: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  rsvpText: { color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  rsvpTextActive: { color: "#FFFFFF" },
  rsvpSubtext: { color: Pastel.textMuted, fontSize: 12, marginTop: 4, includeFontPadding: false },
  rsvpSubtextActive: { color: "rgba(255,255,255,0.7)" },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    gap: 0,
  },
  ghostButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
  },
  ghostButtonText: { fontSize: 15, fontFamily: Font.semiBold, color: Pastel.textMuted, includeFontPadding: false },
  actionDivider: { width: 1, height: 20, backgroundColor: Pastel.border },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: Pastel.surface,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  secondaryButtonText: { fontSize: 14, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },

  emptyText: { color: Pastel.textMuted, fontSize: 14, includeFontPadding: false },
});




