import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
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

type ProfileLite = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  city: string | null;
};

function getDisplayName(p: ProfileLite) {
  const first = (p.firstname ?? "").trim();
  const last = (p.lastname ?? "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  if (p.handle) return `@${p.handle}`;
  return "Membre";
}

function getInitials(p: ProfileLite) {
  const name = getDisplayName(p);
  return name.replace("@", "").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];
function avatarColor(userId: string) {
  const n = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function FriendsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? null;

  const [friends, setFriends] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!userId) { setFriends([]); return; }
    setLoading(true);

    const { data: followingRows, error } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", userId);

    if (error || !followingRows?.length) { setFriends([]); setLoading(false); return; }

    const ids = followingRows.map((r: { following_id: string }) => r.following_id).filter(Boolean);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, handle, firstname, lastname, city")
      .in("user_id", ids);

    setFriends((profiles as ProfileLite[] | null) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Amis</Text>
          <Text style={styles.subtitle}>{friends.length} ami{friends.length !== 1 ? "s" : ""} suivi{friends.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="person-add-outline" size={48} color={Pastel.border} />
          <Text style={styles.emptyTitle}>Aucun ami</Text>
          <Text style={styles.emptyText}>Recherche des amis depuis ton profil et suis-les.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {friends.map((person) => (
            <Pressable key={person.user_id} style={styles.card} onPress={() => router.push(`/profile/${person.user_id}` as any)}>
              <View style={[styles.avatar, { backgroundColor: avatarColor(person.user_id) }]}>
                <Text style={styles.avatarText}>{getInitials(person)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{getDisplayName(person)}</Text>
                {person.handle ? (
                  <Text style={styles.cardMeta}>@{person.handle}</Text>
                ) : person.city ? (
                  <Text style={styles.cardMeta}>{person.city}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={Pastel.border} />
            </Pressable>
          ))}
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
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
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
  title: { fontSize: 17, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  subtitle: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },

  list: { backgroundColor: Pastel.surface, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 15, includeFontPadding: false },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  cardMeta: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
});
