import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { getCarouselVenues, getSpotlightVenue, type CarouselVenue, type SpotlightVenue } from "@/services/boostBookings";
import { supabase } from "@/services/supabase";

type VenueMini = {
  id: number;
  name: string;
  city: string | null;
  cover_url: string | null;
};

type Props = {
  userLat?: number | null;
  userLng?: number | null;
};

export default function ExploreBoostBanner({ userLat, userLng }: Props) {
  const router = useRouter();
  const [carousel, setCarousel] = useState<VenueMini[]>([]);
  const [spotlight, setSpotlight] = useState<VenueMini | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [userLat, userLng]);

  async function load() {
    setLoading(true);
    try {
      // Carrousel
      if (!userLat || !userLng) return;
      const carouselItems = await getCarouselVenues(userLat, userLng);
      if (carouselItems.length > 0) {
        const ids = carouselItems.map((c) => c.venue_id);
        const { data } = await supabase
          .from("venues")
          .select("id, name, city, cover_url")
          .in("id", ids);
        if (data) {
          // Respect de l'ordre aléatoire retourné par la fonction SQL
          const ordered = ids
            .map((id) => data.find((v) => v.id === id))
            .filter(Boolean) as VenueMini[];
          setCarousel(ordered);
        }
      }

      // Coup de projecteur
      if (userLat && userLng) {
        const spot = await getSpotlightVenue(userLat, userLng);
        if (spot) {
          const { data } = await supabase
            .from("venues")
            .select("id, name, city, cover_url")
            .eq("id", spot.venue_id)
            .single();
          setSpotlight(data ?? null);
        }
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading || (carousel.length === 0 && !spotlight)) return null;

  return (
    <View style={styles.root}>
      {/* Coup de projecteur */}
      {spotlight && (
        <View style={styles.spotlightSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.spotlightBadge}>🔦 Coup de projecteur</Text>
            <Text style={styles.sectionSub}>À ne pas manquer aujourd'hui</Text>
          </View>
          <Pressable
            style={styles.spotlightCard}
            onPress={() => router.push(`/venue/${spotlight.id}`)}
          >
            <Image
              source={spotlight.cover_url ?? undefined}
              style={styles.spotlightImage}
              contentFit="cover"
            />
            <View style={styles.spotlightOverlay}>
              <View style={styles.spotlightBadgePill}>
                <Text style={styles.spotlightBadgePillText}>Aujourd'hui</Text>
              </View>
              <Text style={styles.spotlightName}>{spotlight.name}</Text>
              {spotlight.city && (
                <Text style={styles.spotlightCity}>📍 {spotlight.city}</Text>
              )}
            </View>
          </Pressable>
        </View>
      )}

      {/* Carrousel Sélection Jovial */}
      {carousel.length > 0 && (
        <View style={styles.carouselSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.carouselTitle}>⭐ Sélection Jovial</Text>
            <Text style={styles.sectionSub}>Les incontournables du moment</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselScroll}
          >
            {carousel.map((venue) => (
              <Pressable
                key={venue.id}
                style={styles.carouselCard}
                onPress={() => router.push(`/venue/${venue.id}`)}
              >
                <Image
                  source={venue.cover_url ?? undefined}
                  style={styles.carouselImage}
                  contentFit="cover"
                />
                <View style={styles.carouselInfo}>
                  <Text style={styles.carouselName} numberOfLines={1}>{venue.name}</Text>
                  {venue.city && (
                    <Text style={styles.carouselCity} numberOfLines={1}>📍 {venue.city}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 8 },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 12, gap: 2 },
  sectionSub: { color: "#9CA3AF", fontSize: 12 },

  // Coup de projecteur
  spotlightSection: { marginBottom: 24 },
  spotlightBadge: { fontSize: 15, fontWeight: "800", color: "#111827" },
  spotlightCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: "hidden",
    height: 200,
  },
  spotlightImage: { width: "100%", height: "100%" },
  spotlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
    padding: 16,
    gap: 4,
  },
  spotlightBadgePill: {
    alignSelf: "flex-start",
    backgroundColor: "#F97316",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  spotlightBadgePillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  spotlightName: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  spotlightCity: { color: "rgba(255,255,255,0.75)", fontSize: 13 },

  // Carrousel
  carouselSection: { marginBottom: 8 },
  carouselTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  carouselScroll: { paddingHorizontal: 20, gap: 12 },
  carouselCard: {
    width: 150,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  carouselImage: { width: "100%", height: 110 },
  carouselInfo: { padding: 10, gap: 3 },
  carouselName: { color: "#111827", fontSize: 13, fontWeight: "700" },
  carouselCity: { color: "#9CA3AF", fontSize: 11 },
});
