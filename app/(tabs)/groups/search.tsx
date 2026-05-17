import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listGroupTopicTags, listGroupTopics, listGroups } from "@/services/groups";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type GroupCard = {
  id: number;
  name: string;
  description?: string | null;
  visibility: "public" | "private";
  cover_image_url?: string | null;
  avatar_image_url?: string | null;
  location_place_id?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  activity_tag?: string | null;
};

const toRad = (value: number) => (value * Math.PI) / 180;
const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
};

export default function GroupSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const inputRef = useRef<TextInput>(null);

  const [liveQuery, setLiveQuery] = useState(String(params.q ?? "").trim());
  const query = liveQuery.trim().toLowerCase();
  const category = String(params.category ?? "").trim();
  const topicIdRaw = String(params.topicId ?? "").trim();
  const topicId = topicIdRaw ? Number(topicIdRaw) : null;
  const topicLabel = String(params.topicLabel ?? "").trim();
  const placeId = String(params.placeId ?? "").trim();
  const placeLabel = String(params.placeLabel ?? "").trim();
  const placeLatRaw = String(params.placeLat ?? "").trim();
  const placeLngRaw = String(params.placeLng ?? "").trim();
  const radius = String(params.radius ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [placeLabels, setPlaceLabels] = useState<Record<string, string>>({});
  const [topicLabelMap, setTopicLabelMap] = useState<Record<number, string>>({});
  const [groupTopicMap, setGroupTopicMap] = useState<Record<number, { topicIds: number[]; categories: string[] }>>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem("places.labelCache").then((raw) => {
      if (cancelled || !raw) return;
      try { setPlaceLabels(JSON.parse(raw)); } catch {}
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!placeId || !placeLabel) return;
    AsyncStorage.getItem("places.labelCache").then(async (raw) => {
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      if (parsed[placeId] !== placeLabel) {
        parsed[placeId] = placeLabel;
        await AsyncStorage.setItem("places.labelCache", JSON.stringify(parsed));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [placeId, placeLabel]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [groupData, topicData] = await Promise.all([listGroups(), listGroupTopics()]);
        if (cancelled) return;
        const groupIds = groupData.map((g) => g.id);
        const topicTags = groupIds.length > 0 ? await listGroupTopicTags(groupIds) : [];
        const activityMap = new Map<number, { name: string; rank: number }>();
        const topicMap: Record<number, { topicIds: number[]; categories: string[] }> = {};
        topicTags.forEach((row) => {
          const name = String(row?.community_group_topics?.label ?? "").trim();
          if (!name) return;
          const current = activityMap.get(row.group_id);
          if (!current || row.rank < current.rank) activityMap.set(row.group_id, { name, rank: row.rank });
          if (!topicMap[row.group_id]) topicMap[row.group_id] = { topicIds: [], categories: [] };
          if (!topicMap[row.group_id].topicIds.includes(row.topic_id)) topicMap[row.group_id].topicIds.push(row.topic_id);
          const cat = String(row?.community_group_topics?.category ?? "").trim();
          if (cat && !topicMap[row.group_id].categories.includes(cat)) topicMap[row.group_id].categories.push(cat);
        });
        const mappedGroups = groupData.map((g) => ({
          id: g.id, name: g.name, description: g.description, visibility: g.visibility,
          cover_image_url: g.cover_image_url, avatar_image_url: g.avatar_image_url,
          location_place_id: g.location_place_id ?? null,
          location_lat: g.location_lat ?? null, location_lng: g.location_lng ?? null,
          activity_tag: activityMap.get(g.id)?.name ?? null,
        }));
        if (!cancelled) {
          setGroups(mappedGroups);
          setGroupTopicMap(topicMap);
          const labels: Record<number, string> = {};
          topicData.forEach((t) => { labels[t.id] = t.label; });
          setTopicLabelMap(labels);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredGroups = useMemo(() => {
    let result = groups.filter((g) => g.visibility === "public");
    if (query.length > 0) result = result.filter((g) => g.name.toLowerCase().includes(query));
    if (topicId) result = result.filter((g) => groupTopicMap[g.id]?.topicIds.includes(topicId));
    else if (category) result = result.filter((g) => groupTopicMap[g.id]?.categories.includes(category));
    const lat = placeLatRaw ? Number(placeLatRaw) : null;
    const lng = placeLngRaw ? Number(placeLngRaw) : null;
    const radiusKm = radius && radius !== "+" ? Number(radius) : null;
    if (radiusKm && Number.isFinite(radiusKm) && lat !== null && lng !== null) {
      result = result.filter((g) => {
        if (g.location_lat == null || g.location_lng == null) return false;
        return distanceKm(lat, lng, g.location_lat, g.location_lng) <= radiusKm;
      });
    } else if (placeId) {
      result = result.filter((g) => g.location_place_id === placeId);
    }
    return result;
  }, [groups, query, topicId, category, placeId, placeLatRaw, placeLngRaw, radius, groupTopicMap]);

  const placeLabelText = placeLabel || (placeId ? placeLabels[placeId] ?? "" : "");
  const topicLabelText = topicLabel || (topicId ? topicLabelMap[topicId] ?? "" : "");

  const activeFilters = [
    query ? `"${query}"` : null,
    topicLabelText || category || null,
    placeLabelText ? `${placeLabelText}${radius ? ` · ${radius} km` : ""}` : null,
  ].filter(Boolean);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Pastel.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={liveQuery}
            onChangeText={setLiveQuery}
            placeholder="Rechercher un club..."
            placeholderTextColor={Pastel.textMuted}
            autoCorrect={false}
            clearButtonMode="while-editing"
            autoFocus={!params.q}
          />
        </View>
        {!loading && (
          <Text style={styles.countText}>{filteredGroups.length}</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {activeFilters.length > 0 ? (
          <View style={styles.filtersRow}>
            {activeFilters.map((f, i) => (
              <View key={i} style={styles.filterPill}>
                <Text style={styles.filterPillText}>{f}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#111827" />
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucun club trouvé</Text>
            <Text style={styles.emptyText}>Modifie tes critères de recherche.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredGroups.map((group) => (
              <Pressable
                key={group.id}
                style={styles.card}
                onPress={() => router.push(`/groups/${group.id}`)}
              >
                <View style={styles.avatarWrap}>
                  {group.avatar_image_url ? (
                    <Image source={{ uri: group.avatar_image_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>Club</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{group.name}</Text>
                  <View style={styles.cardMetaRow}>
                    {group.activity_tag ? (
                      <View style={styles.cardTagPill}>
                        <Text style={styles.cardTagPillText}>{group.activity_tag}</Text>
                      </View>
                    ) : null}
                    {group.location_place_id && placeLabels[group.location_place_id] ? (
                      <View style={styles.cardCityRow}>
                        <Ionicons name="location-outline" size={11} color={Pastel.textMuted} />
                        <Text style={styles.cardCityText} numberOfLines={1}>
                          {placeLabels[group.location_place_id]}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {group.description ? (
                    <Text style={styles.cardDesc} numberOfLines={1}>{group.description}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Pastel.text, padding: 0, fontFamily: Font.regular },
  countText: { fontSize: 13, fontFamily: Font.bold, color: Pastel.textMuted, flexShrink: 0 },

  container: { padding: 16, paddingBottom: 60, gap: 16 },
  filtersRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterPill: {
    backgroundColor: Pastel.primarySoft, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Pastel.primary,
  },
  filterPillText: { fontSize: 12, fontFamily: Font.semiBold, color: Pastel.primary },

  loadingState: { paddingVertical: 40, alignItems: "center" },
  emptyState: { alignItems: "center", gap: 8, paddingTop: 40 },
  emptyTitle: { fontSize: 15, fontFamily: Font.bold, color: Pastel.text },
  emptyText: { fontSize: 13, color: Pastel.textMuted, fontFamily: Font.regular },

  list: {
    backgroundColor: Pastel.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Pastel.border,
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  avatarWrap: {
    width: 52, height: 52, borderRadius: 14,
    overflow: "hidden", backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  avatar: { width: "100%", height: "100%" },
  avatarFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontSize: 11, fontFamily: Font.bold, color: Pastel.textMuted },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  cardTagPill: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardTagPillText: { fontSize: 11, fontFamily: Font.bold, color: "#6366F1" },
  cardCityRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardCityText: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.regular },
  cardDesc: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular },
});
