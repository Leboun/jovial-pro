import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type Reservation = {
  id: number;
  starts_at: string;
  ends_at: string | null;
  status: string | null;
  payment_status: string | null;
  game_name: string | null;
  venue_name: string | null;
  venue_id: number | null;
};

export default function ReservationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        const now = new Date().toISOString();
        const { data } = await supabase
          .from("reservations")
          .select("id, starts_at, ends_at, status, payment_status, venue_id, games(name), venues(name)")
          .eq("user_id", userId)
          .gte("starts_at", now)
          .order("starts_at", { ascending: true });
        if (!cancelled) {
          setReservations(
            ((data as any[]) ?? []).map((row) => ({
              id: Number(row.id),
              starts_at: String(row.starts_at),
              ends_at: row.ends_at ? String(row.ends_at) : null,
              status: row.status ?? null,
              payment_status: row.payment_status ?? null,
              game_name: String(row?.games?.name ?? "").trim() || null,
              venue_name: String(row?.venues?.name ?? "").trim() || null,
              venue_id: row.venue_id ? Number(row.venue_id) : null,
            }))
          );
          setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [userId])
  );

  const handleCancel = (id: number, startsAt: string) => {
    const canCancel = new Date(startsAt).getTime() - Date.now() > 24 * 60 * 60 * 1000;
    if (!canCancel) {
      Alert.alert("Annulation impossible", "Tu ne peux plus annuler une réservation moins de 24h avant.");
      return;
    }
    Alert.alert(
      "Annuler la réservation ?",
      "Cette action ne peut pas être annulée.",
      [
        { text: "Retour", style: "cancel" },
        {
          text: "Annuler",
          style: "destructive",
          onPress: async () => {
            await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
            setReservations((prev) =>
              prev.map((r) => r.id === id ? { ...r, status: "cancelled" } : r)
            );
          },
        },
      ]
    );
  };

  const statusStyle = (status: string | null) => {
    if (status === "confirmed") return { bg: "#D1FAE5", text: "#065F46", label: "Confirmée" };
    if (status === "cancelled") return { bg: "#FEE2E2", text: "#991B1B", label: "Annulée" };
    return { bg: "#FEF3C7", text: "#92400E", label: "En attente" };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Mes réservations</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : reservations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Aucune réservation à venir</Text>
          <Text style={styles.emptyText}>Tes prochaines réservations apparaîtront ici.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {reservations.map((res) => {
            const st = statusStyle(res.status);
            const startsAt = new Date(res.starts_at);
            const dateLabel = startsAt.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
            const timeLabel = `${startsAt.getHours().toString().padStart(2, "0")}h${startsAt.getMinutes().toString().padStart(2, "0")}`;
            const canCancel = res.status !== "cancelled" && startsAt.getTime() - Date.now() > 24 * 60 * 60 * 1000;
            return (
              <View key={res.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.activityName}>{res.game_name ?? "Réservation"}</Text>
                    {res.venue_name ? (
                      <Pressable onPress={() => res.venue_id && router.push(`/venue/${res.venue_id}` as any)}>
                        <Text style={styles.venueName}>📍 {res.venue_name}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={styles.dateBlock}>
                  <Ionicons name="calendar-outline" size={14} color={Pastel.textMuted} />
                  <Text style={styles.dateText} numberOfLines={1}>{dateLabel}</Text>
                  <Text style={styles.timeText}>{timeLabel}</Text>
                </View>

                <View style={styles.paymentRow}>
                  <Ionicons
                    name={res.payment_status === "paid" ? "checkmark-circle" : "time-outline"}
                    size={14}
                    color={res.payment_status === "paid" ? "#059669" : "#92400E"}
                  />
                  <Text style={[styles.paymentText, { color: res.payment_status === "paid" ? "#059669" : "#92400E" }]}>
                    {res.payment_status === "paid" ? "Payé" : "Paiement en attente"}
                  </Text>
                </View>

                {canCancel ? (
                  <Pressable style={styles.cancelBtn} onPress={() => handleCancel(res.id, res.starts_at)}>
                    <Text style={styles.cancelBtnText}>Annuler cette réservation</Text>
                  </Pressable>
                ) : res.status !== "cancelled" ? (
                  <Text style={styles.noCancel}>Annulation impossible moins de 24h avant</Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Pastel.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 18, fontFamily: Font.extraBold, color: Pastel.text, textAlign: "center", includeFontPadding: false },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, includeFontPadding: false },
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 18,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardHeaderText: { flex: 1, gap: 3 },
  activityName: { fontSize: 17, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  venueName: { fontSize: 13, color: Pastel.textMuted, includeFontPadding: false },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  dateBlock: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 13, color: Pastel.text, fontFamily: Font.semiBold, flex: 1, textTransform: "capitalize", includeFontPadding: false },
  timeText: { fontSize: 15, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paymentText: { fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  cancelBtnText: { color: "#EF4444", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  noCancel: { fontSize: 12, color: Pastel.textMuted, textAlign: "center", includeFontPadding: false },
});
