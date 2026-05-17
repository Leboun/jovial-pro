import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import { useAuth } from "@/providers/AuthProvider";
import { createGroupPost, updateGroupPost, uploadGroupMedia } from "@/services/groups";
import { supabase } from "@/services/supabase";
import { searchPlaces } from "@/services/places";

type PlaceResult = { place_id: string; label: string; address_line?: string | null };

type SelectedMedia = {
  uri: string;
  type: "image";
  mimeType: string;
};

export default function GroupComposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, groupName, openMedia, postId, body: bodyParam } = useLocalSearchParams<{
    id?: string; groupName?: string; openMedia?: string; postId?: string; body?: string;
  }>();
  const groupId = useMemo(() => (id ? Number(id) : null), [id]);
  const editingPostId = useMemo(() => (postId ? Number(postId) : null), [postId]);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [body, setBody] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [activeTools, setActiveTools] = useState({ poll: false, place: false, gif: false, countdown: false });
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const placeSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifSearching, setGifSearching] = useState(false);
  const [selectedGif, setSelectedGif] = useState<{ id: string; url: string } | null>(null);
  const gifSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollReady = pollQuestion.trim().length > 0 && cleanPollOptions.length >= 2;
  const canPublish = editingPostId
    ? body.trim().length > 0
    : body.trim().length > 0 || selectedMedia.length > 0 || (activeTools.poll && pollReady) || !!selectedGif;

  useEffect(() => {
    if (editingPostId && typeof bodyParam === "string") setBody(bodyParam);
  }, [editingPostId, bodyParam]);

  useEffect(() => {
    if (openMedia === "1" && !editingPostId) handlePickMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMedia, editingPostId]);

  useEffect(() => {
    if (!activeTools.place) { setPlaceQuery(""); setPlaceResults([]); setSelectedPlace(null); }
  }, [activeTools.place]);

  useEffect(() => {
    if (!activeTools.gif) { setGifQuery(""); setGifResults([]); setSelectedGif(null); }
  }, [activeTools.gif]);

  useEffect(() => {
    if (gifSearchRef.current) clearTimeout(gifSearchRef.current);
    if (!gifQuery.trim() || selectedGif) { setGifResults([]); return; }
    gifSearchRef.current = setTimeout(async () => {
      setGifSearching(true);
      try {
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=8G5coKvL6gSTYx0lSgHCzv7GtkpUCx7f&q=${encodeURIComponent(gifQuery.trim())}&limit=18&rating=g`
        );
        const json = await res.json();
        const items = (json.data ?? []).map((g: any) => ({
          id: g.id,
          url: g.images?.original?.url ?? "",
          preview: g.images?.fixed_width_small?.url ?? g.images?.original?.url ?? "",
        }));
        setGifResults(items);
      } catch {
        setGifResults([]);
      } finally {
        setGifSearching(false);
      }
    }, 400);
    return () => { if (gifSearchRef.current) clearTimeout(gifSearchRef.current); };
  }, [gifQuery, selectedGif]);

  useEffect(() => {
    if (placeSearchRef.current) clearTimeout(placeSearchRef.current);
    if (!placeQuery.trim() || selectedPlace) { setPlaceResults([]); return; }
    placeSearchRef.current = setTimeout(async () => {
      setPlaceSearching(true);
      try {
        const results = await searchPlaces(placeQuery.trim());
        setPlaceResults(results.map((r) => ({ place_id: r.place_id, label: r.label, address_line: r.address_line ?? null })));
      } catch {
        setPlaceResults([]);
      } finally {
        setPlaceSearching(false);
      }
    }, 350);
    return () => { if (placeSearchRef.current) clearTimeout(placeSearchRef.current); };
  }, [placeQuery, selectedPlace]);

  const handlePickMedia = async () => {
    if (editingPostId) return;
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
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const next = result.assets.filter((a) => a.uri).map((a) => ({
      uri: a.uri, type: "image" as const, mimeType: a.mimeType ?? "image/jpeg",
    }));
    if (next.length === 0) return;
    setSelectedMedia((prev) => {
      const combined = [...prev, ...next];
      if (combined.length > 15) {
        Alert.alert("Limite de photos", "Tu peux ajouter jusqu'à 15 photos.");
        return combined.slice(0, 15);
      }
      return combined;
    });
  };

  const handlePublish = async () => {
    if (!groupId || !userId) { Alert.alert("Connexion requise", "Connecte-toi pour publier."); return; }
    if (!editingPostId && !body.trim() && selectedMedia.length === 0 && !(activeTools.poll && pollReady)) {
      Alert.alert("Texte ou media requis", "Ajoute un message ou un media."); return;
    }
    if (!editingPostId && activeTools.poll && !pollReady) {
      Alert.alert("Sondage incomplet", "Ajoute une question et au moins 2 réponses."); return;
    }
    setPublishing(true);
    try {
      if (editingPostId) {
        await updateGroupPost(editingPostId, body.trim());
      } else {
        const created = await createGroupPost(groupId, userId, body.trim(), {
          locationPlaceId: selectedPlace?.place_id,
          locationLabel: selectedPlace?.label,
          gifUrl: selectedGif?.url,
        });
        if (!created?.id) throw new Error("Creation impossible.");
        if (selectedMedia.length > 0) {
          await Promise.all(selectedMedia.map((media) =>
            uploadGroupMedia({ groupId, postId: created.id, uri: media.uri, mimeType: media.mimeType, mediaType: media.type })
          ));
        }
        if (activeTools.poll && pollReady) {
          const { data: pollData, error: pollError } = await supabase
            .from("community_group_post_polls")
            .insert({ post_id: created.id, question: pollQuestion.trim() })
            .select("id").maybeSingle();
          if (pollError || !pollData?.id) throw pollError ?? new Error("Sondage impossible.");
          const { error: optionsError } = await supabase
            .from("community_group_post_poll_options")
            .insert(cleanPollOptions.map((label, i) => ({ poll_id: Number(pollData.id), label, position: i + 1 })));
          if (optionsError) throw optionsError;
        }
      }
      router.back();
    } catch {
      Alert.alert("Erreur", editingPostId ? "Impossible de modifier la publication." : "Impossible de publier.");
    } finally {
      setPublishing(false);
    }
  };

  const toggleTool = (tool: keyof typeof activeTools) =>
    setActiveTools((prev) => ({ ...prev, [tool]: !prev[tool] }));

  const handleChangePollOption = (index: number, value: string) =>
    setPollOptions((prev) => prev.map((item, i) => (i === index ? value : item)));

  const handleAddPollOption = () =>
    setPollOptions((prev) => prev.length >= 4 ? prev : [...prev, ""]);

  const handleRemovePollOption = (index: number) =>
    setPollOptions((prev) => prev.length <= 2 ? prev : prev.filter((_, i) => i !== index));

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={18} color={Pastel.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {editingPostId ? "Modifier la publication" : groupName ?? "Nouvelle publication"}
        </Text>
        <Pressable
          style={[styles.publishBtn, !canPublish || publishing ? styles.publishBtnDisabled : null]}
          onPress={handlePublish}
          disabled={!canPublish || publishing}
        >
          <Text style={styles.publishBtnText}>{publishing ? "..." : editingPostId ? "Enregistrer" : "Publier"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Zone de texte */}
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Partagez votre message..."
          placeholderTextColor={Pastel.textMuted}
          multiline
          style={styles.input}
          autoFocus
        />

        {/* Aperçu médias */}
        {selectedMedia.length > 0 && !editingPostId ? (
          <View style={styles.mediaPreviewRow}>
            {selectedMedia.map((media, index) => (
              <View key={`${media.uri}-${index}`} style={styles.mediaPreviewWrap}>
                <Image source={{ uri: media.uri }} style={styles.mediaPreview} contentFit="cover" />
                <Pressable
                  style={styles.mediaRemove}
                  onPress={() => setSelectedMedia((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close" size={13} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Sondage */}
        {!editingPostId && activeTools.poll ? (
          <View style={styles.pollCard}>
            <Text style={styles.pollTitle}>Créer un sondage</Text>
            <TextInput
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="Question du sondage"
              placeholderTextColor={Pastel.textMuted}
              style={styles.pollInput}
            />
            {pollOptions.map((option, index) => (
              <View key={index} style={styles.pollOptionRow}>
                <TextInput
                  value={option}
                  onChangeText={(value) => handleChangePollOption(index, value)}
                  placeholder={`Réponse ${index + 1}`}
                  placeholderTextColor={Pastel.textMuted}
                  style={[styles.pollInput, { flex: 1 }]}
                />
                {pollOptions.length > 2 ? (
                  <Pressable onPress={() => handleRemovePollOption(index)} style={styles.pollRemoveBtn}>
                    <Ionicons name="trash-outline" size={15} color={Pastel.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <View style={styles.pollFooter}>
              <Pressable
                style={[styles.smallChip, pollOptions.length >= 4 ? styles.smallChipDisabled : null]}
                onPress={handleAddPollOption}
                disabled={pollOptions.length >= 4}
              >
                <Text style={styles.smallChipText}>+ Ajouter une réponse</Text>
              </Pressable>
              <Text style={styles.pollHint}>2 à 4 réponses</Text>
            </View>
          </View>
        ) : null}

        {/* GIF */}
        {!editingPostId && activeTools.gif ? (
          <View style={styles.gifCard}>
            <Text style={styles.pollTitle}>Ajouter un GIF</Text>
            {selectedGif ? (
              <View style={styles.gifSelectedWrap}>
                <Image source={{ uri: selectedGif.url }} style={styles.gifSelectedPreview} contentFit="cover" />
                <Pressable style={styles.gifRemove} onPress={() => { setSelectedGif(null); setGifQuery(""); }} hitSlop={8}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.placeInputRow}>
                  <Ionicons name="search-outline" size={16} color={Pastel.textMuted} />
                  <TextInput
                    value={gifQuery}
                    onChangeText={setGifQuery}
                    placeholder="Rechercher un GIF..."
                    placeholderTextColor={Pastel.textMuted}
                    style={styles.placeInput}
                  />
                  {gifSearching ? <ActivityIndicator size="small" color={Pastel.textMuted} /> : null}
                </View>
                {gifResults.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gifGrid}>
                    {gifResults.map((gif) => (
                      <Pressable key={gif.id} onPress={() => setSelectedGif({ id: gif.id, url: gif.url })} style={styles.gifThumbWrap}>
                        <Image source={{ uri: gif.preview }} style={styles.gifThumb} contentFit="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : gifQuery.trim() && !gifSearching ? (
                  <Text style={styles.pollHint}>Aucun résultat.</Text>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {/* Lieu */}
        {!editingPostId && activeTools.place ? (
          <View style={styles.placeCard}>
            <Text style={styles.pollTitle}>Ajouter un lieu</Text>
            {selectedPlace ? (
              <View style={styles.selectedPlace}>
                <Ionicons name="location" size={16} color={Pastel.text} />
                <Text style={styles.selectedPlaceText} numberOfLines={1}>{selectedPlace.label}</Text>
                <Pressable onPress={() => { setSelectedPlace(null); setPlaceQuery(""); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Pastel.textMuted} />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.placeInputRow}>
                  <Ionicons name="search-outline" size={16} color={Pastel.textMuted} />
                  <TextInput
                    value={placeQuery}
                    onChangeText={setPlaceQuery}
                    placeholder="Rechercher un lieu..."
                    placeholderTextColor={Pastel.textMuted}
                    style={styles.placeInput}
                    autoFocus={false}
                  />
                  {placeSearching ? <ActivityIndicator size="small" color={Pastel.textMuted} /> : null}
                </View>
                {placeResults.length > 0 ? (
                  <View style={styles.placeResults}>
                    {placeResults.map((place) => (
                      <Pressable
                        key={place.place_id}
                        style={styles.placeResultRow}
                        onPress={() => { setSelectedPlace(place); setPlaceResults([]); }}
                      >
                        <Ionicons name="location-outline" size={14} color={Pastel.textMuted} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.placeResultLabel} numberOfLines={1}>{place.label}</Text>
                          {place.address_line ? (
                            <Text style={styles.placeResultSub} numberOfLines={1}>{place.address_line}</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Outils */}
        {!editingPostId ? (
          <View style={styles.toolsRow}>
            <Pressable style={styles.toolChip} onPress={handlePickMedia}>
              <Ionicons name="image-outline" size={20} color={Pastel.text} />
              <Text style={styles.toolText}>Photos</Text>
            </Pressable>
            <Pressable
              style={[styles.toolChip, activeTools.poll ? styles.toolChipActive : null]}
              onPress={() => toggleTool("poll")}
            >
              <Ionicons name="stats-chart-outline" size={20} color={activeTools.poll ? "#FFFFFF" : Pastel.text} />
              <Text style={[styles.toolText, activeTools.poll ? styles.toolTextActive : null]}>Sondage</Text>
            </Pressable>
            <Pressable
              style={[styles.toolChip, activeTools.place ? styles.toolChipActive : null]}
              onPress={() => toggleTool("place")}
            >
              <Ionicons name="location-outline" size={20} color={activeTools.place ? "#FFFFFF" : Pastel.text} />
              <Text style={[styles.toolText, activeTools.place ? styles.toolTextActive : null]}>Lieu</Text>
            </Pressable>
            <Pressable
              style={[styles.toolChip, activeTools.gif ? styles.toolChipActive : null]}
              onPress={() => toggleTool("gif")}
            >
              <Ionicons name="happy-outline" size={20} color={activeTools.gif ? "#FFFFFF" : Pastel.text} />
              <Text style={[styles.toolText, activeTools.gif ? styles.toolTextActive : null]}>GIF</Text>
            </Pressable>
            <Pressable
              style={[styles.toolChip, activeTools.countdown ? styles.toolChipActive : null]}
              onPress={() => toggleTool("countdown")}
            >
              <Ionicons name="timer-outline" size={20} color={activeTools.countdown ? "#FFFFFF" : Pastel.text} />
              <Text style={[styles.toolText, activeTools.countdown ? styles.toolTextActive : null]}>Compte à rebours</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 15, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  publishBtn: {
    backgroundColor: Pastel.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  publishBtnDisabled: { opacity: 0.35 },
  publishBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 13, includeFontPadding: false },

  content: { padding: 20, gap: 16, paddingBottom: 40 },

  input: {
    minHeight: 180,
    fontSize: 16,
    color: Pastel.text,
    textAlignVertical: "top",
    lineHeight: 24,
    includeFontPadding: false,
  },

  mediaPreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mediaPreviewWrap: { width: 88, height: 88 },
  mediaPreview: { width: 88, height: 88, borderRadius: 14 },
  mediaRemove: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center",
  },

  divider: { height: 1, backgroundColor: Pastel.border },

  toolsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toolChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
    borderColor: Pastel.border, backgroundColor: Pastel.background,
  },
  toolChipActive: { backgroundColor: Pastel.primary, borderColor: Pastel.primary },
  toolText: { fontSize: 13, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  toolTextActive: { color: "#FFFFFF" },

  pollCard: {
    backgroundColor: Pastel.background,
    borderRadius: 16, borderWidth: 1,
    borderColor: Pastel.border,
    padding: 16, gap: 10,
  },
  pollTitle: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  pollInput: {
    borderWidth: 1, borderColor: Pastel.border,
    borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, color: Pastel.text,
    backgroundColor: Pastel.surface, fontSize: 14,
    includeFontPadding: false,
  },
  pollOptionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollRemoveBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  pollFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  smallChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
    borderColor: Pastel.border, backgroundColor: Pastel.surface,
  },
  smallChipDisabled: { opacity: 0.4 },
  smallChipText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  pollHint: { fontSize: 11, color: Pastel.textMuted, includeFontPadding: false },

  gifCard: {
    backgroundColor: Pastel.background,
    borderRadius: 16, borderWidth: 1,
    borderColor: Pastel.border,
    padding: 16, gap: 10,
  },
  gifGrid: { gap: 8, paddingVertical: 4 },
  gifThumbWrap: { width: 100, height: 80, borderRadius: 10, overflow: "hidden", backgroundColor: Pastel.border },
  gifThumb: { width: "100%", height: "100%" },
  gifSelectedWrap: { position: "relative", alignSelf: "flex-start" },
  gifSelectedPreview: { width: 200, height: 150, borderRadius: 12 },
  gifRemove: {
    position: "absolute", top: -6, right: -6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center",
  },

  placeCard: {
    backgroundColor: Pastel.background,
    borderRadius: 16, borderWidth: 1,
    borderColor: Pastel.border,
    padding: 16, gap: 10,
  },
  placeInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: Pastel.border,
    borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: Pastel.surface,
  },
  placeInput: { flex: 1, fontSize: 14, color: Pastel.text, includeFontPadding: false },
  placeResults: {
    backgroundColor: Pastel.surface,
    borderRadius: 12, borderWidth: 1,
    borderColor: Pastel.border, overflow: "hidden",
  },
  placeResultRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Pastel.border,
  },
  placeResultLabel: { fontSize: 13, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  placeResultSub: { fontSize: 11, color: Pastel.textMuted, marginTop: 1, includeFontPadding: false },
  selectedPlace: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Pastel.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Pastel.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  selectedPlaceText: { flex: 1, fontSize: 13, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
});
