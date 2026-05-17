import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import { patchGroupCache } from "@/services/groupCache";
import { getGroupsListCache, setGroupsListCache } from "@/services/groupsListCache";
import {
  getGroupById,
  getGroupMembership,
  listGroupTopics,
  listGroupTopicTags,
  deleteGroup,
  setGroupPrimaryTopicTag,
  updateGroup,
  uploadGroupImage,
} from "@/services/groups";

type TopicOption = { id: number; label: string; category: string };

export default function GroupSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const groupId = id ? Number(id) : null;
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingImage, setUpdatingImage] = useState<"cover" | "avatar" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [postPermission, setPostPermission] = useState<"members" | "admins">("members");
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editField, setEditField] = useState<"name" | "description" | null>(null);
  const [draftValue, setDraftValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!groupId) return;
      setLoading(true);
      try {
        const [group, allTopics, topicTags, membership] = await Promise.all([
          getGroupById(groupId),
          listGroupTopics(),
          listGroupTopicTags([groupId]),
          userId ? getGroupMembership(groupId, userId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setGroupName(group?.name ?? "");
        setGroupDescription(group?.description ?? "");
        setPostPermission(group?.post_permission ?? "members");
        setTopics(allTopics.map((item) => ({ id: item.id, label: item.label, category: item.category })));
        setIsAdmin(!!membership && membership.status === "approved" && ["admin", "founder"].includes(membership.role));
        const primary = topicTags.filter((row) => row.group_id === groupId).sort((a, b) => a.rank - b.rank)[0];
        setSelectedTopicId(primary?.topic_id ?? null);
      } catch {
        if (!cancelled) Alert.alert("Erreur", "Impossible de charger les paramètres du club.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [groupId, userId]);

  const selectedTopicLabel = useMemo(
    () => topics.find((t) => t.id === selectedTopicId)?.label ?? null,
    [topics, selectedTopicId]
  );

  const openEditModal = (field: "name" | "description") => {
    if (!groupId || !isAdmin) return;
    setEditField(field);
    setDraftValue(field === "name" ? groupName : groupDescription);
  };

  const confirmEditModal = async () => {
    if (!editField) return;
    const trimmed = draftValue.trim();
    if (!trimmed) { Alert.alert("Champ requis", "Merci de renseigner un texte."); return; }
    setEditField(null);
    if (!groupId || !isAdmin) return;
    const previous = editField === "name" ? groupName : groupDescription;
    if (editField === "name") setGroupName(trimmed);
    else setGroupDescription(trimmed);
    setSaving(true);
    try {
      const updated = await updateGroup(groupId, editField === "name" ? { name: trimmed } : { description: trimmed });
      const nextName = editField === "name" ? trimmed : groupName;
      const nextDescription = editField === "description" ? trimmed : groupDescription;
      if (updated) { setGroupName(updated.name ?? nextName); setGroupDescription(updated.description ?? nextDescription); }
      patchGroupCache(groupId, { name: nextName, description: nextDescription, serverUpdatedAt: updated?.updated_at ?? null });
    } catch {
      if (editField === "name") setGroupName(previous); else setGroupDescription(previous);
      Alert.alert("Erreur", "Impossible d'enregistrer la modification.");
    } finally {
      setSaving(false);
    }
  };

  const handlePickGroupImage = async (kind: "cover" | "avatar") => {
    if (!groupId || !isAdmin) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.status !== "limited") {
      if (!perm.canAskAgain) {
        Alert.alert(
          "Autorisation requise",
          "L'accès aux photos a été refusé. Autorise-le dans Réglages > Jovial > Photos.",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Ouvrir les Réglages", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert("Autorisation requise", "Autorise l'accès à tes photos pour continuer.");
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setUpdatingImage(kind);
    try {
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      let uri = asset.uri;
      if (uri.startsWith("ph://") && asset.assetId) {
        try {
          const media = await import("expo-media-library");
          const info = await media.getAssetInfoAsync(asset.assetId);
          if (info.localUri) uri = info.localUri;
        } catch {}
      }
      const publicUrl = await uploadGroupImage({ groupId, uri, kind, mimeType });
      if (publicUrl) {
        const patch = kind === "cover" ? { cover_image_url: publicUrl } : { avatar_image_url: publicUrl };
        const updated = await updateGroup(groupId, patch);
        patchGroupCache(groupId, { ...patch, serverUpdatedAt: updated?.updated_at ?? null });
      }
    } catch (err) {
      console.error("uploadGroupImage error", err);
      Alert.alert("Erreur", "Impossible de mettre à jour l'image.");
    } finally {
      setUpdatingImage(null);
    }
  };

  const handleSelectTopic = async (topicId: number) => {
    if (!groupId || !isAdmin) return;
    const previous = selectedTopicId;
    setSelectedTopicId(topicId);
    try {
      await setGroupPrimaryTopicTag(groupId, topicId);
    } catch {
      setSelectedTopicId(previous);
      Alert.alert("Erreur", "Impossible de mettre à jour la thématique.");
    }
  };

  const handleSaveSettings = async () => {
    if (!groupId || !isAdmin) return;
    setSaving(true);
    try {
      const updated = await updateGroup(groupId, {
        name: groupName.trim(),
        description: groupDescription.trim(),
        post_permission: postPermission,
      });
      const nextName = updated?.name ?? groupName.trim();
      const nextDescription = updated?.description ?? groupDescription.trim();
      if (updated) { setGroupName(nextName); setGroupDescription(nextDescription); }
      patchGroupCache(groupId, { name: nextName, description: nextDescription, post_permission: updated?.post_permission ?? postPermission, serverUpdatedAt: updated?.updated_at ?? null });
      if (selectedTopicId) await setGroupPrimaryTopicTag(groupId, selectedTopicId);
      Alert.alert("Succès", "Modifications enregistrées.");
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = () => {
    if (!groupId || !isAdmin) return;
    Alert.alert("Supprimer le club", "Cette action est définitive. Veux-tu vraiment supprimer ce club ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          try {
            await deleteGroup(groupId);
            const cached = getGroupsListCache();
            if (cached) {
              setGroupsListCache({
                groups: cached.groups.filter((g) => g.id !== groupId),
                myGroupIds: cached.myGroupIds.filter((i) => i !== groupId),
                fingerprint: `deleted:${groupId}:${Date.now()}`,
              });
            }
            try { await AsyncStorage.setItem("groups.activeSection", "mine"); } catch {}
            router.replace("/(tabs)/groups");
          } catch (err) {
            const message = typeof err === "object" && err && "message" in err ? String((err as any).message) : "Impossible de supprimer le club.";
            Alert.alert("Erreur", message);
          }
        },
      },
    ]);
  };

  if (!groupId) {
    return <View style={styles.screen}><Text style={styles.emptyText}>Club introuvable</Text></View>;
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Paramètres du club</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Pastel.primary} />
          </View>
        ) : !isAdmin ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accès restreint</Text>
            <Text style={styles.sectionHint}>Seuls les admins et fondateurs peuvent modifier ces paramètres.</Text>
          </View>
        ) : (
          <>
            {/* Photos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <View style={styles.row}>
                <Pressable style={styles.actionBtn} onPress={() => handlePickGroupImage("cover")} disabled={!!updatingImage}>
                  {updatingImage === "cover"
                    ? <ActivityIndicator size="small" color={Pastel.primary} />
                    : <Ionicons name="image-outline" size={16} color={Pastel.text} />}
                  <Text style={styles.actionBtnText}>{updatingImage === "cover" ? "Envoi..." : "Couverture"}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => handlePickGroupImage("avatar")} disabled={!!updatingImage}>
                  {updatingImage === "avatar"
                    ? <ActivityIndicator size="small" color={Pastel.primary} />
                    : <Ionicons name="person-circle-outline" size={16} color={Pastel.text} />}
                  <Text style={styles.actionBtnText}>{updatingImage === "avatar" ? "Envoi..." : "Photo du club"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Informations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nom du club</Text>
                  <Pressable style={styles.editBtn} onPress={() => openEditModal("name")}>
                    <Text style={styles.editBtnText}>Modifier</Text>
                  </Pressable>
                </View>
                <Text style={styles.infoValue}>{groupName || "—"}</Text>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <Pressable style={styles.editBtn} onPress={() => openEditModal("description")}>
                    <Text style={styles.editBtnText}>Modifier</Text>
                  </Pressable>
                </View>
                <Text style={styles.infoValue}>{groupDescription || "—"}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Publications */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Publications</Text>
              <Text style={styles.sectionHint}>Choisis qui peut publier dans le club.</Text>
              <View style={styles.chipRow}>
                {([
                  { value: "members" as const, label: "Tous les membres" },
                  { value: "admins" as const, label: "Admins uniquement" },
                ]).map((option) => {
                  const active = postPermission === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setPostPermission(option.value)}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Thématique */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thématique principale</Text>
              <Text style={styles.sectionHint}>Sélectionne la thématique principale du club.</Text>
              {selectedTopicLabel ? (
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>{selectedTopicLabel}</Text>
                </View>
              ) : null}
              <View style={styles.chipRow}>
                {topics.map((topic) => {
                  const active = topic.id === selectedTopicId;
                  return (
                    <Pressable
                      key={topic.id}
                      onPress={() => handleSelectTopic(topic.id)}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      disabled={saving}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{topic.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Modération */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Modération</Text>
              <View style={styles.row}>
                <Pressable style={styles.actionBtn} onPress={() => router.push(`/groups/${groupId}/reports`)}>
                  <Ionicons name="flag-outline" size={16} color={Pastel.text} />
                  <Text style={styles.actionBtnText}>Signalements</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => router.push(`/groups/${groupId}/audit`)}>
                  <Ionicons name="document-text-outline" size={16} color={Pastel.text} />
                  <Text style={styles.actionBtnText}>Journal</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Enregistrer */}
            <Pressable
              style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
              onPress={handleSaveSettings}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Enregistrement..." : "Enregistrer les modifications"}</Text>
            </Pressable>

            {/* Suppression */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Zone de danger</Text>
              <Text style={styles.sectionHint}>Cette action est définitive et supprimera le club et tout son contenu.</Text>
              <Pressable style={styles.dangerBtn} onPress={handleDeleteGroup}>
                <Ionicons name="trash-outline" size={15} color="#DC2626" />
                <Text style={styles.dangerBtnText}>Supprimer le club</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal édition */}
      <Modal transparent animationType="fade" visible={!!editField} onRequestClose={() => setEditField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editField === "name" ? "Nom du club" : "Description"}
            </Text>
            <TextInput
              value={draftValue}
              onChangeText={setDraftValue}
              placeholder={editField === "name" ? "Nom du club" : "Décris brièvement le club"}
              placeholderTextColor={Pastel.textMuted}
              style={[styles.modalInput, editField === "description" ? styles.modalInputMultiline : null]}
              multiline={editField === "description"}
              numberOfLines={editField === "description" ? 4 : 1}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setEditField(null)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={confirmEditModal}>
                <Text style={styles.modalConfirmText}>Valider</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: { flex: 1, fontSize: 16, fontFamily: Font.bold, color: Pastel.text, textAlign: "center", includeFontPadding: false },

  container: { padding: 20, paddingBottom: 60, gap: 24 },
  loadingState: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", marginTop: 40, includeFontPadding: false },

  divider: { height: 1, backgroundColor: Pastel.border },

  section: { gap: 12 },
  sectionTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  sectionHint: { fontSize: 12, color: Pastel.textMuted, lineHeight: 18, includeFontPadding: false },

  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1,
    borderColor: Pastel.border, backgroundColor: Pastel.surface,
  },
  actionBtnText: { fontSize: 13, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },

  infoCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 14, borderWidth: 1,
    borderColor: Pastel.border,
    padding: 14, gap: 6,
  },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoLabel: { fontSize: 11, fontFamily: Font.bold, color: Pastel.textMuted, textTransform: "uppercase", letterSpacing: 0.5, includeFontPadding: false },
  infoValue: { fontSize: 14, color: Pastel.text, lineHeight: 20, includeFontPadding: false },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, backgroundColor: Pastel.surfaceAlt,
  },
  editBtnText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
    borderColor: Pastel.border, backgroundColor: Pastel.surface,
  },
  chipActive: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  chipText: { fontSize: 12, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  chipTextActive: { color: "#FFFFFF" },
  selectedChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: Pastel.primary,
  },
  selectedChipText: { fontSize: 12, color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },

  saveBtn: {
    backgroundColor: Pastel.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 14, includeFontPadding: false },

  dangerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1,
    borderColor: "#FCA5A5", backgroundColor: "#FEF2F2",
  },
  dangerBtnText: { fontSize: 13, fontFamily: Font.bold, color: "#DC2626", includeFontPadding: false },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: Pastel.surface,
    borderRadius: 20, padding: 20, gap: 14,
  },
  modalTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  modalInput: {
    borderWidth: 1, borderColor: Pastel.border,
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 14,
    color: Pastel.text, backgroundColor: Pastel.background,
    includeFontPadding: false,
  },
  modalInputMultiline: { minHeight: 100, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalCancelBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1, borderColor: Pastel.border,
  },
  modalCancelText: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  modalConfirmBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, backgroundColor: Pastel.primary,
  },
  modalConfirmText: { fontSize: 13, fontFamily: Font.bold, color: "#FFFFFF", includeFontPadding: false },
});
