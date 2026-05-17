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

type RsvpEvent = {
  id: number;
  status: "interested";
  event: { id: number; title: string; starts_at: string; cover_url: string | null };
};

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

export default function InterestedScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<RsvpEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const userId = session?.user?.id ?? null;

  const loadInterested = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("rsvps")
      .select("id, status, events ( id, title, starts_at, cover_url )")
      .eq("user_id", userId)
      .eq("status", "interested");
    const clean = (data as any[] | null)
      ?.map((row) => {
        const event = row?.events;
        if (!event?.id || !event?.starts_at) return null;
        return { id: Number(row?.id), status: "interested", event: { id: Number(event.id), title: String(event.title ?? ""), starts_at: String(event.starts_at), cover_url: event.cover_url ?? null } } as RsvpEvent;
      })
      .filter((item): item is RsvpEvent => Boolean(item)) ?? [];
    setItems(clean.sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()));
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadInterested(); }, [loadInterested]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Événements intéressés</Text>
          <Text style={styles.subtitle}>{items.length} événement{items.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}><ActivityIndicator color={Pastel.primary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="star-outline" size={48} color={Pastel.border} />
          <Text style={styles.emptyTitle}>Aucun événement</Text>
          <Text style={styles.emptyText}>Les événements qui t'intéressent apparaîtront ici.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {items.map((item) => (
            <Pressable key={item.id} style={styles.card} onPress={() => router.push(`/event/${item.event.id}` as any)}>
              {item.event.cover_url ? (
                <Image source={{ uri: item.event.cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Ionicons name="calendar-outline" size={22} color={Pastel.textMuted} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text numberOfLines={1} style={styles.cardTitle}>{item.event.title}</Text>
                <Text style={styles.cardMeta}>{formatDateTime(item.event.starts_at)}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Intéressé</Text>
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
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: Pastel.surface, borderBottomWidth: 1, borderBottomColor: Pastel.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: Pastel.surfaceAlt },
  title: { fontSize: 17, fontFamily: Font.bold, color: Pastel.text },
  subtitle: { fontSize: 12, color: Pastel.textMuted },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20 },
  list: { backgroundColor: Pastel.surface, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Pastel.border },
  cover: { width: 52, height: 52, borderRadius: 12 },
  coverFallback: { backgroundColor: Pastel.surfaceAlt, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text },
  cardMeta: { fontSize: 12, color: Pastel.textMuted },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: Pastel.surfaceAlt },
  badgeText: { fontSize: 11, fontFamily: Font.bold, color: Pastel.textMuted },
});
