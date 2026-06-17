import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import {
  EstablishmentEvent,
  EventCategory,
  deleteEvent,
  fetchEventCategories,
  listMyEvents,
  togglePinEvent,
} from "@/services/establishment";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type FilterKey = "all" | "upcoming" | "past";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "upcoming", label: "À venir" },
  { key: "past", label: "Passés" },
];

export default function EstablishmentEventsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EstablishmentEvent[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      let cancelled = false;
      const run = async () => {
        try {
          setLoading(true);
          setError(null);
          const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
          if (!gate.ok || !gate.venueId) { if (!cancelled) setEvents([]); return; }
          const [data, cats] = await Promise.all([
            listMyEvents(gate.venueId),
            fetchEventCategories().catch(() => [] as EventCategory[]),
          ]);
          if (!cancelled) { setEvents(data); setCategories(cats); }
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
        const [data, cats] = await Promise.all([listMyEvents(gate.venueId), fetchEventCategories().catch(() => [] as EventCategory[])]);
        setEvents(data); setCategories(cats);
      }
    } catch { setError("Impossible de charger vos événements."); } finally { setRefreshing(false); }
  }, [router, userId]);

  const handleDelete = useCallback(async (eventId: number) => {
    setConfirmDeleteId(null);
    setActionLoading(eventId);
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch { setError("Impossible de supprimer cet événement."); } finally { setActionLoading(null); }
  }, []);

  const handleTogglePin = useCallback(async (event: EstablishmentEvent) => {
    setActionLoading(event.id);
    try {
      await togglePinEvent(event.id, !event.is_pinned);
      setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, is_pinned: !e.is_pinned } : e));
    } catch { setError("Impossible de modifier l'épinglage."); } finally { setActionLoading(null); }
  }, []);

  const categoryMap = useMemo(() => {
    const map: Record<number, string> = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const getCategoryLabel = (categoryId: number | null | undefined) => {
    if (!categoryId) return null;
    return categoryMap[categoryId] ?? null;
  };

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    const now = new Date();
    return events.filter((e) => filter === "upcoming" ? new Date(e.starts_at) >= now : new Date(e.starts_at) < now);
  }, [events, filter]);

  const upcomingCount = useMemo(() => events.filter((e) => new Date(e.starts_at) >= new Date()).length, [events]);
  const pinnedCount = useMemo(() => events.filter((e) => e.is_pinned).length, [events]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Connexion requise</Text>
        <Pressable style={styles.btnPrimary} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.btnPrimaryText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Événements"
      subtitle="Toute la programmation de ton établissement — épingle un événement pour le mettre en avant."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
    >
      {/* Métriques + bouton nouveau */}
      <View style={styles.topRow}>
        <View style={styles.metrics}>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: Pastel.teal }]}>{upcomingCount}</Text>
            <Text style={styles.metricLabel}>À venir</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: Pastel.primary }]}>{events.length}</Text>
            <Text style={styles.metricLabel}>Au total</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: "#F59E0B" }]}>{pinnedCount}</Text>
            <Text style={styles.metricLabel}>Épinglé{pinnedCount > 1 ? "s" : ""}</Text>
          </View>
        </View>
        <Pressable style={styles.btnPrimary} onPress={() => router.push("/establishment/events/new")}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.btnPrimaryText}>Nouveau</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Filtres */}
      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Liste */}
      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={32} color={Pastel.teal} />
          <Text style={styles.emptyTitle}>Aucun événement</Text>
          <Text style={styles.emptyHint}>Crée ton premier événement pour qu'il apparaisse dans l'app Jovial.</Text>
          <Pressable style={styles.btnPrimary} onPress={() => router.push("/establishment/events/new")}>
            <Ionicons name="add" size={15} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>Créer un événement</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((event) => {
            const categoryLabel = getCategoryLabel(event.category_id);
            const isLoading = actionLoading === event.id;
            const isPast = new Date(event.starts_at) < new Date();

            return (
              <View key={event.id} style={[styles.card, event.is_pinned && styles.cardPinned, isPast && styles.cardPast]}>
                <Pressable
                  style={styles.cardMain}
                  onPress={() => router.push({ pathname: "/establishment/events/[id]", params: { id: String(event.id) } })}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                      {event.is_pinned && <Text style={styles.pinEmoji}>📌</Text>}
                      <Text style={[styles.cardTitle, isPast && styles.cardTitlePast]} numberOfLines={2}>{event.title}</Text>
                    </View>
                    <View style={[styles.statusBadge, event.is_published ? styles.statusOn : styles.statusOff]}>
                      <Text style={[styles.statusText, event.is_published ? styles.statusTextOn : styles.statusTextOff]}>
                        {event.is_published ? "Publié" : "Brouillon"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardMeta}>
                    <View style={styles.cardMetaItem}>
                      <Ionicons name="calendar-outline" size={12} color={isPast ? Pastel.textMuted : Pastel.teal} />
                      <Text style={[styles.cardMetaText, isPast && styles.cardMetaTextPast]}>{formatDate(event.starts_at)}</Text>
                    </View>
                    {categoryLabel && (
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{categoryLabel}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>

                {/* Confirmation suppression inline */}
                {confirmDeleteId === event.id ? (
                  <View style={styles.deleteInline}>
                    <Text style={styles.deleteInlineTitle}>Supprimer cet événement ?</Text>
                    <Text style={styles.deleteInlineHint}>Il sera retiré de l'application et ne sera plus visible.</Text>
                    <View style={styles.deleteRow}>
                      <Pressable style={styles.deleteCancelBtn} onPress={() => setConfirmDeleteId(null)}>
                        <Text style={styles.deleteCancelText}>Annuler</Text>
                      </Pressable>
                      <Pressable style={styles.deleteOkBtn} onPress={() => handleDelete(event.id)} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.deleteOkText}>Supprimer</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.cardActions}>
                    <Pressable
                      style={[styles.btnPin, event.is_pinned && styles.btnPinActive]}
                      onPress={() => handleTogglePin(event)}
                      disabled={isLoading}
                    >
                      <Ionicons name={event.is_pinned ? "pin" : "pin-outline"} size={13} color={event.is_pinned ? "#92400E" : Pastel.text} />
                      <Text style={[styles.btnPinText, event.is_pinned && styles.btnPinTextActive]}>
                        {event.is_pinned ? "Désépingler" : "Épingler"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.btnDanger}
                      onPress={() => setConfirmDeleteId(event.id)}
                      disabled={isLoading}
                    >
                      <Ionicons name="trash-outline" size={13} color="#BE123C" />
                      <Text style={styles.btnDangerText}>Supprimer</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerTitle: { fontSize: 22, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  metrics: { flexDirection: "row", gap: 10, flex: 1 },
  metricCard: { flex: 1, backgroundColor: Pastel.surface, borderRadius: 16, borderWidth: 1, borderColor: Pastel.border, padding: 12, alignItems: "center", gap: 2 },
  metricValue: { fontSize: 24, fontFamily: Font.display, includeFontPadding: false },
  metricLabel: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },

  btnPrimary: { backgroundColor: Pastel.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },

  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filterChip: { borderRadius: 999, borderWidth: 1, borderColor: Pastel.border, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Pastel.surface },
  filterChipActive: { backgroundColor: Pastel.tealSoft, borderColor: Pastel.teal },
  filterText: { color: Pastel.textMuted, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  filterTextActive: { color: Pastel.teal, fontFamily: Font.extraBold },

  list: { gap: 12 },
  card: { backgroundColor: Pastel.surface, borderRadius: 18, borderWidth: 1, borderColor: Pastel.border, padding: 16, gap: 12 },
  cardPinned: { borderColor: "#F59E0B", borderWidth: 2, backgroundColor: "#FFFDF0" },
  cardPast: { opacity: 0.7 },
  cardMain: { gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTopLeft: { flexDirection: "row", alignItems: "flex-start", gap: 6, flex: 1 },
  pinEmoji: { fontSize: 14, lineHeight: 22 },
  cardTitle: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, flex: 1, lineHeight: 22, includeFontPadding: false },
  cardTitlePast: { color: Pastel.textMuted },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusOn: { backgroundColor: Pastel.tealSoft, borderColor: Pastel.teal },
  statusOff: { backgroundColor: Pastel.surfaceAlt, borderColor: Pastel.border },
  statusText: { fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  statusTextOn: { color: Pastel.teal },
  statusTextOff: { color: Pastel.textMuted },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMetaText: { color: Pastel.teal, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  cardMetaTextPast: { color: Pastel.textMuted },
  categoryPill: { backgroundColor: Pastel.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: Pastel.primary },
  categoryPillText: { color: Pastel.primary, fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },

  cardActions: { flexDirection: "row", gap: 8 },
  btnPin: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Pastel.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Pastel.border },
  btnPinActive: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
  btnPinText: { color: Pastel.text, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  btnPinTextActive: { color: "#92400E" },
  btnDanger: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF1F2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#FBCFE8" },
  btnDangerText: { color: "#BE123C", fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },

  deleteInline: { backgroundColor: "#FFF1F2", borderRadius: 14, borderWidth: 1, borderColor: "#FBCFE8", padding: 14, gap: 8 },
  deleteInlineTitle: { color: "#BE123C", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  deleteInlineHint: { color: "#BE123C", fontSize: 12, lineHeight: 17, opacity: 0.8, includeFontPadding: false },
  deleteRow: { flexDirection: "row", gap: 10 },
  deleteCancelBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surface },
  deleteCancelText: { color: Pastel.text, fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  deleteOkBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: "#BE123C" },
  deleteOkText: { color: "#FFFFFF", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },

  emptyCard: { backgroundColor: Pastel.surface, borderRadius: 20, borderWidth: 1, borderColor: Pastel.border, padding: 28, gap: 10, alignItems: "center" },
  emptyTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  emptyHint: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", includeFontPadding: false },
});
