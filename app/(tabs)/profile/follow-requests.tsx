import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../services/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type Request = {
  follower_id: string;
  firstname: string | null;
  handle: string | null;
  avatar_url: string | null;
};

const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];
function avatarColor(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function FollowRequestsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? null;

  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_follows")
      .select("follower_id, profiles:follower_id(firstname, handle, avatar_url)")
      .eq("following_id", userId)
      .eq("status", "pending");

    const mapped = (data ?? []).map((row: any) => ({
      follower_id: row.follower_id,
      firstname: row.profiles?.firstname ?? null,
      handle: row.profiles?.handle ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
    }));
    setRequests(mapped);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const accept = async (followerId: string) => {
    await supabase.from("user_follows")
      .update({ status: "accepted" })
      .eq("follower_id", followerId)
      .eq("following_id", userId!);
    load();
  };

  const decline = async (followerId: string) => {
    await supabase.from("user_follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", userId!);
    load();
  };

  const displayName = (r: Request) => {
    if (r.firstname) return r.firstname;
    if (r.handle) return `@${r.handle}`;
    return "Membre";
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Text style={styles.title}>Demandes de suivi</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Pastel.primary} /></View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="person-add-outline" size={48} color={Pastel.border} />
          <Text style={styles.emptyTitle}>Aucune demande</Text>
          <Text style={styles.emptyText}>Tu n'as pas de demande de suivi en attente.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {requests.map((r) => (
            <View key={r.follower_id} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: avatarColor(r.follower_id) }]}>
                <Text style={styles.avatarText}>{displayName(r).slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{displayName(r)}</Text>
                {r.handle ? <Text style={styles.handle}>@{r.handle}</Text> : null}
              </View>
              <Pressable style={styles.btnAccept} onPress={() => accept(r.follower_id)}>
                <Text style={styles.btnAcceptText}>Accepter</Text>
              </Pressable>
              <Pressable style={styles.btnDecline} onPress={() => decline(r.follower_id)}>
                <Ionicons name="close" size={16} color={Pastel.textMuted} />
              </Pressable>
            </View>
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
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  title: { fontSize: 17, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },
  list: { paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 15, includeFontPadding: false },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  handle: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  btnAccept: {
    backgroundColor: Pastel.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  btnAcceptText: { color: "#FFFFFF", fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  btnDecline: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
});
