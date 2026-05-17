import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../services/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type NotifPrefs = {
  push_events: boolean;
  push_reservations: boolean;
  push_reminders: boolean;
  notify_mentions: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  push_events: true,
  push_reservations: true,
  push_reminders: true,
  notify_mentions: true,
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("push_events, push_reservations, push_reminders, notify_mentions")
      .eq("user_id", userId)
      .single();
    if (data) {
      setPrefs({
        push_events: data.push_events ?? true,
        push_reservations: data.push_reservations ?? true,
        push_reminders: data.push_reminders ?? true,
        notify_mentions: data.notify_mentions ?? true,
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (key: keyof NotifPrefs) => {
    if (!userId) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    await supabase.from("profiles").update({ [key]: next[key] }).eq("user_id", userId);
    setSaving(false);
  }, [prefs, userId]);

  const rows: { key: keyof NotifPrefs; icon: string; label: string; description: string }[] = [
    {
      key: "push_events",
      icon: "calendar-outline",
      label: "Événements",
      description: "Nouveaux événements près de toi et dans tes lieux favoris",
    },
    {
      key: "push_reservations",
      icon: "receipt-outline",
      label: "Réservations",
      description: "Confirmations et mises à jour de tes réservations",
    },
    {
      key: "push_reminders",
      icon: "alarm-outline",
      label: "Rappels",
      description: "Rappels avant tes événements et réservations à venir",
    },
    {
      key: "notify_mentions",
      icon: "at-outline",
      label: "Mentions",
      description: "Quand quelqu'un te mentionne dans un commentaire ou post",
    },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {saving ? <ActivityIndicator size="small" color={Pastel.primary} /> : <View style={{ width: 20 }} />}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>Préférences de notifications push</Text>
          <View style={styles.card}>
            {rows.map((row, i) => (
              <View key={row.key}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: Pastel.surfaceAlt }]}>
                    <Ionicons name={row.icon as any} size={18} color={Pastel.primary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowDesc}>{row.description}</Text>
                  </View>
                  <Switch
                    value={prefs[row.key]}
                    onValueChange={() => toggle(row.key)}
                    trackColor={{ false: Pastel.border, true: Pastel.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.hint}>
            Les notifications de messages et de suivi sont toujours activées pour ne rien manquer.
          </Text>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  title: { fontSize: 17, fontFamily: Font.bold, color: Pastel.text },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 16 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: Font.semiBold,
    color: Pastel.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Pastel.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Pastel.border,
    overflow: "hidden",
  },
  divider: { height: 1, backgroundColor: Pastel.border, marginLeft: 60 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontFamily: Font.semiBold, color: Pastel.text },
  rowDesc: { fontSize: 12, fontFamily: Font.regular, color: Pastel.textMuted, lineHeight: 16 },
  hint: {
    fontSize: 12,
    fontFamily: Font.regular,
    color: Pastel.textMuted,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 16,
  },
});
