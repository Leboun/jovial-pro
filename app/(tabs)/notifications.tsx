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
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ExpoNotifications from "expo-notifications";

import { supabase } from "../../services/supabase";
import { useAuth } from "../../providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import { emitNotificationsChanged } from "@/utils/notifEvents";

const JOVIAL_LOGO = require("../../assets/images/logo_jovial.png");

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
  const router = useRouter();
  const userId = session?.user?.id ?? null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [senderMap, setSenderMap] = useState<Record<string, { firstname: string | null; avatar_url: string | null }>>({});
  const [venueMap, setVenueMap] = useState<Record<string, { name: string | null; logo_url: string | null }>>({});
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
    const list = (data as AppNotification[] | null) ?? [];
    setNotifications(list);
    setLoading(false);

    // Personnalisation des icones : avatars des expediteurs (message) + logos des etablissements (event)
    const senderIds = Array.from(new Set(
      list.filter((n) => n.type === "message").map((n) => n.data?.sender_id).filter(Boolean)
    )) as string[];
    const venueIds = Array.from(new Set(
      list.filter((n) => n.type === "event").map((n) => n.data?.venue_id).filter((v) => v != null)
    ));
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, firstname, avatar_url")
        .in("user_id", senderIds);
      const m: Record<string, { firstname: string | null; avatar_url: string | null }> = {};
      (profs ?? []).forEach((p: any) => { m[p.user_id] = { firstname: p.firstname, avatar_url: p.avatar_url }; });
      setSenderMap(m);
    }
    if (venueIds.length) {
      const { data: vs } = await supabase
        .from("venues")
        .select("id, name, logo_url")
        .in("id", venueIds as any);
      const m: Record<string, { name: string | null; logo_url: string | null }> = {};
      (vs ?? []).forEach((v: any) => { m[String(v.id)] = { name: v.name, logo_url: v.logo_url }; });
      setVenueMap(m);
    }
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    emitNotificationsChanged(); // -> rafraichit le badge de la cloche
  }, [userId]);

  const markOneRead = useCallback(async (id: number) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    emitNotificationsChanged(); // -> rafraichit le badge de la cloche
  }, []);

  const handleNotifPress = useCallback((notif: AppNotification) => {
    markOneRead(notif.id);
    // Redirection selon le type de notification
    if (notif.type === "message") {
      const senderId = notif.data?.sender_id;
      if (senderId) {
        router.push({ pathname: "/profile/chat", params: { friend: String(senderId) } } as any);
      }
    }
  }, [markOneRead, router]);

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

  const renderNotifIcon = (notif: AppNotification) => {
    // Message -> photo de profil de l'expediteur
    if (notif.type === "message") {
      const senderId = notif.data?.sender_id as string | undefined;
      const prof = senderId ? senderMap[senderId] : undefined;
      if (prof?.avatar_url) {
        return <Image source={{ uri: prof.avatar_url }} style={styles.iconImg} contentFit="cover" transition={120} />;
      }
      if (prof?.firstname) {
        return (
          <View style={[styles.iconWrap, { backgroundColor: "#D6E0F5" }]}>
            <Text style={styles.iconInitials}>{prof.firstname.slice(0, 2).toUpperCase()}</Text>
          </View>
        );
      }
    }
    // Evenement -> logo de l'etablissement
    if (notif.type === "event") {
      const logo = (notif.data?.logo_url as string | undefined)
        ?? (notif.data?.venue_id != null ? venueMap[String(notif.data.venue_id)]?.logo_url : undefined);
      if (logo) {
        return <Image source={{ uri: logo }} style={styles.iconImg} contentFit="cover" transition={120} />;
      }
    }
    // Notification Jovial / systeme -> logo Jovial
    if (!["message", "event", "group_post", "group_comment"].includes(notif.type)) {
      return (
        <View style={styles.iconJovial}>
          <Image source={JOVIAL_LOGO} style={styles.iconJovialImg} contentFit="contain" />
        </View>
      );
    }
    // Repli : icone Ionicons selon le type
    const icon = notifIcon(notif.type);
    return (
      <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name as any} size={20} color={icon.color} />
      </View>
    );
  };

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
            return (
              <Pressable
                key={notif.id}
                style={[styles.card, !notif.read && styles.cardUnread]}
                onPress={() => handleNotifPress(notif)}
              >
                {!notif.read && <View style={styles.unreadDot} />}
                {renderNotifIcon(notif)}
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
  title: { fontSize: 28, fontFamily: Font.display, color: Pastel.primary, letterSpacing: 0.5, includeFontPadding: false },
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
  iconImg: { width: 42, height: 42, borderRadius: 12, backgroundColor: Pastel.surfaceAlt },
  iconInitials: { color: "#2B4E93", fontFamily: Font.extraBold, fontSize: 15, includeFontPadding: false },
  iconJovial: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  iconJovialImg: { width: 30, height: 30 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  cardText: { fontSize: 13, color: Pastel.textMuted, lineHeight: 18, fontFamily: Font.regular, includeFontPadding: false },
  cardTime: { fontSize: 11, color: Pastel.textMuted, marginTop: 2, fontFamily: Font.regular, includeFontPadding: false },
});
