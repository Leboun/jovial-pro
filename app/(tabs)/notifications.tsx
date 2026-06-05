import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ExpoNotifications from "expo-notifications";

import { supabase } from "../../services/supabase";
import { useAuth } from "../../providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type AppNotification = {
  id: number;
  type: "message" | "group_post" | "group_comment" | "event" | string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return `${Math.floor(diff / 604800)} sem`;
}

function notifIcon(type: string): { name: string; color: string; bg: string } {
  switch (type) {
    case "message":
      return { name: "chatbubbles-outline", color: "#2B4E93", bg: "#D6E0F5" };
    case "group_post":
      return { name: "people-outline", color: "#2B4E93", bg: "#D6E0F5" };
    case "group_comment":
      return { name: "chatbubble-outline", color: "#2B4E93", bg: "#D6E0F5" };
    case "event":
      return { name: "calendar-outline", color: "#2F7D73", bg: "#D8F0EE" };
    default:
      return { name: "notifications-outline", color: Pastel.textMuted, bg: Pastel.surfaceAlt };
  }
}

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function NotificationsScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const notifListener = useRef<any>(null);

  const registerPushToken = useCallback(async () => {
    if (!userId) return;
    try {
      const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await ExpoNotifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;
      const tokenData = await ExpoNotifications.getExpoPushTokenAsync();
      await supabase
        .from("profiles")
        .update({ expo_push_token: tokenData.data })
        .eq("user_id", userId);
    } catch {}
  }, [userId]);

  const loadNotifications = useCallback(async () => {
    if (!userId) { setNotifications([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, data, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as AppNotification[] | null) ?? []);
    setLoading(false);
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  const markOneRead = useCallback(async (id: number) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  useEffect(() => { registerPushToken(); }, [registerPushToken]);

  useFocusEffect(useCallback(() => { loadNotifications(); }, [loadNotifications]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  useEffect(() => {
    notifListener.current = ExpoNotifications.addNotificationReceivedListener(() => {
      loadNotifications();
    });
    return () => {
      if (notifListener.current) ExpoNotifications.removeNotificationSubscription(notifListener.current);
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={styles.markAll}>Tout lire</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="notifications-outline" size={48} color={Pastel.border} />
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptyText}>
            Tu seras notifié des nouveaux messages, publications et événements.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Pastel.primary} />}
        >
          {notifications.map((notif) => {
            const icon = notifIcon(notif.type);
            return (
              <Pressable
                key={notif.id}
                style={[styles.card, !notif.read && styles.cardUnread]}
                onPress={() => markOneRead(notif.id)}
              >
                {!notif.read && <View style={styles.unreadDot} />}
                <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{notif.title}</Text>
                  {notif.body ? (
                    <Text style={styles.cardText} numberOfLines={2}>{notif.body}</Text>
                  ) : null}
                  <Text style={styles.cardTime}>{timeAgo(notif.created_at)}</Text>
                </View>
              </Pressable>
            );
          })}
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
    paddingBottom: 14,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontFamily: Font.display, color: Pastel.text, letterSpacing: 0.5, includeFontPadding: false },
  badge: {
    backgroundColor: Pastel.primary,
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  markAll: { fontSize: 13, fontFamily: Font.semiBold, color: Pastel.textMuted, includeFontPadding: false },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },

  list: { backgroundColor: Pastel.surface, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
    position: "relative",
  },
  cardUnread: { backgroundColor: Pastel.primarySoft },
  unreadDot: {
    position: "absolute",
    left: 6,
    top: 20,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Pastel.primary,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  cardText: { fontSize: 13, color: Pastel.textMuted, lineHeight: 18, fontFamily: Font.regular, includeFontPadding: false },
  cardTime: { fontSize: 11, color: Pastel.textMuted, marginTop: 2, fontFamily: Font.regular, includeFontPadding: false },
});
