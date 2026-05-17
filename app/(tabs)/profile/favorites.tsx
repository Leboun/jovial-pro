import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../services/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type FavoriteVenue = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  cover_url: string | null;
};

export default function FavoritesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? null;

  const [favorites, setFavorites] = useState<FavoriteVenue[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (!userId) { setFavorites([]); return; }
    setLoading(true);

    const { data: favoriteRows, error: favoritesError } = await supabase
      .from("venue_favorites")
      .select("venue_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (favoritesError) { setLoading(false); return; }

    const venueIds = (favoriteRows?.map((r: { venue_id: number }) => r.venue_id) ?? []) as number[];
    if (venueIds.length === 0) { setFavorites([]); setLoading(false); return; }

    const { data: venuesData, error: venuesError } = await supabase
      .from("venues")
      .select("id, name, city, address, cover_url")
      .in("id", venueIds);

    if (venuesError) { setLoading(false); return; }

    const byId = new Map<number, FavoriteVenue>();
    (venuesData ?? []).forEach((v: FavoriteVenue | null) => { if (v?.id) byId.set(v.id, v); });
    setFavorites(venueIds.map((id) => byId.get(id)!).filter(Boolean));
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Mes favoris</Text>
          <Text style={styles.subtitle}>{favorites.length} lieu{favorites.length !== 1 ? "x" : ""} sauvegardé{favorites.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="heart-outline" size={48} color={Pastel.border} />
          <Text style={styles.emptyTitle}>Aucun favori</Text>
          <Text style={styles.emptyText}>Explore la carte et sauvegarde tes lieux préférés.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {favorites.map((venue) => (
            <Pressable
              key={venue.id}
              style={styles.card}
              onPress={() => router.push(`/venue/${venue.id}` as any)}
            >
              {venue.cover_url ? (
                <Image source={{ uri: venue.cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Ionicons name="business-outline" size={22} color={Pastel.textMuted} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{venue.name}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {[venue.address, venue.city].filter(Boolean).join(", ") || "Adresse à renseigner"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  title: { fontSize: 17, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  subtitle: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },

  list: { backgroundColor: Pastel.surface, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  cover: { width: 56, height: 56, borderRadius: 12 },
  coverFallback: { backgroundColor: Pastel.surfaceAlt, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  cardMeta: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
});
