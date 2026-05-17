import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/services/supabase";

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  category_id: number | null;
  venue_id: number;
  venues: { name: string | null; city: string | null } | null;
  event_categories: { name: string | null } | null;
};

const CATEGORIES: { id: number; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 1, label: "Musique", icon: "musical-notes-outline" },
  { id: 2, label: "Scène", icon: "mic-outline" },
  { id: 3, label: "Jeux", icon: "game-controller-outline" },
  { id: 4, label: "Gastronomie", icon: "restaurant-outline" },
  { id: 9, label: "Festif", icon: "sparkles-outline" },
  { id: 10, label: "Sport", icon: "football-outline" },
];

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=70";

const formatDate = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const formatTime = (value: string) => {
  const d = new Date(value);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const isToday = (value: string) => {
  const d = new Date(value);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const isTomorrow = (value: string) => {
  const d = new Date(value);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
};

const getDateLabel = (value: string) => {
  if (isToday(value)) return "Aujourd'hui";
  if (isTomorrow(value)) return "Demain";
  return formatDate(value);
};

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async (isRefresh = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const now = new Date().toISOString();
      const cutoff = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString();

      const { data, error: fetchError } = await supabase
        .from("events")
        .select(
          "id, title, description, starts_at, ends_at, cover_url, category_id, venue_id, venues(name, city), event_categories(name)"
        )
        .eq("is_published", true)
        .gte("starts_at", now)
        .lte("starts_at", cutoff)
        .order("starts_at", { ascending: true })
        .limit(60);

      if (controller.signal.aborted) return;

      if (fetchError) {
        setError("Impossible de charger les événements.");
        return;
      }

      setEvents((data ?? []) as EventRow[]);
    } catch {
      if (!controller.signal.aborted) {
        setError("Impossible de charger les événements.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    let result = events;

    if (selectedCategory !== null) {
      result = result.filter((e) => e.category_id === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          (e.venues?.name ?? "").toLowerCase().includes(query) ||
          (e.venues?.city ?? "").toLowerCase().includes(query)
      );
    }

    return result;
  }, [events, selectedCategory, searchQuery]);

  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: EventRow[] }[] = [];
    const seen = new Set<string>();

    for (const event of filteredEvents) {
      const label = getDateLabel(event.starts_at);
      if (!seen.has(label)) {
        seen.add(label);
        groups.push({ label, events: [event] });
      } else {
        groups[groups.length - 1].events.push(event);
      }
    }
    return groups;
  }, [filteredEvents]);

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Événements</Text>
            <Text style={styles.headerSub}>
              {loading ? "Chargement..." : `${filteredEvents.length} événement${filteredEvents.length !== 1 ? "s" : ""} à venir`}
            </Text>
          </View>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={"#9CA3AF"} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un événement, un lieu..."
            placeholderTextColor={"#9CA3AF"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={"#9CA3AF"} />
            </Pressable>
          )}
        </View>

        {/* Filtres catégorie */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          <Pressable
            style={[styles.filterChip, selectedCategory === null && styles.filterChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.filterText, selectedCategory === null && styles.filterTextActive]}>
              Tous
            </Text>
          </Pressable>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedCategory(active ? null : cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={13}
                  color={active ? "#111827" : "#9CA3AF"}
                />
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={"#111827"} size="large" />
          <Text style={styles.loadingText}>Chargement des événements...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={"#9CA3AF"} />
          <Text style={styles.emptyTitle}>Impossible de charger</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchEvents()}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={52} color={"#E5E7EB"} />
          <Text style={styles.emptyTitle}>
            {searchQuery || selectedCategory ? "Aucun résultat" : "Aucun événement"}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery || selectedCategory
              ? "Essaie avec d'autres filtres ou une autre recherche."
              : "Les prochains événements apparaîtront ici dès que des établissements les publient."}
          </Text>
          {(searchQuery || selectedCategory) && (
            <Pressable
              style={styles.retryBtn}
              onPress={() => {
                setSearchQuery("");
                setSelectedCategory(null);
              }}
            >
              <Text style={styles.retryBtnText}>Effacer les filtres</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchEvents(true)}
              tintColor={"#111827"}
            />
          }
        >
          {groupedEvents.map((group) => (
            <View key={group.label}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.groupLine} />
              </View>
              {group.events.map((event) => (
                <Pressable
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() =>
                    router.push({
                      pathname: "/event/[id]",
                      params: { id: String(event.id) },
                    })
                  }
                >
                  <Image
                    source={{ uri: event.cover_url ?? FALLBACK_COVER }}
                    style={styles.eventCover}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.eventBody}>
                    <View style={styles.eventMeta}>
                      <View style={styles.eventTimePill}>
                        <Ionicons name="time-outline" size={11} color={"#111827"} />
                        <Text style={styles.eventTimeText}>{formatTime(event.starts_at)}</Text>
                      </View>
                      {event.event_categories?.name && (
                        <View style={styles.eventCatPill}>
                          <Text style={styles.eventCatText}>{event.event_categories.name}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    {event.description ? (
                      <Text style={styles.eventDesc} numberOfLines={2}>
                        {event.description}
                      </Text>
                    ) : null}
                    <View style={styles.eventVenueRow}>
                      <Ionicons name="location-outline" size={13} color={"#9CA3AF"} />
                      <Text style={styles.eventVenueText} numberOfLines={1}>
                        {[event.venues?.name, event.venues?.city].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventArrow}>
                    <Ionicons name="chevron-forward" size={16} color={"#9CA3AF"} />
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  headerSub: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
    marginTop: 2,
    includeFontPadding: false,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    includeFontPadding: false,
  },
  filtersRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#F3F4F6",
    borderColor: "#111827",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    includeFontPadding: false,
  },
  filterTextActive: {
    color: "#111827",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
    includeFontPadding: false,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    includeFontPadding: false,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
    includeFontPadding: false,
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    includeFontPadding: false,
  },
  listContent: {
    padding: 16,
    gap: 4,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 10,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    includeFontPadding: false,
  },
  groupLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  eventCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#0B0B12",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  eventCover: {
    width: 90,
    height: 110,
  },
  eventBody: {
    flex: 1,
    padding: 12,
    gap: 5,
    justifyContent: "center",
  },
  eventMeta: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  eventTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventTimeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    includeFontPadding: false,
  },
  eventCatPill: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventCatText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    includeFontPadding: false,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 20,
    includeFontPadding: false,
  },
  eventDesc: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 17,
    includeFontPadding: false,
  },
  eventVenueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  eventVenueText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
    flex: 1,
    includeFontPadding: false,
  },
  eventArrow: {
    paddingRight: 12,
    alignSelf: "center",
  },
});
