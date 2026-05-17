import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import { useAuth } from "@/providers/AuthProvider";
import {
  getGroupNotificationDefaults,
  listGroupNotificationSettings,
  listMyGroups,
  setGroupNotificationDefaults,
  setGroupNotificationSetting,
} from "@/services/groups";

type GroupRow = {
  group_id: number;
  name: string;
  role: string;
};

const LEVELS: { key: "all" | "important" | "none"; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "important", label: "Important" },
  { key: "none", label: "Aucune" },
];

export default function GroupNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [defaultLevel, setDefaultLevel] = useState<"all" | "important" | "none">("all");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [settings, setSettings] = useState<Record<number, "all" | "important" | "none">>({});
  const [mentions, setMentions] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [defaults, myGroups, groupSettings] = await Promise.all([
          getGroupNotificationDefaults(userId),
          listMyGroups(userId),
          listGroupNotificationSettings(userId),
        ]);
        if (cancelled) return;
        setEnabled(defaults?.enabled ?? true);
        setDefaultLevel(defaults?.default_level ?? "all");
        setGroups(myGroups);
        const map: Record<number, "all" | "important" | "none"> = {};
        const mentionsMap: Record<number, boolean> = {};
        groupSettings.forEach((row: { group_id: number; level: "all" | "important" | "none"; notify_mentions?: boolean | null }) => {
          map[row.group_id] = row.level;
          mentionsMap[row.group_id] = row.notify_mentions ?? true;
        });
        setSettings(map);
        setMentions(mentionsMap);
      } catch {
        if (!cancelled) {
          setGroups([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleToggleEnabled = async (value: boolean) => {
    if (!userId) return;
    setEnabled(value);
    try {
      await setGroupNotificationDefaults({ userId, enabled: value, defaultLevel });
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    }
  };

  const handleDefaultLevel = async (level: "all" | "important" | "none") => {
    if (!userId) return;
    setDefaultLevel(level);
    try {
      await setGroupNotificationDefaults({ userId, enabled, defaultLevel: level });
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    }
  };

  const handleGroupLevel = async (groupId: number, level: "all" | "important" | "none") => {
    if (!userId) return;
    setSettings((prev) => ({ ...prev, [groupId]: level }));
    try {
      await setGroupNotificationSetting({
        userId,
        groupId,
        level,
        notifyMentions: mentions[groupId] ?? true,
      });
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    }
  };

  const handleMentionsToggle = async (groupId: number, value: boolean) => {
    if (!userId) return;
    setMentions((prev) => ({ ...prev, [groupId]: value }));
    try {
      await setGroupNotificationSetting({
        userId,
        groupId,
        level: settings[groupId] ?? defaultLevel,
        notifyMentions: value,
      });
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    }
  };

  const groupRows = useMemo(() => groups, [groups]);

  return (
    <View style={styles.screen}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Text style={styles.title}>Notifications groupes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Paramètres globaux */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={{ gap: 2 }}>
              <Text style={styles.sectionTitle}>Activer les notifications</Text>
              <Text style={styles.hint}>Niveau par défaut pour tous les groupes</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: Pastel.border, true: Pastel.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.levelRow}>
            {LEVELS.map((item) => {
              const active = item.key === defaultLevel;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handleDefaultLevel(item.key)}
                  style={[styles.levelChip, active ? styles.levelChipActive : null]}
                >
                  <Text style={[styles.levelText, active ? styles.levelTextActive : null]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Par groupe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Par groupe</Text>
          {loading ? (
            <Text style={styles.hint}>Chargement...</Text>
          ) : groupRows.length === 0 ? (
            <View style={styles.emptyGroup}>
              <Ionicons name="people-outline" size={32} color={Pastel.border} />
              <Text style={styles.hint}>Aucun groupe rejoint pour l'instant.</Text>
            </View>
          ) : (
            <View style={styles.groupList}>
              {groupRows.map((group) => {
                const level = settings[group.group_id] ?? defaultLevel;
                const notifyMentions = mentions[group.group_id] ?? true;
                return (
                  <View key={group.group_id} style={styles.groupCard}>
                    <View style={styles.groupCardHeader}>
                      <View style={styles.groupAvatar}>
                        <Text style={styles.groupAvatarText}>
                          {group.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.groupName}>{group.name}</Text>
                    </View>
                    <View style={styles.mentionsRow}>
                      <Text style={styles.hint}>Notifications mentions</Text>
                      <Switch
                        value={notifyMentions}
                        onValueChange={(value) => handleMentionsToggle(group.group_id, value)}
                        trackColor={{ false: Pastel.border, true: Pastel.primary }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <View style={styles.levelRow}>
                      {LEVELS.map((item) => {
                        const active = item.key === level;
                        return (
                          <Pressable
                            key={`${group.group_id}-${item.key}`}
                            onPress={() => handleGroupLevel(group.group_id, item.key)}
                            style={[styles.levelChip, active ? styles.levelChipActive : null]}
                          >
                            <Text style={[styles.levelText, active ? styles.levelTextActive : null]}>
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  title: { fontSize: 18, fontFamily: Font.bold, color: Pastel.text },
  container: { padding: 16, paddingBottom: 80, gap: 12 },
  section: {
    backgroundColor: Pastel.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Pastel.border,
    gap: 12,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text },
  hint: { fontSize: 12, color: Pastel.textMuted },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
  },
  levelChipActive: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  levelText: { fontSize: 13, color: Pastel.textMuted, fontFamily: Font.semiBold },
  levelTextActive: { color: "#FFFFFF", fontFamily: Font.bold },
  emptyGroup: { alignItems: "center", gap: 8, paddingVertical: 16 },
  groupList: { gap: 10 },
  groupCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
    gap: 10,
  },
  groupCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 12 },
  groupName: { fontSize: 14, color: Pastel.text, fontFamily: Font.bold, flex: 1 },
  mentionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
