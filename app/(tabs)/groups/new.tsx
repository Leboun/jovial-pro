import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import { patchGroupCache } from "@/services/groupCache";
import {
  createGroup,
  listGroupTopics,
  setGroupPrimaryTopicTag,
  updateGroup,
  uploadGroupImage,
} from "@/services/groups";

export default function GroupCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    charterAccepted: charterAcceptedParam,
    draftName, draftDescription, draftTopicId, draftCategory,
    draftPlaceId, draftPlaceLabel, draftVisibility, draftStep,
    draftAvatarUri, draftCoverUri,
  } = useLocalSearchParams<{
    charterAccepted?: string; draftName?: string; draftDescription?: string;
    draftTopicId?: string; draftCategory?: string; draftPlaceId?: string;
    draftPlaceLabel?: string; draftVisibility?: "public" | "private";
    draftStep?: string; draftAvatarUri?: string; draftCoverUri?: string;
  }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<{ place_id: string; label: string; lat?: number | null; lon?: number | null }[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{ place_id: string; label: string; lat?: number | null; lon?: number | null } | null>(null);
  const [topics, setTopics] = useState<{ id: number; label: string; category: string; sort_order?: number | null }[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const groupedTopics = useMemo(() => {
    const grouped = topics.reduce<Record<string, { id: number; label: string }[]>>((acc, item) => {
      const key = item.category || "Autres";
      if (!acc[key]) acc[key] = [];
      acc[key].push({ id: item.id, label: item.label });
      return acc;
    }, {});
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [topics]);

  useEffect(() => { if (charterAcceptedParam === "1") setCharterAccepted(true); }, [charterAcceptedParam]);

  useEffect(() => {
    if (typeof draftName === "string") setName(draftName);
    if (typeof draftDescription === "string") setDescription(draftDescription);
    if (typeof draftCategory === "string") setExpandedCategory(draftCategory || null);
    if (typeof draftTopicId === "string") { const p = Number(draftTopicId); setSelectedTopicId(Number.isFinite(p) ? p : null); }
    if (typeof draftPlaceId === "string" && typeof draftPlaceLabel === "string") { setSelectedPlace({ place_id: draftPlaceId, label: draftPlaceLabel }); setPlaceQuery(draftPlaceLabel); }
    if (draftVisibility === "public" || draftVisibility === "private") setVisibility(draftVisibility);
    if (typeof draftStep === "string") { const p = Number(draftStep); if (Number.isFinite(p)) setStepIndex(Math.max(0, Math.min(3, p))); }
    if (typeof draftAvatarUri === "string") setAvatarUri(draftAvatarUri);
    if (typeof draftCoverUri === "string") setCoverUri(draftCoverUri);
  }, [draftName, draftDescription, draftCategory, draftTopicId, draftPlaceId, draftPlaceLabel, draftVisibility, draftStep, draftAvatarUri, draftCoverUri]);

  useEffect(() => {
    let cancelled = false;
    listGroupTopics().then((rows) => {
      if (!cancelled) setTopics(rows.map((r) => ({ id: r.id, label: r.label, category: r.category, sort_order: r.sort_order ?? null })));
    }).catch(() => { if (!cancelled) setTopics([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const term = placeQuery.trim();
    if (term.length < 3) { setPlaceResults([]); return; }
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setPlaceLoading(true);
      try {
        const { searchPlaces } = await import("@/services/places");
        const results = await searchPlaces(term, 6, controller.signal);
        if (!cancelled) {
          const unique = Array.from(new Map(results.map((item) => [(item.label || item.place_id || "").trim().toLowerCase(), item])).values());
          setPlaceResults(unique);
        }
      } catch { if (!cancelled) setPlaceResults([]); }
      finally { if (!cancelled) setPlaceLoading(false); }
    }, 350);
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [placeQuery]);

  const steps = [
    { key: "topic", title: "Choisis la thématique de ton club" },
    { key: "details", title: "Personnalise ton club" },
    { key: "privacy", title: "Privé ou public ?" },
    { key: "location", title: "Où se trouve ton club ?" },
  ];

  const canGoNext = () => {
    if (stepIndex === 0) return !!selectedTopicId;
    if (stepIndex === 1) return name.trim().length > 0;
    if (stepIndex === 2) return true;
    if (stepIndex === 3) return !!selectedPlace?.place_id;
    return false;
  };

  const handlePickAvatar = async () => {
    try {
      const picker = await import("expo-image-picker");
      const perm = await picker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Autorisation requise", "Autorise l'accès à tes photos."); return; }
      const result = await picker.launchImageLibraryAsync({ mediaTypes: picker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.9 });
      if (!result.canceled && result.assets?.length) setAvatarUri(result.assets[0].uri);
    } catch { Alert.alert("Erreur", "Impossible de sélectionner l'image."); }
  };

  const handlePickCover = async () => {
    try {
      const picker = await import("expo-image-picker");
      const perm = await picker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert("Autorisation requise", "Autorise l'accès à tes photos."); return; }
      const result = await picker.launchImageLibraryAsync({ mediaTypes: picker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.9 });
      if (!result.canceled && result.assets?.length) setCoverUri(result.assets[0].uri);
    } catch { Alert.alert("Erreur", "Impossible de sélectionner l'image."); }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!userId) { Alert.alert("Connexion requise", "Connecte-toi pour créer un club."); router.push("/(auth)/login"); return; }
    if (!name.trim()) { Alert.alert("Nom requis", "Renseigne un nom de groupe."); return; }
    if (!charterAccepted) { Alert.alert("Charte", "Tu dois lire et accepter la charte pour créer un club."); return; }
    if (!selectedTopicId) { Alert.alert("Thématique requise", "Choisis la thématique principale du club."); return; }
    if (!selectedPlace?.place_id) { Alert.alert("Lieu requis", "Choisis une ville dans les suggestions."); return; }
    setSaving(true);
    try {
      if (selectedPlace?.place_id && selectedPlace.label) {
        try {
          const raw = await AsyncStorage.getItem("places.labelCache");
          const parsed = raw && raw.trim().length > 0 ? (JSON.parse(raw) as Record<string, string>) : {};
          parsed[selectedPlace.place_id] = selectedPlace.label;
          await AsyncStorage.setItem("places.labelCache", JSON.stringify(parsed));
        } catch { /* ignore */ }
      }
      const group = await createGroup(userId, {
        name, description, visibility,
        topicIds: [selectedTopicId],
        location_place_id: selectedPlace?.place_id ?? null,
        location_lat: selectedPlace?.lat ?? null,
        location_lng: selectedPlace?.lon ?? null,
      });
      if (group) {
        try {
          if (avatarUri) {
            try {
              const manipulator = await import("expo-image-manipulator");
              const processed = await manipulator.manipulateAsync(avatarUri, [{ resize: { width: 800 } }], { compress: 0.9, format: manipulator.SaveFormat.JPEG });
              const publicUrl = await uploadGroupImage({ groupId: group.id, uri: processed.uri, kind: "avatar", mimeType: "image/jpeg" });
              if (publicUrl) {
                const updated = await updateGroup(group.id, { avatar_image_url: publicUrl, updated_at: new Date().toISOString() });
                patchGroupCache(group.id, { avatar_image_url: publicUrl, serverUpdatedAt: updated?.updated_at ?? null });
              }
            } catch { Alert.alert("Erreur", "Impossible d'enregistrer la photo de profil."); }
          }
          if (coverUri) {
            try {
              const manipulator = await import("expo-image-manipulator");
              const processed = await manipulator.manipulateAsync(coverUri, [{ resize: { width: 1600 } }], { compress: 0.9, format: manipulator.SaveFormat.JPEG });
              const publicUrl = await uploadGroupImage({ groupId: group.id, uri: processed.uri, kind: "cover", mimeType: "image/jpeg" });
              if (publicUrl) {
                const updated = await updateGroup(group.id, { cover_image_url: publicUrl, updated_at: new Date().toISOString() });
                patchGroupCache(group.id, { cover_image_url: publicUrl, serverUpdatedAt: updated?.updated_at ?? null });
              }
            } catch { Alert.alert("Erreur", "Impossible d'enregistrer la photo de couverture."); }
          }
          await setGroupPrimaryTopicTag(group.id, selectedTopicId);
        } catch { /* ignore */ }
        try { await AsyncStorage.setItem("groups.activeSection", "mine"); } catch { /* ignore */ }
        router.replace("/(tabs)/groups");
      } else {
        router.back();
      }
    } catch { Alert.alert("Erreur", "Impossible de créer le groupe."); }
    finally { setSaving(false); }
  };

  const goToCharter = () => {
    router.push({
      pathname: "/groups/charter",
      params: {
        draftName: name, draftDescription: description,
        draftTopicId: selectedTopicId ? String(selectedTopicId) : "",
        draftCategory: expandedCategory ?? "",
        draftPlaceId: selectedPlace?.place_id ?? "", draftPlaceLabel: selectedPlace?.label ?? "",
        draftVisibility: visibility, draftStep: String(stepIndex),
        draftAvatarUri: avatarUri ?? "", draftCoverUri: coverUri ?? "",
      },
    });
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    if (stepIndex < steps.length - 1) setStepIndex((prev) => prev + 1);
    else handleSave();
  };

  const handleBack = () => {
    if (stepIndex === 0) { router.back(); return; }
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.navBtn} onPress={handleBack} hitSlop={10}>
          {stepIndex === 0 ? (
            <Ionicons name="close" size={18} color={Pastel.text} />
          ) : (
            <Ionicons name="chevron-back" size={18} color={Pastel.text} />
          )}
          <Text style={styles.navBtnText}>{stepIndex === 0 ? "Fermer" : "Retour"}</Text>
        </Pressable>
        <View style={styles.progressRow}>
          {steps.map((step, index) => (
            <View key={step.key} style={[styles.progressBar, index <= stepIndex ? styles.progressBarActive : null]} />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{steps[stepIndex]?.title}</Text>

        {/* ── ÉTAPE 0 : THÉMATIQUE ── */}
        {stepIndex === 0 ? (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Choisis une thématique principale pour ton club.</Text>
            {!expandedCategory ? (
              <View style={styles.chipGrid}>
                {groupedTopics.map(([category]) => (
                  <Pressable key={category} style={styles.categoryChip} onPress={() => setExpandedCategory(category)}>
                    <Text style={styles.categoryChipText}>{category}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.subcategoryCard}>
                <View style={styles.subcategoryHeader}>
                  <Text style={styles.subcategoryTitle}>{expandedCategory}</Text>
                  <Pressable onPress={() => setExpandedCategory(null)}>
                    <Text style={styles.resetText}>Toutes les thématiques</Text>
                  </Pressable>
                </View>
                <View style={styles.chipGrid}>
                  {(groupedTopics.find(([cat]) => cat === expandedCategory)?.[1] ?? []).map((topic) => {
                    const active = topic.id === selectedTopicId;
                    return (
                      <Pressable key={topic.id} onPress={() => setSelectedTopicId(topic.id)} style={[styles.chip, active ? styles.chipActive : null]}>
                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{topic.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* ── ÉTAPE 1 : DÉTAILS ── */}
        {stepIndex === 1 ? (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Donne un nom, une description et une image à ton club.</Text>
            <View style={styles.photoRow}>
              <Pressable style={[styles.photoCard, avatarUri ? styles.photoCardDone : null]} onPress={handlePickAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                ) : (
                  <View style={styles.photoCardInner}>
                    <Ionicons name="person-circle-outline" size={32} color={Pastel.textMuted} />
                    <Text style={styles.photoCardText}>Photo de profil</Text>
                  </View>
                )}
              </Pressable>
              <Pressable style={[styles.coverCard, coverUri ? styles.photoCardDone : null]} onPress={handlePickCover}>
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.photoCardInner}>
                    <Ionicons name="image-outline" size={32} color={Pastel.textMuted} />
                    <Text style={styles.photoCardText}>Photo de couverture</Text>
                  </View>
                )}
              </Pressable>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom du club"
                placeholderTextColor={Pastel.textMuted}
                style={styles.input}
                maxLength={60}
              />
              <Text style={styles.counter}>{Math.max(0, 60 - name.length)} caractères restants</Text>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                placeholderTextColor={Pastel.textMuted}
                style={[styles.input, styles.textArea]}
                multiline
                maxLength={1000}
              />
              <Text style={styles.counter}>{Math.max(0, 1000 - description.length)} caractères restants</Text>
            </View>
          </View>
        ) : null}

        {/* ── ÉTAPE 2 : VISIBILITÉ ── */}
        {stepIndex === 2 ? (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Choisis la confidentialité du club.</Text>
            <Pressable style={[styles.optionCard, visibility === "public" ? styles.optionCardActive : null]} onPress={() => setVisibility("public")}>
              <View style={styles.optionLeft}>
                <View style={[styles.optionRadio, visibility === "public" ? styles.optionRadioActive : null]}>
                  {visibility === "public" ? <View style={styles.optionRadioDot} /> : null}
                </View>
              </View>
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>Public</Text>
                <Text style={styles.optionDesc}>Tout le monde peut trouver et rejoindre ton club.</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.optionCard, visibility === "private" ? styles.optionCardActive : null]} onPress={() => setVisibility("private")}>
              <View style={styles.optionLeft}>
                <View style={[styles.optionRadio, visibility === "private" ? styles.optionRadioActive : null]}>
                  {visibility === "private" ? <View style={styles.optionRadioDot} /> : null}
                </View>
              </View>
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>Privé</Text>
                <Text style={styles.optionDesc}>Les membres doivent être approuvés pour rejoindre.</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* ── ÉTAPE 3 : LIEU ── */}
        {stepIndex === 3 ? (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Sélectionne la ville de rattachement du club.</Text>
            {selectedPlace ? (
              <View style={styles.selectedPlace}>
                <Ionicons name="location" size={16} color={Pastel.text} />
                <Text style={styles.selectedPlaceText}>{selectedPlace.label}</Text>
                <Pressable onPress={() => { setSelectedPlace(null); setPlaceQuery(""); }}>
                  <Ionicons name="close-circle" size={18} color={Pastel.textMuted} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.inputWrap}>
              <TextInput
                value={placeQuery}
                onChangeText={(v) => { setPlaceQuery(v); setSelectedPlace(null); }}
                placeholder="Ville, département, pays…"
                placeholderTextColor={Pastel.textMuted}
                style={styles.input}
              />
              {placeLoading ? <Text style={styles.counter}>Recherche…</Text> : null}
            </View>
            {placeResults.length > 0 ? (
              <View style={styles.placeResults}>
                {placeResults.map((item) => (
                  <Pressable
                    key={item.place_id}
                    style={styles.placeRow}
                    onPress={async () => {
                      setSelectedPlace(item);
                      setPlaceQuery(item.label);
                      setPlaceResults([]);
                      try {
                        const raw = await AsyncStorage.getItem("places.labelCache");
                        const parsed = raw && raw.trim().length > 0 ? (JSON.parse(raw) as Record<string, string>) : {};
                        parsed[item.place_id] = item.label;
                        await AsyncStorage.setItem("places.labelCache", JSON.stringify(parsed));
                      } catch { /* ignore */ }
                    }}
                  >
                    <Ionicons name="location-outline" size={14} color={Pastel.textMuted} />
                    <Text style={styles.placeText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ── FOOTER ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <View style={styles.charterRow}>
          <Pressable style={[styles.checkbox, charterAccepted ? styles.checkboxDone : null]} onPress={goToCharter}>
            {charterAccepted ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
          </Pressable>
          <Text style={styles.charterText}>{charterAccepted ? "Charte acceptée" : "Charte non acceptée"}</Text>
          <Pressable onPress={goToCharter}>
            <Text style={styles.charterLink}>Lire la charte</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.primaryBtn, !canGoNext() ? styles.primaryBtnDisabled : null]}
          onPress={handleNext}
          disabled={saving || !canGoNext()}
        >
          <Text style={styles.primaryBtnText}>
            {saving ? "Création…" : stepIndex === steps.length - 1 ? "Créer le club" : "Suivant"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  navBtnText: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  progressRow: { flexDirection: "row", gap: 6 },
  progressBar: { flex: 1, height: 3, borderRadius: 999, backgroundColor: Pastel.border },
  progressBarActive: { backgroundColor: Pastel.primary },

  container: { padding: 20, paddingBottom: 40, gap: 20 },
  title: { fontSize: 28, fontFamily: Font.display, color: Pastel.text, letterSpacing: 0.5, includeFontPadding: false },
  subtitle: { fontSize: 14, color: Pastel.textMuted, lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },
  section: { gap: 14 },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  categoryChipText: { fontSize: 13, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  subcategoryCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 16,
    gap: 14,
  },
  subcategoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subcategoryTitle: { fontSize: 15, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  resetText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
  },
  chipActive: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  chipText: { fontSize: 13, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  chipTextActive: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },

  photoRow: { flexDirection: "row", gap: 10 },
  photoCard: {
    width: 110, height: 110,
    borderRadius: 16, borderWidth: 1, borderColor: Pastel.border,
    backgroundColor: Pastel.surface, overflow: "hidden",
  },
  coverCard: {
    flex: 1, height: 110,
    borderRadius: 16, borderWidth: 1, borderColor: Pastel.border,
    backgroundColor: Pastel.surface, overflow: "hidden",
  },
  photoCardDone: { borderColor: Pastel.primary },
  photoCardInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  photoCardText: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },
  avatarPreview: { width: "100%", height: "100%" },
  coverPreview: { width: "100%", height: "100%" },

  inputWrap: { gap: 4 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 15,
    color: Pastel.text,
    fontFamily: Font.regular,
    backgroundColor: "transparent",
    includeFontPadding: false,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  counter: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },

  optionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  optionCardActive: { borderColor: Pastel.primary, borderWidth: 2 },
  optionLeft: { paddingTop: 2 },
  optionRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Pastel.border,
    alignItems: "center", justifyContent: "center",
  },
  optionRadioActive: { borderColor: Pastel.primary },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Pastel.primary },
  optionBody: { flex: 1, gap: 4 },
  optionTitle: { fontSize: 15, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  optionDesc: { fontSize: 13, color: Pastel.textMuted, lineHeight: 18, fontFamily: Font.regular, includeFontPadding: false },

  selectedPlace: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedPlaceText: { flex: 1, fontSize: 14, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  placeResults: {
    backgroundColor: Pastel.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Pastel.border,
    overflow: "hidden",
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.surfaceAlt,
  },
  placeText: { fontSize: 13, color: Pastel.text, fontFamily: Font.regular, includeFontPadding: false },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
  },
  charterRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1, borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  checkboxDone: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  charterText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  charterLink: { fontSize: 12, color: Pastel.primary, fontFamily: Font.bold, includeFontPadding: false },
  primaryBtn: {
    backgroundColor: Pastel.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 15, includeFontPadding: false },
});
