import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  getGroupCommentById,
  getGroupPostById,
  getGroupReportById,
  listProfilesByUserIds,
  updateGroupReportStatus,
} from "@/services/groups";

type ReportDetail = {
  id: number;
  group_id: number;
  reporter_id: string | null;
  target_user_id: string | null;
  post_id: number | null;
  comment_id: number | null;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
};

export default function ReportDetailScreen() {
  const router = useRouter();
  const { id, reportId } = useLocalSearchParams<{ id?: string; reportId?: string }>();
  const groupId = Number(id ?? 0);
  const reportIdNum = Number(reportId ?? 0);

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [post, setPost] = useState<{ id: number; body: string | null; created_at: string } | null>(
    null
  );
  const [comment, setComment] = useState<{ id: number; body: string; created_at: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!groupId || !reportIdNum) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const detail = await getGroupReportById(reportIdNum);
        if (!detail || cancelled) {
          setReport(null);
          return;
        }
        setReport(detail);
        const profileIds = [detail.reporter_id, detail.target_user_id].filter(
          Boolean
        ) as string[];
        if (profileIds.length > 0) {
          const profs = await listProfilesByUserIds(profileIds);
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
        if (detail.post_id) {
          const postRow = await getGroupPostById(detail.post_id);
          if (!cancelled) {
            setPost(postRow ? { id: postRow.id, body: postRow.body, created_at: postRow.created_at } : null);
          }
        }
        if (detail.comment_id) {
          const commentRow = await getGroupCommentById(detail.comment_id);
          if (!cancelled) {
            setComment(
              commentRow
                ? { id: commentRow.id, body: commentRow.body, created_at: commentRow.created_at }
                : null
            );
          }
        }
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, reportIdNum]);

  const handleUpdateStatus = async (status: "reviewing" | "resolved" | "dismissed") => {
    if (!report) return;
    setUpdating(true);
    try {
      await updateGroupReportStatus({ reportId: report.id, status });
      setReport((prev) => (prev ? { ...prev, status } : prev));
    } catch {
      Alert.alert("Erreur", "Impossible de mettre � jour le signalement.");
    } finally {
      setUpdating(false);
    }
  };

  const reporterLabel = report?.reporter_id
    ? profiles[report.reporter_id] ?? report.reporter_id
    : "?";
  const targetLabel = report?.target_user_id
    ? profiles[report.target_user_id] ?? report.target_user_id
    : "N/A";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.title}>Signalement détaillé</Text>
        {loading ? (
          <Text style={styles.hint}>Chargement...</Text>
        ) : !report ? (
          <Text style={styles.hint}>Signalement introuvable.</Text>
        ) : (
          <View style={styles.content}>
            <Text style={styles.meta}>
              {new Date(report.created_at).toLocaleString("fr-FR")}
            </Text>
            <Text style={styles.label}>Signalé par: {reporterLabel}</Text>
            <Text style={styles.label}>Cible: {targetLabel}</Text>
            <Text style={styles.label}>Raison: {report.reason}</Text>
            <Text style={styles.label}>Statut: {report.status}</Text>

            {post ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Post signalé</Text>
                <Text style={styles.sectionBody}>{post.body ?? "(Sans texte)"}</Text>
                <Text style={styles.meta}>
                  {new Date(post.created_at).toLocaleString("fr-FR")}
                </Text>
              </View>
            ) : null}

            {comment ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Commentaire signalé</Text>
                <Text style={styles.sectionBody}>{comment.body}</Text>
                <Text style={styles.meta}>
                  {new Date(comment.created_at).toLocaleString("fr-FR")}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={styles.actionLink}
                onPress={() => handleUpdateStatus("reviewing")}
                disabled={updating}
              >
                <Text style={styles.actionText}>En cours</Text>
              </Pressable>
              <Pressable
                style={styles.actionLink}
                onPress={() => handleUpdateStatus("resolved")}
                disabled={updating}
              >
                <Text style={styles.actionText}>Résolu</Text>
              </Pressable>
              <Pressable
                style={styles.actionLink}
                onPress={() => handleUpdateStatus("dismissed")}
                disabled={updating}
              >
                <Text style={styles.actionText}>Refusé</Text>
              </Pressable>
            </View>
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
  content: { gap: 8 },
  meta: { fontSize: 11, color: "#9CA3AF" },
  label: { fontSize: 12, color: "#111827" },
  section: { marginTop: 6, gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#111827" },
  sectionBody: { fontSize: 12, color: "#111827" },
  actions: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 6 },
  actionLink: { paddingVertical: 4 },
  actionText: { fontSize: 12, color: "#111827", fontWeight: "700" },
});

