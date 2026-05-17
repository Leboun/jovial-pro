import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { supabase } from "../../../services/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80";

const CARD_WIDTH = Dimensions.get("window").width - 32;

type RsvpEvent = {
  id: number;
  status: "interested" | "going";
  event: {
    id: number;
    title: string;
    starts_at: string;
    cover_url: string | null;
    venue_name: string;
    venue_city: string;
  };
};

function formatDateLong(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function UpcomingScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? null;

  const [items, setItems] = useState<RsvpEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUpcoming = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("rsvps")
      .select("id, status, events ( id, title, starts_at, cover_url, venues ( name, city ) )")
      .eq("user_id", userId)
      .in("status", ["interested", "going"]);

    const clean =
      (data as any[] | null)
        ?.map((row) => {
          const event = row?.events;
          if (!event?.id || !event?.starts_at) return null;
          return {
            id: Number(row?.id),
            status: row?.status === "going" ? "going" : "interested",
            event: {
              id: Number(event.id),
              title: String(event.title ?? ""),
              starts_at: String(event.starts_at),
              cover_url: event.cover_url ?? null,
              venue_name: String(event?.venues?.name ?? "Lieu"),
              venue_city: String(event?.venues?.city ?? ""),
            },
          } as RsvpEvent;
        })
        .filter((item): item is RsvpEvent => Boolean(item))
        .filter((item) => new Date(item.event.starts_at).getTime() >= Date.now()) ?? [];

    setItems(clean.sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()));
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadUpcoming(); }, [loadUpcoming]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Événements à venir</Text>
          <Text style={styles.subtitle}>{items.length} événement{items.length !== 1 ? "s" : ""} prévu{items.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={48} color={Pastel.border} />
          <Text style={styles.emptyTitle}>Aucun événement</Text>
          <Text style={styles.emptyText}>Explore la carte et inscris-toi à des événements.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.card}
              onPress={() => router.push(`/event/${item.event.id}` as any)}
            >
              <Image
                source={item.event.cover_url || FALLBACK_COVER}
                style={styles.cardImage}
                contentFit="cover"
                transition={120}
                cachePolicy="disk"
              />

              {/* Badge RSVP */}
              <View style={[styles.rsvpBadge, item.status === "going" ? styles.rsvpBadgeGoing : styles.rsvpBadgeInterested]}>
                <Text style={[styles.rsvpBadgeText, item.status === "going" ? styles.rsvpBadgeTextGoing : styles.rsvpBadgeTextInterested]}>
                  {item.status === "going" ? "✓ J'y vais" : "· Intéressé"}
                </Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.event.title}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="calendar-outline" size={13} color={Pastel.textMuted} />
                  <Text style={styles.cardMetaText}>
                    {formatDateLong(item.event.starts_at)}{" "}
                    <Text style={styles.cardMetaTime}>à {formatTime(item.event.starts_at)}</Text>
                  </Text>
                </View>
                <View style={styles.cardMeta}>
                  <Ionicons name="location-outline" size={13} color={Pastel.textMuted} />
                  <Text style={styles.cardMetaText} numberOfLines={1}>
                    {[item.event.venue_name, item.event.venue_city].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
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

  list: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },

  card: {
    width: CARD_WIDTH,
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImage: {
    width: CARD_WIDTH,
    height: 180,
  },

  rsvpBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rsvpBadgeGoing: { backgroundColor: Pastel.primary },
  rsvpBadgeInterested: { backgroundColor: "rgba(255,255,255,0.88)" },
  rsvpBadgeText: { fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  rsvpBadgeTextGoing: { color: "#FFFFFF" },
  rsvpBadgeTextInterested: { color: Pastel.text },

  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    lineHeight: 21,
    includeFontPadding: false,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardMetaText: {
    fontSize: 13,
    color: Pastel.textMuted,
    flex: 1,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  cardMetaTime: {
    color: Pastel.text,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },
});
