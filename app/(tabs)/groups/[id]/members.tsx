import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import {
  createGroupAuditLog,
  listGroupMembers,
  listProfilesByUserIds,
  updateGroupMemberRole,
  updateGroupMemberStatus,
} from "@/services/groups";

type MemberRow = {
  user_id: string;
  role: "member" | "admin" | "founder";
  status: "approved";
  name: string;
};

const AVATAR_COLORS = ["#DBEAFE", "#FCE7F3", "#D1FAE5", "#FEF3C7", "#EDE9FE", "#FFE4E6"];

function avatarColor(userId: string) {
  const n = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

const ROLE_LABELS: Record<string, string> = {
  founder: "Fondateur",
  admin: "Admin",
  member: "Membre",
};

export default function GroupMembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = Number(id ?? 0);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<"member" | "admin" | "founder" | null>(null);
  const [savingRole, setSavingRole] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await listGroupMembers(groupId, "approved");
        const ids = rows.map((row) => row.user_id);
        const profiles = ids.length > 0 ? await listProfilesByUserIds(ids) : [];
        if (cancelled) return;
        const map = new Map(profiles.map((p) => [p.user_id, p]));
        const list = rows.map((row) => {
          const profile = map.get(row.user_id);
          const name =
            profile?.firstname?.trim() ||
            profile?.lastname?.trim() ||
            profile?.handle?.trim() ||
            "Membre";
          return { user_id: row.user_id, role: row.role, status: "approved", name } as MemberRow;
        });
        setMembers(list);
        if (userId) {
          const me = rows.find((row) => row.user_id === userId);
          setMyRole((me?.role as any) ?? null);
        }
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [groupId, userId]);

  const canManage = myRole === "admin" || myRole === "founder";

  const handleRoleChange = async (target: MemberRow, nextRole: "member" | "admin") => {
    if (!groupId || !canManage) return;
    if (target.role === "founder") {
      Alert.alert("Action impossible", "Le fondateur ne peut pas etre modifie.");
      return;
    }
    setSavingRole((prev) => ({ ...prev, [target.user_id]: true }));
    try {
      await updateGroupMemberRole({ groupId, userId: target.user_id, role: nextRole });
      if (userId) {
        await createGroupAuditLog({ groupId, actorId: userId, targetUserId: target.user_id, action: "role_change", details: { role: nextRole } });
      }
      setMembers((prev) => prev.map((m) => m.user_id === target.user_id ? { ...m, role: nextRole } : m));
    } catch {
      Alert.alert("Erreur", "Impossible de modifier le role.");
    } finally {
      setSavingRole((prev) => ({ ...prev, [target.user_id]: false }));
    }
  };

  const handleBanMember = async (target: MemberRow) => {
    if (!groupId || !canManage) return;
    if (target.role === "founder") {
      Alert.alert("Action impossible", "Le fondateur ne peut pas etre banni.");
      return;
    }
    Alert.alert("Confirmer", `Bannir ${target.name} du groupe ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Bannir",
        style: "destructive",
        onPress: async () => {
          setSavingRole((prev) => ({ ...prev, [target.user_id]: true }));
          try {
            await updateGroupMemberStatus({ groupId, userId: target.user_id, status: "banned" });
            if (userId) {
              await createGroupAuditLog({ groupId, actorId: userId, targetUserId: target.user_id, action: "ban" });
            }
            setMembers((prev) => prev.filter((m) => m.user_id !== target.user_id));
          } catch {
            Alert.alert("Erreur", "Impossible de bannir l'utilisateur.");
          } finally {
            setSavingRole((prev) => ({ ...prev, [target.user_id]: false }));
          }
        },
      },
    ]);
  };

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => {
      const rank = (role: string) => (role === "founder" ? 0 : role === "admin" ? 1 : 2);
      return rank(a.role) - rank(b.role);
    }),
    [members]
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Membres</Text>
          {!loading && (
            <Text style={styles.headerSub}>{sortedMembers.length} membre{sortedMembers.length > 1 ? "s" : ""}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.hint}>Chargement...</Text>
        ) : sortedMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color="#D1D5DB" />
            <Text style={styles.hint}>Aucun membre.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {sortedMembers.map((member) => (
              <View key={member.user_id} style={styles.card}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(member.user_id) }]}>
                  <Text style={styles.avatarText}>{member.name.trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{member.name}</Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>{ROLE_LABELS[member.role] ?? "Membre"}</Text>
                  </View>
                </View>
                {canManage && member.user_id !== userId ? (
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionChip}
                      onPress={() => handleRoleChange(member, "member")}
                      disabled={savingRole[member.user_id]}
                    >
                      <Text style={styles.actionText}>Membre</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionChip}
                      onPress={() => handleRoleChange(member, "admin")}
                      disabled={savingRole[member.user_id]}
                    >
                      <Text style={styles.actionText}>Admin</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionChipDanger}
                      onPress={() => handleBanMember(member)}
                      disabled={savingRole[member.user_id]}
                    >
                      <Text style={styles.actionTextDanger}>Bannir</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  headerSub: { fontSize: 12, color: Pastel.textMuted, marginTop: 1, includeFontPadding: false },
  container: { padding: 16, paddingBottom: 60, gap: 10 },
  emptyState: { alignItems: "center", gap: 10, paddingTop: 60 },
  hint: { fontSize: 13, color: Pastel.textMuted, textAlign: "center", includeFontPadding: false },
  list: { gap: 10 },
  card: {
    backgroundColor: Pastel.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Pastel.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  cardBody: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rolePillText: { fontSize: 11, fontFamily: Font.semiBold, color: Pastel.textMuted, includeFontPadding: false },
  actions: { flexDirection: "row", gap: 8, width: "100%", paddingTop: 4 },
  actionChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: Pastel.border, backgroundColor: Pastel.surfaceAlt,
  },
  actionText: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  actionChipDanger: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    borderColor: "#FCA5A5", backgroundColor: "#FEE2E2",
  },
  actionTextDanger: { fontSize: 12, color: "#7F1D1D", fontFamily: Font.bold, includeFontPadding: false },
});
