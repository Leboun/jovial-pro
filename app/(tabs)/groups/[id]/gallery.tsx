import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listGroupGalleryMedia } from "@/services/groups";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

export default function GroupGalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = useMemo(() => (id ? Number(id) : null), [id]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<{ id: number; url: string; created_at: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!groupId) return;
      setLoading(true);
      try {
        const rows = await listGroupGalleryMedia(groupId);
        if (mounted) {
          setItems(rows.map((row) => ({ id: row.id, url: row.url, created_at: row.created_at })));
        }
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [groupId]);

  const screenWidth = Dimensions.get("window").width;
  const gap = 10;
  const columns = 3;
  const tileSize = Math.floor((screenWidth - 16 * 2 - gap * (columns - 1)) / columns);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Galerie</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={Pastel.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={40} color="#D1D5DB" />
          <Text style={styles.emptyText}>Aucune photo pour le moment.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {items.map((item) => (
              <View key={item.id} style={[styles.tile, { width: tileSize, height: tileSize }]}>
                <Image source={{ uri: item.url }} style={styles.image} contentFit="cover" />
              </View>
            ))}
          </View>
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: Pastel.textMuted, fontSize: 13, includeFontPadding: false },
  grid: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  image: { width: "100%", height: "100%" },
});
