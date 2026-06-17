import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Image as RNImage } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "@/providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import {
  listGroupMemberCounts,
  listGroups,
  listGroupTopicTags,
  listMyGroups,
} from "@/services/groups";
import { getGroupsListCache, setGroupsListCache } from "@/services/groupsListCache";

type GroupCard = {
  id: number;
  name: string;
  description?: string | null;
  visibility: "public" | "private";
  cover_image_url?: string | null;
  avatar_image_url?: string | null;
  location_place_id?: string | null;
  activity_tag?: string | null;
};

const TABS = [
  { key: "discover", label: "À découvrir", icon: "compass-outline", iconActive: "compass" },
  { key: "mine", label: "Mes clubs", icon: "people-outline", iconActive: "people" },
  { key: "actions", label: "Créer/Rejoindre", icon: "add-circle-outline", iconActive: "add-circle" },
] as const;

export default function GroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<number[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<number, number>>({});
  const [placeLabels, setPlaceLabels] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"discover" | "mine" | "actions">("discover");
  const [sectionReady, setSectionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem("groups.activeSection").then((stored) => {
      if (cancelled) return;
      if (stored === "discover" || stored === "mine" || stored === "actions") {
        setActiveTab(stored);
      }
      setSectionReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const loadGroups = useCallback(async (silent = false) => {
    const cached = getGroupsListCache();
    if (!silent) {
      if (cached) { setGroups(cached.groups); setMyGroupIds(cached.myGroupIds); setLoading(false); }
      else setLoading(true);
    }
    try {
      const groupData = await listGroups();
      const groupIds = groupData.map((g) => g.id);
      const topicTags = groupIds.length > 0 ? await listGroupTopicTags(groupIds) : [];
      const activityMap = new Map<number, { name: string; rank: number }>();
      topicTags.forEach((row) => {
        const name = String(row?.community_group_topics?.label ?? "").trim();
        if (!name) return;
        const current = activityMap.get(row.group_id);
        if (!current || row.rank < current.rank) activityMap.set(row.group_id, { name, rank: row.rank });
      });
      const mappedGroups = groupData.map((g) => ({
        id: g.id, name: g.name, description: g.description, visibility: g.visibility,
        cover_image_url: g.cover_image_url, avatar_image_url: g.avatar_image_url,
        location_place_id: g.location_place_id ?? null, activity_tag: activityMap.get(g.id)?.name ?? null,
      }));
      const groupFingerprint = groupData.map((g) => `${g.id}:${g.updated_at ?? ""}`).join("|");
      let nextMyGroupIds: number[] = [];
      if (userId) {
        const mine = await listMyGroups(userId);
        nextMyGroupIds = mine.map((r: { group_id: number }) => r.group_id);
      }
      const nextFingerprint = `${groupFingerprint}|${nextMyGroupIds.join("|")}|${userId ?? ""}`;
      const cachedFingerprint = getGroupsListCache()?.fingerprint ?? null;
      if (nextFingerprint !== cachedFingerprint) { setGroups(mappedGroups); setMyGroupIds(nextMyGroupIds); }
      setGroupsListCache({ groups: mappedGroups, myGroupIds: nextMyGroupIds, fingerprint: nextFingerprint });
    } catch (error) {
      setGroups([]);
      const err = error as { message?: string; code?: string; details?: string | null };
      const parts = [err?.code ? `Code: ${err.code}` : null, err?.message ? `Message: ${err.message}` : null, err?.details ? `Details: ${err.details}` : null].filter(Boolean);
      if (!silent) Alert.alert("Erreur", parts.length > 0 ? `Impossible de charger les groupes.\n\n${parts.join("\n")}` : "Impossible de charger les groupes.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { loadGroups(); }, [loadGroups]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroups(true);
    setRefreshing(false);
  }, [loadGroups]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem("places.labelCache").then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (parsed && typeof parsed === "object") setPlaceLabels(parsed);
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      if (myGroupIds.length === 0) { if (!cancelled) setMemberCounts({}); return; }
      try {
        const counts = await listGroupMemberCounts(myGroupIds);
        if (!cancelled) setMemberCounts(counts);
      } catch { if (!cancelled) setMemberCounts({}); }
    };
    loadCounts();
    return () => { cancelled = true; };
  }, [myGroupIds]);

  useEffect(() => {
    let cancelled = false;
    const loadPlaces = async () => {
      const ids = Array.from(new Set(groups.map((g) => g.location_place_id).filter((v): v is string => !!v)));
      if (ids.length === 0) return;
      const pending = ids.filter((id) => !placeLabels[id]);
      if (pending.length === 0) return;
      const next: Record<string, string> = {};
      for (let i = 0; i < pending.length; i += 20) {
        try {
          const { lookupPlaces } = await import("@/services/places");
          Object.assign(next, await lookupPlaces(pending.slice(i, i + 20)));
        } catch { /* ignore */ }
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setPlaceLabels((prev) => {
          const merged = { ...prev, ...next };
          AsyncStorage.setItem("places.labelCache", JSON.stringify(merged));
          return merged;
        });
      }
    };
    loadPlaces();
    return () => { cancelled = true; };
  }, [groups, placeLabels]);

  const switchTab = (tab: "discover" | "mine" | "actions") => {
    setActiveTab(tab);
    AsyncStorage.setItem("groups.activeSection", tab);
  };

  const discoverGroups = useMemo(
    () => groups.filter((g) => g.visibility === "public" && !myGroupIds.includes(g.id)),
    [groups, myGroupIds]
  );

  const myGroups = useMemo(() => groups.filter((g) => myGroupIds.includes(g.id)), [groups, myGroupIds]);
  const myGroupsByActivity = useMemo(() => {
    const buckets: Record<string, GroupCard[]> = {};
    myGroups.forEach((g) => {
      const key = g.activity_tag?.trim() || "Autres";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(g);
    });
    Object.values(buckets).forEach((items) => items.sort((a, b) => a.name.localeCompare(b.name)));
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  }, [myGroups]);

  // En-tete compact au scroll (comme Explore) : les icones se reduisent,
  // les noms des onglets restent visibles.
  const scrollY = useRef(new Animated.Value(0)).current;
  const tabIconHeight = scrollY.interpolate({ inputRange: [0, 150], outputRange: [54, 0], extrapolate: "clamp" });
  const tabIconOpacity = scrollY.interpolate({ inputRange: [0, 110], outputRange: [1, 0], extrapolate: "clamp" });
  const tabIconMargin = scrollY.interpolate({ inputRange: [0, 150], outputRange: [4, 0], extrapolate: "clamp" });

  return (
    <View style={styles.screen}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Club</Text>
            <Text style={styles.headerSub}>Rejoins un club près de chez toi</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable key={tab.key} style={styles.tabBtn} onPress={() => switchTab(tab.key)}>
                <Animated.View
                  style={[
                    styles.tabIconWrap,
                    active ? styles.tabIconWrapActive : null,
                    { height: tabIconHeight, opacity: tabIconOpacity, marginBottom: tabIconMargin, overflow: "hidden" },
                  ]}
                >
                  <Ionicons
                    name={(active ? tab.iconActive : tab.icon) as any}
                    size={26}
                    color={active ? Pastel.primary : Pastel.textMuted}
                  />
                </Animated.View>
                <Text style={[styles.tabBtnText, active ? styles.tabBtnTextActive : null]}>{tab.label}</Text>
                <View style={[styles.tabUnderline, active ? styles.tabUnderlineActive : null]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── CONTENT ── */}
      {!sectionReady ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Pastel.primary} />}
        >

          {/* ── À DÉCOUVRIR ── */}
          {activeTab === "discover" ? (
            loading ? (
              <View style={styles.emptyWrap}>
                <ActivityIndicator color={Pastel.primary} />
              </View>
            ) : discoverGroups.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="compass-outline" size={48} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>Aucun club public</Text>
                <Text style={styles.emptyText}>Sois le premier à créer un club dans ta ville.</Text>
              </View>
            ) : (
              <View style={styles.listGap}>
                {discoverGroups.map((group) => {
                  const city = group.location_place_id ? (placeLabels[group.location_place_id] ?? null) : null;
                  return (
                    <Pressable
                      key={group.id}
                      style={styles.listCard}
                      onPress={() => router.push(`/groups/${group.id}`)}
                    >
                      <View style={styles.listAvatar}>
                        {group.avatar_image_url ? (
                          <Image source={{ uri: group.avatar_image_url }} style={styles.listAvatarImg} />
                        ) : group.cover_image_url ? (
                          <Image source={{ uri: group.cover_image_url }} style={styles.listAvatarImg} />
                        ) : (
                          <View style={styles.listAvatarFallback}>
                            <Ionicons name="people-outline" size={20} color={Pastel.textMuted} />
                          </View>
                        )}
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listTitle} numberOfLines={1}>{group.name}</Text>
                        <View style={styles.listMetaRow}>
                          {group.activity_tag ? (
                            <View style={styles.listTagPill}>
                              <Text style={styles.listTagPillText}>{group.activity_tag}</Text>
                            </View>
                          ) : null}
                          {city ? (
                            <View style={styles.listCityRow}>
                              <Ionicons name="location-outline" size={11} color={Pastel.textMuted} />
                              <Text style={styles.listCityText} numberOfLines={1}>{city}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : null}

          {/* ── MES CLUBS ── */}
          {activeTab === "mine" ? (
            !userId ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="person-outline" size={48} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>Non connecté</Text>
                <Pressable style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
                  <Text style={styles.loginBtnText}>Se connecter</Text>
                </Pressable>
              </View>
            ) : loading ? (
              <View style={styles.emptyWrap}>
                <ActivityIndicator color={Pastel.primary} />
              </View>
            ) : myGroups.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="people-outline" size={48} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>Aucun club rejoint</Text>
                <Text style={styles.emptyText}>Rejoins un club ou crée le tien.</Text>
              </View>
            ) : (
              <View style={styles.listGap}>
                {myGroupsByActivity.map(([activity, items]) => (
                  <View key={activity}>
                    <Text style={styles.activityLabel}>{activity.toUpperCase()}</Text>
                    {items.map((group) => (
                      <Pressable
                        key={group.id}
                        style={styles.listCard}
                        onPress={() => router.push(`/groups/${group.id}`)}
                      >
                        <View style={styles.listAvatar}>
                          {group.avatar_image_url ? (
                            <Image source={{ uri: group.avatar_image_url }} style={styles.listAvatarImg} />
                          ) : (
                            <View style={styles.listAvatarFallback}>
                              <Ionicons name="people-outline" size={20} color={Pastel.textMuted} />
                            </View>
                          )}
                        </View>
                        <View style={styles.listInfo}>
                          <Text style={styles.listTitle} numberOfLines={1}>{group.name}</Text>
                          <Text style={styles.listMeta} numberOfLines={1}>
                            {(memberCounts[group.id] ?? 0).toLocaleString("fr-FR")} {(memberCounts[group.id] ?? 0) === 1 ? "membre" : "membres"}
                            {group.location_place_id && placeLabels[group.location_place_id] ? ` · ${placeLabels[group.location_place_id]}` : ""}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            )
          ) : null}

          {/* ── CRÉER / REJOINDRE ── */}
          {activeTab === "actions" ? (
            <View style={styles.actionsSection}>
              <Pressable style={styles.actionCard} onPress={() => router.push("/groups/new")}>
                <View style={[styles.actionIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="add-circle-outline" size={24} color="#2B4E93" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Créer un club</Text>
                  <Text style={styles.actionDesc}>Lance ta communauté autour d'une activité</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => router.push("/groups/join")}>
                <View style={[styles.actionIcon, { backgroundColor: "#D8F0EE" }]}>
                  <Ionicons name="link-outline" size={24} color="#2F7D73" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Rejoindre via un lien</Text>
                  <Text style={styles.actionDesc}>Utilise un lien d'invitation pour rejoindre un club privé</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => router.push("/groups/search")}>
                <View style={[styles.actionIcon, { backgroundColor: "#D6E0F5" }]}>
                  <Ionicons name="search-outline" size={24} color="#2B4E93" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Rechercher un club</Text>
                  <Text style={styles.actionDesc}>Trouve des clubs publics par nom ou activité</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
              </Pressable>
            </View>
          ) : null}

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },

  header: {
    backgroundColor: Pastel.surface,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
    gap: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 28, fontFamily: Font.display, color: Pastel.primary, letterSpacing: 0.5, includeFontPadding: false },
  headerSub: { fontSize: 12, color: Pastel.textMuted, marginTop: 1, fontFamily: Font.regular, includeFontPadding: false },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  tabsRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: Pastel.border },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    paddingTop: 8,
    gap: 2,
  },
  tabIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: { backgroundColor: Pastel.primarySoft },
  tabIcon: { width: 32, height: 32 },
  tabBtnText: { fontSize: 12, fontFamily: Font.semiBold, color: Pastel.textMuted, textAlign: "center", includeFontPadding: false },
  tabBtnTextActive: { color: Pastel.primary, fontFamily: Font.bold, includeFontPadding: false },
  tabUnderline: {
    height: 2,
    width: "60%",
    borderRadius: 999,
    backgroundColor: "transparent",
    marginTop: 2,
  },
  tabUnderlineActive: { backgroundColor: Pastel.primary },

  content: { paddingBottom: 60 },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 48, minHeight: 300 },
  emptyTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },
  loginBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Pastel.primary,
  },
  loginBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 14, includeFontPadding: false },

  /* List */
  listGap: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
  },
  activityLabel: {
    fontSize: 11,
    fontFamily: Font.bold,
    color: Pastel.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
    includeFontPadding: false,
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  listAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  listAvatarImg: { width: "100%", height: "100%" },
  listAvatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  listInfo: { flex: 1, gap: 4 },
  listTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  listMeta: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  listMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  listTagPill: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  listTagPillText: { fontSize: 11, fontFamily: Font.bold, color: "#2B4E93", includeFontPadding: false },
  listCityRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  listCityText: { fontSize: 11, color: Pastel.textMuted, flexShrink: 1, fontFamily: Font.regular, includeFontPadding: false },

  /* Discover filters */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Pastel.text, padding: 0, fontFamily: Font.regular, includeFontPadding: false },
  tagsRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row" },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
  },
  tagChipActive: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  tagChipText: { fontSize: 12, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  tagChipTextActive: { color: "#FFFFFF" },

  /* Actions */
  actionsSection: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInfo: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  actionDesc: { fontSize: 12, color: Pastel.textMuted, lineHeight: 17, fontFamily: Font.regular, includeFontPadding: false },
});
