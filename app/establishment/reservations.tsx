import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";
import { supabase } from "@/services/supabase";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

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
    } catch { /* ignore */ } finally { setRefreshing(false); }
  }, [router, userId]);

  const filteredReservations = useMemo(() => {
    const now = new Date();
    const todayKey = now.toDateString();
    return reservations.filter((r) => {
      const startsAt = new Date(r.starts_at);
      if (activeTab === "today") return startsAt.toDateString() === todayKey;
      if (activeTab === "upcoming") return startsAt > now && startsAt.toDateString() !== todayKey;
      return startsAt < now && startsAt.toDateString() !== todayKey;
    });
  }, [activeTab, reservations]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return reservations.filter((r) => new Date(r.starts_at).toDateString() === today).length;
  }, [reservations]);

  const upcomingCount = useMemo(() => {
    const now = new Date();
    return reservations.filter((r) => new Date(r.starts_at) > now && new Date(r.starts_at).toDateString() !== now.toDateString()).length;
  }, [reservations]);

  const pendingCount = useMemo(() => reservations.filter((r) => !r.status || r.status === "pending").length, [reservations]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
            setReservations((prev) => prev.map((r) => r.id === reservationId ? { ...r, status: newStatus } : r));
          },
        },
      ]
    );
  };

  const handleCall = (phone: string) => {
    const url = typeof window !== "undefined" ? `tel:${phone}` : `tel:${phone}`;
    Linking.openURL(url).catch(() => Alert.alert("Erreur", "Impossible d'ouvrir le téléphone."));
  };

  const statusStyle = (status: string | null) => {
    if (status === "confirmed") return { bg: Pastel.tealSoft, text: Pastel.teal, label: "Confirmée", border: Pastel.teal };
    if (status === "cancelled") return { bg: "#FEE2E2", text: "#991B1B", label: "Annulée", border: "#FECACA" };
    return { bg: "#FFFBEB", text: "#92400E", label: "En attente", border: "#FDE68A" };
  };

  const formatPrice = (priceCents: number | null) => {
    if (!priceCents) return "Gratuit";
    return `${(priceCents / 100).toFixed(2).replace(".", ",")} €`;
  };

  const getContactName = (r: ReservationRow) => {
    const full = `${r.contact_firstname?.trim() ?? ""} ${r.contact_lastname?.trim() ?? ""}`.trim();
    return full || "Client non renseigné";
  };

  const getInitial = (r: ReservationRow) =>
    (r.contact_firstname?.[0] ?? r.contact_lastname?.[0] ?? "?").toUpperCase();

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
      title="Réservations"
      subtitle="Suivez et gérez les demandes reçues pour vos activités."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
    >
      {/* Métriques */}
      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: Pastel.teal }]}>{todayCount}</Text>
          <Text style={styles.metricLabel}>Aujourd'hui</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: Pastel.primary }]}>{upcomingCount}</Text>
          <Text style={styles.metricLabel}>À venir</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: pendingCount > 0 ? "#92400E" : Pastel.textMuted }]}>{pendingCount}</Text>
          <Text style={styles.metricLabel}>En attente</Text>
        </View>
      </View>

      {/* Onglets */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Liste */}
      {filteredReservations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="bookmark-outline" size={32} color={Pastel.teal} />
          <Text style={styles.emptyTitle}>Aucune réservation</Text>
          <Text style={styles.emptyText}>
            {activeTab === "today"
              ? "Aucune réservation aujourd'hui."
              : activeTab === "upcoming"
              ? "Aucune réservation à venir."
              : "Aucune réservation passée."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredReservations.map((reservation) => {
            const st = statusStyle(reservation.status);
            return (
              <View key={reservation.id} style={styles.card}>
                {/* Header */}
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <Text style={styles.cardTitle}>{reservation.games?.name ?? "Réservation"}</Text>
                    <View style={styles.cardMeta}>
                      <Ionicons name="calendar-outline" size={12} color={Pastel.teal} />
                      <Text style={styles.cardMetaText}>{formatDate(reservation.starts_at)}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
                    <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Client */}
                <View style={styles.clientRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitial(reservation)}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{getContactName(reservation)}</Text>
                    {reservation.contact_phone && (
                      <Text style={styles.clientPhone}>{reservation.contact_phone}</Text>
                    )}
                  </View>
                  {reservation.contact_phone && (
                    <Pressable style={styles.callBtn} onPress={() => handleCall(reservation.contact_phone!)}>
                      <Ionicons name="call-outline" size={14} color={Pastel.teal} />
                      <Text style={styles.callBtnText}>Appeler</Text>
                    </Pressable>
                  )}
                </View>

                {/* Détails */}
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Ionicons name="card-outline" size={13} color={Pastel.textMuted} />
                    <Text style={styles.detailText}>{formatPrice(reservation.price_cents)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons
                      name={reservation.payment_status === "paid" ? "checkmark-circle-outline" : "time-outline"}
                      size={13}
                      color={reservation.payment_status === "paid" ? Pastel.success : Pastel.textMuted}
                    />
                    <Text style={styles.detailText}>
                      {reservation.payment_status === "paid" ? "Payé" : "Paiement en attente"}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                {(!reservation.status || reservation.status === "pending") && (
                  <View style={styles.actions}>
                    <Pressable style={styles.btnConfirm} onPress={() => handleUpdateStatus(reservation.id, "confirmed")}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      <Text style={styles.btnConfirmText}>Confirmer</Text>
                    </Pressable>
                    <Pressable style={styles.btnCancel} onPress={() => handleUpdateStatus(reservation.id, "cancelled")}>
                      <Ionicons name="close" size={14} color="#EF4444" />
                      <Text style={styles.btnCancelText}>Annuler</Text>
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
  btnPrimary: { backgroundColor: Pastel.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },

  metrics: { flexDirection: "row", gap: 12 },
  metricCard: { flex: 1, backgroundColor: Pastel.surface, borderRadius: 18, borderWidth: 1, borderColor: Pastel.border, padding: 14, alignItems: "center", gap: 3 },
  metricValue: { fontSize: 28, fontFamily: Font.display, includeFontPadding: false },
  metricLabel: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },

  tabRow: { flexDirection: "row", gap: 8 },
  tab: { borderRadius: 999, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surface, paddingHorizontal: 16, paddingVertical: 9 },
  tabActive: { backgroundColor: Pastel.teal, borderColor: Pastel.teal },
  tabText: { color: Pastel.textMuted, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  tabTextActive: { color: "#FFFFFF", fontFamily: Font.extraBold, includeFontPadding: false },

  emptyCard: { backgroundColor: Pastel.surface, borderRadius: 22, borderWidth: 1, borderColor: Pastel.border, padding: 28, gap: 10, alignItems: "center" },
  emptyTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  emptyText: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", includeFontPadding: false },

  list: { gap: 14 },
  card: { backgroundColor: Pastel.surface, borderRadius: 20, borderWidth: 1, borderColor: Pastel.border, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardTopLeft: { flex: 1, gap: 6 },
  cardTitle: { color: Pastel.text, fontSize: 17, fontFamily: Font.extraBold, includeFontPadding: false },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardMetaText: { color: Pastel.teal, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },

  divider: { height: 1, backgroundColor: Pastel.border },

  clientRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Pastel.tealSoft, borderWidth: 1, borderColor: Pastel.teal, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: Font.extraBold, color: Pastel.teal, includeFontPadding: false },
  clientInfo: { flex: 1, gap: 2 },
  clientName: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  clientPhone: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: Pastel.tealSoft, borderWidth: 1, borderColor: Pastel.teal },
  callBtnText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.teal, includeFontPadding: false },

  detailRow: { flexDirection: "row", gap: 16 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  detailText: { color: Pastel.textMuted, fontSize: 13, fontFamily: Font.regular, includeFontPadding: false },

  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  btnConfirm: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: Pastel.teal },
  btnConfirmText: { color: "#FFFFFF", fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
  btnCancel: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FFF5F5" },
  btnCancelText: { color: "#EF4444", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
});
