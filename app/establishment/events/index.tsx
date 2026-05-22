import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import { EstablishmentEvent, deleteEvent, listMyEvents, togglePinEvent } from "@/services/establishment";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";

type FilterKey = "all" | "upcoming" | "past";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "upcoming", label: "À venir" },
  { key: "past", label: "Passés" },
];

const EVENT_CATEGORIES: Record<number, string> = {
  1: "Musique",
  2: "Scène & Parole",
  3: "Jeux",
  4: "Gastronomie & Boissons",
  5: "Société & Engagement",
  6: "Numérique & Innovation",
  7: "Bien-être",
  8: "Inclusivité & Communautés",
  9: "Festif",
  10: "Sport & Retransmissions sportives",
  11: "Autres",
};

export default function EstablishmentEventsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EstablishmentEvent[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [venueId, setVenueId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      let cancelled = false;
      const run = async () => {
        try {
          setLoading(true);
          setError(null);
          const gate = await ensureEstablishmentFeatureAccess({
            userId,
            replace: (href) => router.replace(href as never),
          });
          if (!gate.ok || !gate.venueId) {
            if (!cancelled) setEvents([]);
            return;
          }
          const data = await listMyEvents(gate.venueId);
          if (!cancelled) { setEvents(data); setVenueId(gate.venueId); }
        } catch {
          if (!cancelled) setError("Impossible de charger vos événements.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      run();
      return () => { cancelled = true; };
    }, [router, userId])
  );

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
      if (gate.ok && gate.venueId) {
        setEvents(await listMyEvents(gate.venueId));
        setVenueId(gate.venueId);
      }
    } catch {
      setError("Impossible de charger vos événements.");
    } finally {
      setRefreshing(false);
    }
  }, [router, userId]);

  const handleDelete = useCallback(async (eventId: number) => {
    setConfirmDeleteId(null);
    setActionLoading(eventId);
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch {
      setError("Impossible de supprimer cet événement.");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleTogglePin = useCallback(async (event: EstablishmentEvent) => {
    setActionLoading(event.id);
    try {
      await togglePinEvent(event.id, !event.is_pinned);
      setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, is_pinned: !e.is_pinned } : e));
    } catch {
      setError("Impossible de modifier l'épinglage.");
    } finally {
      setActionLoading(null);
    }
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    const now = new Date();
    return events.filter((event) => {
      const starts = new Date(event.starts_at);
      return filter === "upcoming" ? starts >= now : starts < now;
    });
  }, [events, filter]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const getCategoryLabel = (categoryId: number | null | undefined) => {
    if (!categoryId) return null;
    return EVENT_CATEGORIES[categoryId] ?? "Catégorie inconnue";
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.primary} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.primaryText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Événements"
      subtitle="Retrouvez ici toute la programmation du lieu. Épinglez un événement pour le mettre en avant dans l'application."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Vos événements</Text>
        <Pressable style={styles.primarySmall} onPress={() => router.push("/establishment/events/new")}>
          <Text style={styles.primaryText}>+ Nouveau</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {confirmDeleteId ? (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteConfirmText}>Supprimer cet événement ?</Text>
          <Text style={styles.deleteConfirmHint}>Il sera retiré de l'application et ne sera plus visible.</Text>
          <View style={styles.deleteConfirmRow}>
            <Pressable style={styles.deleteConfirmCancel} onPress={() => setConfirmDeleteId(null)}>
              <Text style={styles.deleteConfirmCancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.deleteConfirmOk} onPress={() => handleDelete(confirmDeleteId)}>
              <Text style={styles.deleteConfirmOkText}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucun événement</Text>
          <Text style={styles.emptyText}>Créez un premier événement en quelques secondes.</Text>
          <Pressable style={styles.primary} onPress={() => router.push("/establishment/events/new")}>
            <Text style={styles.primaryText}>Créer un événement</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((event) => {
            const categoryLabel = getCategoryLabel(event.category_id);
            const isLoading = actionLoading === event.id;
            return (
              <View key={event.id} style={styles.card}>
                <Pressable
                  style={styles.cardMain}
                  onPress={() =>
                    router.push({
                      pathname: "/establishment/events/[id]",
                      params: { id: String(event.id) },
                    })
                  }
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardTitleRow}>
                      {event.is_pinned ? <Text style={styles.pinIcon}>📌</Text> : null}
                      <Text style={styles.cardTitle}>{event.title}</Text>
                    </View>
                    <View style={[styles.status, event.is_published ? styles.statusOn : styles.statusOff]}>
                      <Text style={styles.statusText}>{event.is_published ? "Publié" : "Brouillon"}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardMeta}>
                    {formatDate(event.starts_at)}
                    {categoryLabel ? ` · ${categoryLabel}` : ""}
                  </Text>
                </Pressable>
                <View style={styles.cardActions}>
                  <Pressable
                    style={[styles.pinButton, event.is_pinned ? styles.pinButtonActive : null]}
                    onPress={() => handleTogglePin(event)}
                    disabled={isLoading}
                  >
                    <Text style={[styles.pinButtonText, event.is_pinned ? styles.pinButtonTextActive : null]}>
                      {event.is_pinned ? "Désépingler" : "Épingler"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.dangerButton}
                    onPress={() => setConfirmDeleteId(event.id)}
                    disabled={isLoading}
                  >
                    <Text style={styles.dangerButtonText}>Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    gap: 12,
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  filterChipActive: {
    backgroundColor: "#FDE68A",
    borderColor: "#FDE68A",
  },
  filterText: { color: "#9CA3AF", fontSize: 12 },
  filterTextActive: { color: "#92400E", fontWeight: "700" },
  list: { gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  cardMain: { gap: 6 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  pinIcon: { fontSize: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  cardMeta: { fontSize: 12, color: "#9CA3AF" },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  statusOn: { backgroundColor: "#F3F4F6" },
  statusOff: { backgroundColor: "#F3F4F6" },
  statusText: { color: "#111827", fontSize: 11, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 8 },
  pinButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  pinButtonActive: {
    backgroundColor: "#FDE68A",
    borderColor: "#FDE68A",
  },
  pinButtonText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  pinButtonTextActive: { color: "#92400E" },
  dangerButton: {
    backgroundColor: "#FFF1F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#FBCFE8",
  },
  dangerButtonText: { color: "#BE123C", fontSize: 12, fontWeight: "700" },
  deleteConfirm: {
    backgroundColor: "#FFF1F2",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    padding: 18,
    gap: 10,
  },
  deleteConfirmText: { color: "#BE123C", fontSize: 15, fontWeight: "800" },
  deleteConfirmHint: { color: "#BE123C", fontSize: 13, lineHeight: 18, opacity: 0.8 },
  deleteConfirmRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  deleteConfirmCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  deleteConfirmCancelText: { color: "#111827", fontSize: 14, fontWeight: "700" },
  deleteConfirmOk: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#BE123C",
  },
  deleteConfirmOkText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  emptyText: { fontSize: 13, color: "#9CA3AF" },
  error: { color: "#DC2626", fontSize: 12 },
  primary: {
    backgroundColor: "#2B4E93",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primarySmall: {
    backgroundColor: "#2B4E93",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "700" },
});
