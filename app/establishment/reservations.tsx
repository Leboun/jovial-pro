import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";
import { supabase } from "@/services/supabase";

type ReservationStatusKey = "today" | "upcoming" | "past";

type ReservationRow = {
  id: number;
  starts_at: string;
  ends_at: string | null;
  status: string | null;
  payment_status: string | null;
  contact_firstname: string | null;
  contact_lastname: string | null;
  contact_phone: string | null;
  price_cents: number | null;
  currency: string | null;
  games?: { name?: string | null } | null;
};

const TABS: { key: ReservationStatusKey; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "upcoming", label: "À venir" },
  { key: "past", label: "Passées" },
];

export default function EstablishmentReservationsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReservationStatusKey>("today");
  const [reservations, setReservations] = useState<ReservationRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
          if (!gate.ok || !gate.venueId) { if (!cancelled) setReservations([]); return; }
          const { data, error } = await supabase
            .from("reservations")
            .select("id, starts_at, ends_at, status, payment_status, contact_firstname, contact_lastname, contact_phone, price_cents, currency, games(name)")
            .eq("venue_id", gate.venueId)
            .order("starts_at", { ascending: true });
          if (error) throw error;
          if (!cancelled) setReservations((data ?? []) as ReservationRow[]);
        } catch {
          if (!cancelled) setReservations([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [router, userId])
  );

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
      if (!gate.ok || !gate.venueId) return;
      const { data } = await supabase
        .from("reservations")
        .select("id, starts_at, ends_at, status, payment_status, contact_firstname, contact_lastname, contact_phone, price_cents, currency, games(name)")
        .eq("venue_id", gate.venueId)
        .order("starts_at", { ascending: true });
      setReservations((data ?? []) as ReservationRow[]);
    } catch { /* ignore */ } finally {
      setRefreshing(false);
    }
  }, [router, userId]);

  const filteredReservations = useMemo(() => {
    const now = new Date();
    const todayKey = now.toDateString();

    return reservations.filter((reservation) => {
      const startsAt = new Date(reservation.starts_at);
      if (activeTab === "today") return startsAt.toDateString() === todayKey;
      if (activeTab === "upcoming") return startsAt > now && startsAt.toDateString() !== todayKey;
      return startsAt < now && startsAt.toDateString() !== todayKey;
    });
  }, [activeTab, reservations]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleUpdateStatus = async (reservationId: number, newStatus: "confirmed" | "cancelled") => {
    const label = newStatus === "confirmed" ? "Confirmer" : "Annuler";
    Alert.alert(
      `${label} la réservation ?`,
      newStatus === "cancelled" ? "Cette action informera le client de l'annulation." : undefined,
      [
        { text: "Retour", style: "cancel" },
        {
          text: label,
          style: newStatus === "cancelled" ? "destructive" : "default",
          onPress: async () => {
            await supabase.from("reservations").update({ status: newStatus }).eq("id", reservationId);
            setReservations((prev) =>
              prev.map((r) => r.id === reservationId ? { ...r, status: newStatus } : r)
            );
          },
        },
      ]
    );
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("Erreur", "Impossible d'ouvrir le téléphone."));
  };

  const statusStyle = (status: string | null) => {
    if (status === "confirmed") return { bg: "#D1FAE5", text: "#065F46", label: "Confirmée" };
    if (status === "cancelled") return { bg: "#FEE2E2", text: "#991B1B", label: "Annulée" };
    return { bg: "#FEF3C7", text: "#92400E", label: "En attente" };
  };

  const formatPrice = (priceCents: number | null, currency: string | null) => {
    if (!priceCents) return "Sans paiement";
    const code = currency ?? "EUR";
    return `${(priceCents / 100).toFixed(2).replace(".", ",")} ${code}`;
  };

  const getContactName = (reservation: ReservationRow) => {
    const first = reservation.contact_firstname?.trim() ?? "";
    const last = reservation.contact_lastname?.trim() ?? "";
    const full = `${first} ${last}`.trim();
    return full || "Client non renseigné";
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.primaryButtonText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#2B4E93"} />
      </View>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Réservations"
      subtitle="Suivez les demandes reçues pour les activités et préparez les prochaines venues."
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabChip, active ? styles.tabChipActive : null]}
            >
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {filteredReservations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucune réservation à afficher</Text>
          <Text style={styles.emptyText}>
            Les réservations apparaîtront ici dès qu'une activité ou un événement recevra une demande.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listScroll}>
          <View style={styles.listColumn}>
            {filteredReservations.map((reservation) => {
              const st = statusStyle(reservation.status);
              return (
                <View key={reservation.id} style={styles.reservationCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>{reservation.games?.name ?? "Réservation"}</Text>
                      <Text style={styles.cardMeta}>{formatDate(reservation.starts_at)}{reservation.ends_at ? ` → ${formatDate(reservation.ends_at)}` : ""}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                    </View>
                  </View>

                  <View style={styles.clientRow}>
                    <View style={styles.clientAvatar}>
                      <Text style={styles.clientAvatarText}>
                        {(reservation.contact_firstname?.[0] ?? "?").toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{getContactName(reservation)}</Text>
                      {reservation.contact_phone ? (
                        <Text style={styles.clientPhone}>{reservation.contact_phone}</Text>
                      ) : null}
                    </View>
                    {reservation.contact_phone ? (
                      <Pressable style={styles.callBtn} onPress={() => handleCall(reservation.contact_phone!)}>
                        <Text style={styles.callBtnText}>📞 Appeler</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.cardDetail}>👥 Groupe : {reservation.contact_phone ? "" : ""}{reservation.price_cents ? `${(reservation.price_cents / 100).toFixed(2)} €` : "Gratuit"}</Text>
                    <Text style={styles.cardDetail}>💳 {reservation.payment_status === "paid" ? "Payé" : "Paiement en attente"}</Text>
                  </View>

                  {reservation.status !== "confirmed" && reservation.status !== "cancelled" ? (
                    <View style={styles.actionBtns}>
                      <Pressable
                        style={styles.confirmBtn}
                        onPress={() => handleUpdateStatus(reservation.id, "confirmed")}
                      >
                        <Text style={styles.confirmBtnText}>✓ Confirmer</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cancelBtn}
                        onPress={() => handleUpdateStatus(reservation.id, "cancelled")}
                      >
                        <Text style={styles.cancelBtnText}>✕ Annuler</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F8F9FA",
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tabChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabChipActive: { backgroundColor: "#2B4E93", borderColor: "#2B4E93" },
  tabText: { color: "#111827", fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#FFFFFF" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 10,
  },
  emptyTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  emptyText: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  listScroll: { paddingBottom: 6 },
  listColumn: { gap: 14, minWidth: 320 },
  reservationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 8,
    minWidth: 320,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardHeaderText: { flex: 1, gap: 4 },
  cardTitle: { color: "#111827", fontSize: 18, fontWeight: "800" },
  cardMeta: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },
  statusPill: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: { color: "#111827", fontSize: 11, fontWeight: "800" },
  cardDetail: { color: "#6B7280", fontSize: 12, lineHeight: 18 },
  detailRow: { flexDirection: "row", gap: 16 },

  clientRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  clientAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  clientAvatarText: { fontSize: 15, fontWeight: "800", color: "#374151" },
  clientInfo: { flex: 1, gap: 2 },
  clientName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  clientPhone: { fontSize: 12, color: "#9CA3AF" },
  callBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, backgroundColor: "#EFF6FF",
  },
  callBtnText: { fontSize: 12, fontWeight: "700", color: "#3B82F6" },

  actionBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  confirmBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderRadius: 12, backgroundColor: "#2B4E93",
  },
  confirmBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  cancelBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  cancelBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "700" },

  primaryButton: {
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
