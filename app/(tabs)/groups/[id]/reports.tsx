import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { listGroupReports, listProfilesByUserIds, updateGroupReportStatus } from "@/services/groups";

type ReportRow = {
  id: number;
  group_id: number;
  reporter_id: string | null;
  target_user_id: string | null;
  post_id: number | null;
  comment_id: number | null;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
};

export default function GroupReportsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = Number(id ?? 0);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await listGroupReports(groupId);
        if (cancelled) return;
        setReports(rows);
        const ids = Array.from(
          new Set(
            rows
              .flatMap((row) => [row.reporter_id, row.target_user_id])
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
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const handleUpdateStatus = async (
    reportId: number,
    status: "reviewing" | "resolved" | "dismissed"
  ) => {
    setUpdating((prev) => ({ ...prev, [reportId]: true }));
    try {
      await updateGroupReportStatus({ reportId, status });
      setReports((prev) =>
        prev.map((row) => (row.id === reportId ? { ...row, status } : row))
      );
    } catch {
      Alert.alert("Erreur", "Impossible de mettre � jour le signalement.");
    } finally {
      setUpdating((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const rows = useMemo(() => reports, [reports]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.title}>Signalements</Text>
        {loading ? (
          <Text style={styles.hint}>Chargement...</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.hint}>Aucun signalement.</Text>
        ) : (
          <View style={styles.list}>
            {rows.map((report) => (
              <Pressable
                key={report.id}
                style={styles.item}
                onPress={() => router.push(`/groups/${groupId}/reports/${report.id}`)}
              >
                <Text style={styles.meta}>
                  {new Date(report.created_at).toLocaleString("fr-FR")}
                </Text>
                <Text style={styles.label}>
                  Signalé par:{" "}
                  {report.reporter_id ? profiles[report.reporter_id] ?? report.reporter_id : "?"}
                </Text>
                <Text style={styles.label}>
                  Cible:{" "}
                  {report.target_user_id
                    ? profiles[report.target_user_id] ?? report.target_user_id
                    : "N/A"}
                </Text>
                <Text style={styles.label}>Raison: {report.reason}</Text>
                <Text style={styles.label}>Statut: {report.status}</Text>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionLink}
                    onPress={() => handleUpdateStatus(report.id, "reviewing")}
                    disabled={updating[report.id]}
                  >
                    <Text style={styles.actionText}>En cours</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionLink}
                    onPress={() => handleUpdateStatus(report.id, "resolved")}
                    disabled={updating[report.id]}
                  >
                    <Text style={styles.actionText}>Résolu</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionLink}
                    onPress={() => handleUpdateStatus(report.id, "dismissed")}
                    disabled={updating[report.id]}
                  >
                    <Text style={styles.actionText}>Refusé</Text>
                  </Pressable>
                </View>
              </Pressable>
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
  list: { gap: 16 },
  item: { gap: 6 },
  meta: { fontSize: 11, color: "#9CA3AF" },
  label: { fontSize: 12, color: "#111827" },
  actions: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 6 },
  actionLink: { paddingVertical: 4 },
  actionText: { fontSize: 12, color: "#111827", fontWeight: "700" },
});

