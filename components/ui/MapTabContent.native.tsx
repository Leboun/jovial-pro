import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import MapVenuePreviewCard from "@/components/ui/MapVenuePreviewCard";
import { getMapCache, setMapCache } from "@/services/mapCache";
import { getDemoVenues } from "@/services/demoVenues";
import { getSpotlightVenue } from "@/services/boostBookings";
import { supabase } from "@/services/supabase";
import { getOpeningStatus, type OpeningHours } from "@/utils/openingHours";
import { useAuth } from "@/providers/AuthProvider";
import { Font } from "@/constants/typography";

type Venue = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cover_url?: string | null;
  photos?: string[];
  tags?: string[];
  activities?: string[];
  venue_type?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  contact?: string | null;
  opening_hours?: OpeningHours | null;
  timezone?: string | null;
  social_platform?: "instagram" | "facebook" | null;
  social_url?: string | null;
  isDemo?: boolean;
  distanceLabel?: string;
  distanceKm?: number;
  nextEvent?: { date: string; title: string } | null;
};

type Coords = { latitude: number; longitude: number };

const DEFAULT_REGION: Region = {
  latitude: 48.5149,
  longitude: -2.7654,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.man_made", stylers: [{ visibility: "off" }] },
];

function toNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : NaN;
}

function haversineKm(a: Coords, b: Coords) {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function formatDistanceLabel(km: number) {
  if (!Number.isFinite(km)) return undefined;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}


function dedup(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalize(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMergedVenues(source: Venue[], nextEventByVenue: Map<string, { date: string; title: string }>) {
  const merged = new Map<string, Venue>();

  source.forEach((venue) => {
    merged.set(venue.id, {
      ...venue,
      nextEvent: nextEventByVenue.get(venue.id) ?? null,
    });
  });

  getDemoVenues().forEach((venue) => {
    merged.set(venue.id, {
      id: venue.id,
      name: venue.name,
      lat: venue.lat,
      lng: venue.lng,
      cover_url: venue.cover_url,
      photos: venue.photos,
      tags: venue.tags,
      activities: venue.activities,
      venue_type: venue.venue_type,
      address: venue.address,
      city: venue.city,
      postcode: venue.postcode,
      contact: venue.contact,
      opening_hours: venue.opening_hours,
      timezone: venue.timezone,
      social_platform: venue.social_platform,
      social_url: venue.social_url,
      isDemo: true,
      nextEvent: null,
    });
  });

  return Array.from(merged.values());
}

function pickActivityEmoji(venue: Venue): string {
  const haystack = [...(venue.activities ?? []), ...(venue.tags ?? [])]
    .map((s) => normalize(s))
    .join(" ");
  if (haystack.includes("flechette") || haystack.includes("dart")) return "🎯";
  if (haystack.includes("billard") || haystack.includes("pool")) return "🎱";
  if (haystack.includes("babyfoot") || haystack.includes("baby foot") || haystack.includes("baby-foot")) return "⚽";
  if (haystack.includes("palet")) return "🥏";
  if (haystack.includes("bowling")) return "🎳";
  if (haystack.includes("hache") || haystack.includes("axe")) return "🪓";
  if (haystack.includes("beer pong") || haystack.includes("beerpong")) return "🏓";
  if (haystack.includes("karaok")) return "🎤";
  if (haystack.includes("blind") || haystack.includes("quiz")) return "🎵";
  if (haystack.includes("jeu") || haystack.includes("societe")) return "🎲";
  return "🎮";
}

type PinTone = "open" | "soon" | "closed" | "unknown";

function getPinTone(venue: Venue): PinTone {
  if (!venue.opening_hours) return "unknown";
  const status = getOpeningStatus(venue.opening_hours, venue.timezone ?? null);
  if (status.status === "unknown") return "unknown";
  if (status.isOpen) return "open";
  if ((status.minutesToNextChange ?? Infinity) <= 120) return "soon";
  return "closed";
}

function VenuePin({ venue, isActive, isFavorite, isSpotlight }: { venue: Venue; isActive: boolean; isFavorite: boolean; isSpotlight: boolean }) {
  const hasActivities = (venue.activities?.length ?? 0) > 0;
  const isEventOnly = !hasActivities && !!venue.nextEvent;
  const emoji = isEventOnly ? "📅" : pickActivityEmoji(venue);
  const tone = getPinTone(venue);

  const strokeColor = isSpotlight
    ? "#F97316"
    : tone === "open" ? "#16A34A"
    : tone === "soon" ? "#F97316"
    : tone === "closed" ? "#DC2626"
    : "#9CA3AF";

  const fillColor = isSpotlight
    ? "#FFF7ED"
    : tone === "open" ? "#F0FDF4"
    : tone === "soon" ? "#FFF7ED"
    : tone === "closed" ? "#FFF1F2"
    : "#FFFFFF";

  const size = isActive ? 56 : 48;
  const strokeWidth = isActive || isSpotlight ? 3 : 2.5;
  const r = size / 2 - strokeWidth / 2;
  const badge = isSpotlight ? "⚡" : isFavorite ? "❤️" : (!isActive && venue.nextEvent && !isEventOnly) ? "🔶" : null;
  const fontSize = isActive ? 20 : 17;

  return (
    <View collapsable={false} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        <SvgText
          x={size / 2}
          y={size / 2 + fontSize * 0.35}
          fontSize={fontSize}
          textAnchor="middle"
        >
          {emoji}
        </SvgText>
        {badge ? (
          <SvgText
            x={size - 4}
            y={10}
            fontSize={10}
            textAnchor="middle"
          >
            {badge}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

function PinMarker({ venue, isActive, isFavorite, isSpotlight, onPress }: {
  venue: Venue; isActive: boolean; isFavorite: boolean; isSpotlight: boolean; onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = React.useState(true);
  React.useEffect(() => {
    if (!tracksViewChanges) return;
    const t = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(t);
  }, [tracksViewChanges]);

  // Re-enable tracking when active state changes so the pin re-renders
  const prevActive = React.useRef(isActive);
  React.useEffect(() => {
    if (prevActive.current !== isActive) {
      prevActive.current = isActive;
      setTracksViewChanges(true);
    }
  }, [isActive]);

  return (
    <Marker
      coordinate={{ latitude: venue.lat, longitude: venue.lng }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      <VenuePin venue={venue} isActive={isActive} isFavorite={isFavorite} isSpotlight={isSpotlight} />
    </Marker>
  );
}

export default function MapTabContentNative() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [gpsOk, setGpsOk] = useState(false);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [spotlightVenueId, setSpotlightVenueId] = useState<number | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  const SUGGEST_BANNER_KEY = "suggest_banner_dismissed_at";
  const SUGGEST_EMAIL = "hello@getjovial.fr";
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    AsyncStorage.getItem(SUGGEST_BANNER_KEY).then((val) => {
      if (!val) { setBannerVisible(true); return; }
      if (Date.now() - Number(val) > ONE_WEEK_MS) setBannerVisible(true);
    });
  }, []);

  const dismissBanner = () => {
    AsyncStorage.setItem(SUGGEST_BANNER_KEY, String(Date.now())).catch(() => {});
    setBannerVisible(false);
  };

  const openSuggestForm = async () => {
    const subject = encodeURIComponent("Proposition de lieu — Jovial");
    const body = encodeURIComponent("Bonjour,\n\nJe souhaite proposer le lieu suivant :\n\nNom :\nAdresse :\nVille :\nContact :\n\nMerci !");
    const url = `mailto:${SUGGEST_EMAIL}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {});
  };

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("venue_favorites")
      .select("venue_id")
      .eq("user_id", userId)
      .then(({ data }: { data: { venue_id: number }[] | null }) => {
        if (data) setFavoriteIds(new Set(data.map((r) => String(r.venue_id))));
      });
  }, [userId]);

  const toggleFavorite = async (venueId: string) => {
    if (!userId) return;
    const isFav = favoriteIds.has(venueId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(venueId) : next.add(venueId);
      return next;
    });
    if (isFav) {
      await supabase.from("venue_favorites").delete().eq("user_id", userId).eq("venue_id", Number(venueId));
    } else {
      await supabase.from("venue_favorites").insert({ user_id: userId, venue_id: Number(venueId) });
    }
  };

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setGpsOk(false); return; }

        setGpsOk(true);
        const position = await Location.getCurrentPositionAsync({});
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserCoords(coords);
        setRegion({ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 });

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
          (next) => setUserCoords({ latitude: next.coords.latitude, longitude: next.coords.longitude })
        );

        getSpotlightVenue(coords.latitude, coords.longitude)
          .then((s) => setSpotlightVenueId(s?.venue_id ?? null))
          .catch(() => {});
      } catch {
        setGpsOk(false);
      }
    })();

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const cached = getMapCache();
        if (mounted && cached?.venues?.length) {
          setVenues(getMergedVenues(cached.venues as Venue[], new Map()));
        }

        const [{ data, error }, { data: eventRows }] = await Promise.all([
          supabase
            .from("venues")
            .select("id, name, lat, lng, cover_url, photos, tags, activities, venue_type, address, city, postcode, contact, opening_hours, timezone, social_platform, social_url")
            .not("lat", "is", null)
            .not("lng", "is", null),
          supabase
            .from("events")
            .select("venue_id, starts_at, title, is_pinned")
            .gte("starts_at", new Date().toISOString())
            .order("is_pinned", { ascending: false })
            .order("starts_at", { ascending: true }),
        ]);

        if (error) throw error;

        // Garde l'événement épinglé (ou le prochain) par lieu
        const nextEventByVenue = new Map<string, { date: string; title: string }>();
        (eventRows ?? []).forEach((row: any) => {
          const key = String(row.venue_id);
          const existing = nextEventByVenue.get(key);
          if (!existing || row.is_pinned) {
            nextEventByVenue.set(key, { date: row.starts_at, title: row.title });
          }
        });

        const remoteVenues = (data ?? [])
          .map((row: any) => ({
            id: String(row.id),
            name: String(row.name ?? "Lieu"),
            lat: toNumber(row.lat),
            lng: toNumber(row.lng),
            cover_url: row.cover_url ?? null,
            photos: Array.isArray(row.photos) ? row.photos.filter(Boolean) : [],
            tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
            activities: Array.isArray(row.activities) ? row.activities.filter(Boolean) : [],
            venue_type: row.venue_type ?? null,
            address: row.address ?? null,
            city: row.city ?? null,
            postcode: row.postcode ?? null,
            contact: row.contact ?? null,
            opening_hours: row.opening_hours ?? null,
            timezone: row.timezone ?? null,
            social_platform: row.social_platform ?? null,
            social_url: row.social_url ?? null,
            isDemo: false,
          }))
          .filter((venue: Venue) => Number.isFinite(venue.lat) && Number.isFinite(venue.lng));

        if (!mounted) return;

        const merged = getMergedVenues(remoteVenues, nextEventByVenue);
        setVenues(merged);
        setMapCache({ venues: merged });
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err?.message ?? "Impossible de charger la carte.");
          setVenues(getMergedVenues([], new Set()));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const sortedVenues = useMemo(() => {
    if (!userCoords) return venues;
    return venues
      .map((venue) => {
        const distanceKm = haversineKm(userCoords, { latitude: venue.lat, longitude: venue.lng });
        return { ...venue, distanceLabel: formatDistanceLabel(distanceKm), distanceKm };
      })
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }, [userCoords, venues]);

  useEffect(() => {
    if (sortedVenues.length === 0) { setSelectedVenue(null); setPreviewVisible(false); return; }
    setSelectedVenue((prev) => {
      if (prev && sortedVenues.some((v) => v.id === prev.id)) {
        return sortedVenues.find((v) => v.id === prev.id) ?? sortedVenues[0];
      }
      return sortedVenues[0];
    });
  }, [sortedVenues]);

  const selectedStatus = useMemo(() => {
    if (!selectedVenue?.opening_hours) return null;
    return getOpeningStatus(selectedVenue.opening_hours, selectedVenue.timezone ?? null);
  }, [selectedVenue]);

  const recenter = async () => {
    if (!userCoords) return;
    setRegion({ latitude: userCoords.latitude, longitude: userCoords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 });
  };

  if (loading && venues.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111827" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <MapView
        style={styles.map}
        initialRegion={region}
        region={region}
        onRegionChangeComplete={setRegion}
        customMapStyle={MAP_STYLE}
        showsUserLocation={gpsOk}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
      >
        {sortedVenues.map((venue) => (
          <PinMarker
            key={venue.id}
            venue={venue}
            isActive={selectedVenue?.id === venue.id}
            isFavorite={favoriteIds.has(String(venue.id))}
            isSpotlight={spotlightVenueId === Number(venue.id)}
            onPress={() => { setSelectedVenue(venue); setPreviewVisible(true); }}
          />
        ))}
      </MapView>

      <View style={styles.topControls}>
        {gpsOk ? (
          <Pressable style={styles.recenterButton} onPress={recenter}>
            <Ionicons name="locate" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <Pressable style={styles.recenterButton} onPress={openSuggestForm} hitSlop={6}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {!sortedVenues.length && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Aucun lieu à afficher</Text>
          <Text style={styles.emptyText}>Déplace la carte pour explorer d'autres zones.</Text>
        </View>
      ) : null}

      {bannerVisible && !previewVisible ? (
        <View style={styles.suggestBanner}>
          <View style={styles.suggestBannerContent}>
            <Text style={styles.suggestBannerTitle}>📍 Ton bar n'est pas sur la carte ?</Text>
            <Text style={styles.suggestBannerSub}>Propose-le et gagne 3 mois Premium offerts</Text>
          </View>
          <Pressable style={styles.suggestBannerBtn} onPress={openSuggestForm}>
            <Text style={styles.suggestBannerBtnText}>Proposer</Text>
          </Pressable>
          <Pressable style={styles.suggestBannerClose} onPress={dismissBanner} hitSlop={10}>
            <Ionicons name="close" size={16} color="#6B7280" />
          </Pressable>
        </View>
      ) : null}

      {selectedVenue && previewVisible ? (
        <View pointerEvents="box-none" style={[styles.previewOverlay, screenWidth < 420 && styles.previewOverlaySmall]}>
          <MapVenuePreviewCard
            venue={{
              id: selectedVenue.id,
              name: selectedVenue.name,
              coverUrl: selectedVenue.cover_url ?? null,
              city: selectedVenue.city ?? null,
              address: selectedVenue.address ?? null,
              activities: dedup(selectedVenue.activities ?? []),
              venueType: selectedVenue.venue_type ?? null,
              openingLabel: selectedStatus?.nextChangeLabel ?? selectedStatus?.label ?? selectedVenue.city ?? undefined,
              openingTone: selectedStatus?.status === "open" ? "open" : selectedStatus?.status === "closed" ? "closed" : "neutral",
              isDemo: selectedVenue.isDemo,
              nextEvent: selectedVenue.nextEvent ?? null,
            }}
            onPress={() => router.push({ pathname: "/venue/[id]", params: { id: selectedVenue.id } })}
            onClose={() => setPreviewVisible(false)}
            isFavorite={favoriteIds.has(String(selectedVenue.id))}
            onToggleFavorite={() => toggleFavorite(String(selectedVenue.id))}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  map: {
    flex: 1,
  },
  topControls: {
    position: "absolute",
    top: 56,
    right: 16,
    gap: 10,
  },
  recenterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  errorBanner: {
    position: "absolute",
    left: 16,
    right: 72,
    top: 56,
    backgroundColor: "#FDE7EA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  emptyState: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 16,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  previewOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
  },
  previewOverlaySmall: {
    left: 8,
    right: 8,
    bottom: 16,
  },
  suggestBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    borderWidth: 1,
    borderColor: "#EAD9C0",
  },
  suggestBannerContent: {
    flex: 1,
    gap: 2,
  },
  suggestBannerTitle: {
    fontSize: 13,
    fontFamily: Font.bold,
    color: "#242D41",
    includeFontPadding: false,
  },
  suggestBannerSub: {
    fontSize: 11,
    fontFamily: Font.regular,
    color: "#6B7280",
    includeFontPadding: false,
  },
  suggestBannerBtn: {
    backgroundColor: "#EF6731",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  suggestBannerBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  suggestBannerClose: {
    padding: 4,
  },
});
