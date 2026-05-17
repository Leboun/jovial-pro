import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { listGroupAuditLogs, listProfilesByUserIds } from "@/services/groups";

type AuditRow = {
  id: number;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export default function GroupAuditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = Number(id ?? 0);

  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await listGroupAuditLogs(groupId);
        if (cancelled) return;
        setLogs(rows);
        const ids = Array.from(
          new Set(
            rows
              .flatMap((row) => [row.actor_id, row.target_user_id])
              .filter(Boolean) as string[]
          )
        );
        if (ids.length > 0) {
          const profs = await listProfilesByUserIds(ids);
          if (!cancelled) {
            const map: Record<string, string> = {};
            profs.forEach((p) => {
              const name =
                p.firstname?.trim() ||
                p.lastname?.trim() ||
                p.handle?.trim() ||
                "Utilisateur";
              map[p.user_id] = name;
            });
            setProfiles(map);
          }
        }
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const rows = useMemo(() => logs, [logs]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.title}>Journal de moderation</Text>
        {loading ? (
          <Text style={styles.hint}>Chargement...</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.hint}>Aucun événement.</Text>
        ) : (
          <View style={styles.list}>
            {rows.map((log) => (
              <View key={log.id} style={styles.card}>
                <Text style={styles.meta}>
                  {new Date(log.created_at).toLocaleString("fr-FR")}
                </Text>
                <Text style={styles.label}>
                  Action: {log.action}
                </Text>
                <Text style={styles.label}>
                  Acteur:{" "}
                  {log.actor_id ? profiles[log.actor_id] ?? log.actor_id : "?"}
                </Text>
                <Text style={styles.label}>
                  Cible:{" "}
                  {log.target_user_id
                    ? profiles[log.target_user_id] ?? log.target_user_id
                    : "N/A"}
                </Text>
                {log.details ? (
                  <Text style={styles.details}>
                    {JSON.stringify(log.details)}
                  </Text>
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
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { padding: 20, paddingBottom: 80, gap: 16 },
  backButton: { alignSelf: "flex-start" },
  backText: { color: "#9CA3AF", fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  hint: { fontSize: 12, color: "#9CA3AF" },
  list: { gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  meta: { fontSize: 11, color: "#9CA3AF" },
  label: { fontSize: 12, color: "#111827" },
  details: { fontSize: 11, color: "#9CA3AF" },
});
