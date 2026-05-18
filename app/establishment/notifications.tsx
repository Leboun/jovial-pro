import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";
import { supabase } from "@/services/supabase";

type NotifRow = {
  id: number;
  created_at: string;
  starts_at: string;
  ends_at: string | null;
  contact_firstname: string | null;
  contact_lastname: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  group_size: number | null;
  price_cents: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  games?: { name?: string | null } | null;
};

const isNew = (createdAt: string) =>
  Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" }) +
    " à " +
    d.getHours().toString().padStart(2, "0") + "h" +
    d.getMinutes().toString().padStart(2, "0");
};

const formatPrice = (cents: number | null, currency: string | null) => {
  if (!cents) return "Gratuit";
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: currency ?? "EUR" });
};

export default function EstablishmentNotificationsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
          if (!gate.ok || !gate.venueId) { if (!cancelled) setNotifications([]); return; }

          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data, error } = await supabase
            .from("reservations")
            .select("id, created_at, starts_at, ends_at, contact_firstname, contact_lastname, contact_phone, contact_email, group_size, price_cents, currency, status, payment_status, games(name)")
            .eq("venue_id", gate.venueId)
            .gte("created_at", thirtyDaysAgo.toISOString())
            .order("created_at", { ascending: false });

          if (error) throw error;
          if (!cancelled) setNotifications((data ?? []) as NotifRow[]);
        } catch {
          if (!cancelled) setNotifications([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [userId])
  );

  const newCount = notifications.filter((n) => isNew(n.created_at)).length;

  return (
    <JovialProShell
      title="Notifications"
      subtitle={newCount > 0 ? `${newCount} nouvelle${newCount > 1 ? "s" : ""} depuis 24h` : "Dernières 30 jours"}
      currentPath={pathname}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2B4E93" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color="#E5E7EB" />
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptyText}>Les nouvelles réservations apparaîtront ici.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {notifications.map((notif) => {
            const fresh = isNew(notif.created_at);
            const name = [notif.contact_firstname, notif.contact_lastname].filter(Boolean).join(" ") || "Client";
            const activity = (notif.games as { name?: string | null } | null)?.name ?? "Activité";
            const cancelledStatus = notif.status === "cancelled";
            return (
              <View key={notif.id} style={[styles.card, fresh ? styles.cardNew : null, cancelledStatus ? styles.cardCancelled : null]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, fresh ? styles.iconWrapNew : cancelledStatus ? styles.iconWrapCancelled : styles.iconWrapDefault]}>
                    <Ionicons
                      name={cancelledStatus ? "close-circle" : "bookmark"}
                      size={18}
                      color={cancelledStatus ? "#DC2626" : fresh ? "#059669" : "#6B7280"}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {cancelledStatus ? "Annulation — " : ""}{name}
                      </Text>
                      {fresh && !cancelledStatus ? (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>Nouveau</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardActivity}>{activity}</Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={13} color="#6B7280" />
                    <Text style={styles.detailText} numberOfLines={1}>{formatDate(notif.starts_at)}</Text>
                  </View>
                  {notif.contact_phone ? (
                    <Pressable
                      style={styles.detailRow}
                      onPress={() => {
                        const { Linking } = require("react-native");
                        Linking.openURL(`tel:${notif.contact_phone}`).catch(() => undefined);
                      }}
                    >
                      <Ionicons name="call-outline" size={13} color="#6366F1" />
                      <Text style={[styles.detailText, styles.detailLink]}>{notif.contact_phone}</Text>
                    </Pressable>
                  ) : null}
                  {notif.group_size ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="people-outline" size={13} color="#6B7280" />
                      <Text style={styles.detailText}>{notif.group_size} personne{notif.group_size > 1 ? "s" : ""}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailRow}>
                    <Ionicons name="card-outline" size={13} color="#6B7280" />
                    <Text style={styles.detailText}>
                      {formatPrice(notif.price_cents, notif.currency)}
                      {notif.payment_status === "paid" ? "  ✓ Payé" : notif.payment_status === "unpaid" ? "  · En attente" : ""}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDate}>
                  Reçu {new Date(notif.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} à {new Date(notif.created_at).getHours().toString().padStart(2, "0")}h{new Date(notif.created_at).getMinutes().toString().padStart(2, "0")}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },

  list: { padding: 16, gap: 12, paddingBottom: 60 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    gap: 10,
  },
  cardNew: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
  },
  cardCancelled: {
    borderColor: "#FECACA",
    backgroundColor: "#FFF5F5",
    opacity: 0.8,
  },

  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconWrapNew: { backgroundColor: "#D1FAE5" },
  iconWrapDefault: { backgroundColor: "#F3F4F6" },
  iconWrapCancelled: { backgroundColor: "#FEE2E2" },

  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#111827", flex: 1 },
  cardActivity: { fontSize: 12, color: "#6B7280", fontWeight: "600" },

  newBadge: { backgroundColor: "#059669", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  newBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },

  cardDetails: { gap: 6, paddingLeft: 46 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12, color: "#374151" },
  detailLink: { color: "#6366F1", fontWeight: "600" },

  cardDate: { fontSize: 11, color: "#9CA3AF", paddingLeft: 46 },
});
