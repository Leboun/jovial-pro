import { Redirect, Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useCallback, useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/providers/AuthProvider";
import { isDesktopWeb } from "@/utils/platform";
import { supabase } from "@/services/supabase";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const LAST_CHAT_READ_KEY = "last_chat_read_at";

function useUnreadCount(userId: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false)
      .then(({ count: c }) => setCount(c ?? 0));

    const channel = supabase
      .channel(`notif-badge-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("read", false)
          .then(({ count: c }) => setCount(c ?? 0));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return count;
}

function useUnreadMessages(userId: string | null) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) { setCount(0); return; }
    const lastRead = await AsyncStorage.getItem(LAST_CHAT_READ_KEY).catch(() => null);
    let query = supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId);
    if (lastRead) query = query.gt("created_at", lastRead);
    const { count: c } = await query;
    setCount(c ?? 0);
  }, [userId]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`chat-badge-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refresh]);

  return { count, refresh };
}

export default function TabsLayout() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const desktopWeb = isDesktopWeb(width);
  const unreadCount = useUnreadCount(session?.user?.id ?? null);
  const { count: unreadMessages, refresh: refreshMessages } = useUnreadMessages(session?.user?.id ?? null);
  const insets = useSafeAreaInsets();

  // Sur Android avec barre de navigation à l'écran, insets.bottom > 0
  // On ajoute cet espace au paddingBottom pour que les onglets ne soient pas cachés
  const tabBarPaddingBottom = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 4);
  const tabBarHeight = 56 + tabBarPaddingBottom;

  if (desktopWeb) {
    if (loading) return null;
    return <Redirect href={"/establishment/dashboard" as any} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Pastel.surface,
          borderTopColor: Pastel.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Pastel.primary,
        tabBarInactiveTintColor: Pastel.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: Font.semiBold,
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "Carte",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explorer",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="events"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="groups"
        options={{
          title: "Club",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: Pastel.primary, fontSize: 10, minWidth: 16, height: 16 },
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("profile", { screen: "index" });
          },
        })}
      />

      {/* Onglets template masqués */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="places" options={{ href: null }} />
    </Tabs>
  );
}
