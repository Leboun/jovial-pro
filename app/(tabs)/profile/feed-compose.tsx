import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/services/supabase";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const MEDIA_BUCKET = "group-media";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type PickedPhoto = {
  uri: string;
  mimeType: string;
};

function cleanOptions(options: string[]) {
  return options.map((item) => item.trim()).filter(Boolean);
}

async function uploadProfilePhoto(userId: string, uri: string, mimeType: string, index: number) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Configuration Supabase manquante.");
  }
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token ?? null;
  if (!accessToken) {
    throw new Error("Session expirée. Reconnecte-toi.");
  }

  const extension = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : mimeType.includes("heic")
        ? "heic"
        : "jpg";
  const path = `profile-feed/${userId}/${Date.now()}-${index}.${extension}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`;
  const upload = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: "POST",
    headers: {
      "Content-Type": mimeType,
      "x-upsert": "true",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (upload.status < 200 || upload.status >= 300) {
    throw new Error(`Upload échoué (${upload.status}).`);
  }
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function ProfileFeedComposeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [publishing, setPublishing] = useState(false);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [activeTools, setActiveTools] = useState({
    poll: false,
    place: false,
    gif: false,
    countdown: false,
  });
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const pollChoices = useMemo(() => cleanOptions(pollOptions), [pollOptions]);
  const pollReady = pollQuestion.trim().length > 0 && pollChoices.length >= 2;
  const canPublish = useMemo(
    () => body.trim().length > 0 || photos.length > 0 || (activeTools.poll && pollReady),
    [activeTools.poll, body, photos.length, pollReady]
  );

  const handlePickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorise l'accès à la photothèque.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6,
    });
    if (result.canceled) return;
    const next = result.assets
      .filter((asset) => !!asset.uri)
      .map((asset) => ({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
      }));
    if (next.length === 0) return;
    setPhotos((prev) => [...prev, ...next].slice(0, 6));
  };

  const handleChangePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleAddPollOption = () => {
    setPollOptions((prev) => {
      if (prev.length >= 4) return prev;
      return [...prev, ""];
    });
  };

  const handleRemovePollOption = (index: number) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePublish = async () => {
    if (!userId) {
      Alert.alert("Connexion requise", "Connecte-toi pour publier.");
      return;
    }
    if (!canPublish) {
      Alert.alert("Contenu requis", "Ajoute du texte, des photos ou un sondage.");
      return;
    }
    if (activeTools.poll && !pollReady) {
      Alert.alert("Sondage incomplet", "Ajoute une question et au moins 2 réponses.");
      return;
    }

    setPublishing(true);
    try {
      const { data: createdPost, error: postError } = await supabase
        .from("profile_posts")
        .insert({
          author_id: userId,
          body: body.trim() || null,
          entry_type: "note",
        })
        .select("id")
        .maybeSingle();
      if (postError || !createdPost?.id) throw postError ?? new Error("Création impossible.");
      const postId = Number(createdPost.id);

      if (photos.length > 0) {
        const urls = await Promise.all(
          photos.map((photo, index) =>
            uploadProfilePhoto(userId, photo.uri, photo.mimeType, index)
          )
        );
        const rows = urls.map((url: string) => ({
          post_id: postId,
          url,
          media_type: "image",
        }));
        const { error: mediaError } = await supabase.from("profile_post_media").insert(rows);
        if (mediaError) throw mediaError;
      }

      if (activeTools.poll && pollReady) {
        const { data: pollData, error: pollError } = await supabase
          .from("profile_post_polls")
          .insert({
            post_id: postId,
            question: pollQuestion.trim(),
          })
          .select("id")
          .maybeSingle();
        if (pollError || !pollData?.id) throw pollError ?? new Error("Création sondage impossible.");

        const optionsPayload = pollChoices.map((label, index) => ({
          poll_id: Number(pollData.id),
          label,
          position: index + 1,
        }));
        const { error: optionsError } = await supabase
          .from("profile_post_poll_options")
          .insert(optionsPayload);
        if (optionsError) throw optionsError;
      }

      router.back();
    } catch (error) {
      Alert.alert("Erreur", "Impossible de publier pour le moment.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerAction}>
          <Ionicons name="close" size={22} color={Pastel.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouvelle publication</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Partagez votre message..."
          placeholderTextColor={Pastel.textMuted}
          multiline
          style={styles.input}
        />

        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photosRow}
          >
            {photos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                <Pressable
                  style={styles.photoRemove}
                  onPress={() =>
                    setPhotos((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable style={styles.actionChip} onPress={handlePickPhotos}>
            <Ionicons name="image" size={18} color={Pastel.text} />
            <Text style={styles.actionText}>Photos</Text>
          </Pressable>
          <Pressable
            style={[styles.actionChip, activeTools.poll ? styles.actionChipActive : null]}
            onPress={() => setActiveTools((prev) => ({ ...prev, poll: !prev.poll }))}
          >
            <Ionicons name="stats-chart" size={18} color={activeTools.poll ? "#FFFFFF" : Pastel.text} />
            <Text style={[styles.actionText, activeTools.poll ? styles.actionTextActive : null]}>
              Sondage
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionChip, activeTools.place ? styles.actionChipActive : null]}
            onPress={() => setActiveTools((prev) => ({ ...prev, place: !prev.place }))}
          >
            <Ionicons name="location" size={18} color={activeTools.place ? "#FFFFFF" : Pastel.text} />
            <Text style={[styles.actionText, activeTools.place ? styles.actionTextActive : null]}>Lieu</Text>
          </Pressable>
          <Pressable
            style={[styles.actionChip, activeTools.gif ? styles.actionChipActive : null]}
            onPress={() => setActiveTools((prev) => ({ ...prev, gif: !prev.gif }))}
          >
            <Ionicons name="happy" size={18} color={activeTools.gif ? "#FFFFFF" : Pastel.text} />
            <Text style={[styles.actionText, activeTools.gif ? styles.actionTextActive : null]}>GIF</Text>
          </Pressable>
          <Pressable
            style={[styles.actionChip, activeTools.countdown ? styles.actionChipActive : null]}
            onPress={() => setActiveTools((prev) => ({ ...prev, countdown: !prev.countdown }))}
          >
            <Ionicons name="timer" size={18} color={activeTools.countdown ? "#FFFFFF" : Pastel.text} />
            <Text style={[styles.actionText, activeTools.countdown ? styles.actionTextActive : null]}>
              Compte à rebours
            </Text>
          </Pressable>
        </View>

        {activeTools.poll ? (
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
                  style={styles.pollInput}
                />
                {pollOptions.length > 2 ? (
                  <Pressable onPress={() => handleRemovePollOption(index)} style={styles.pollRemoveBtn}>
                    <Ionicons name="trash-outline" size={16} color={Pastel.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <View style={styles.pollActions}>
              <Pressable
                style={[styles.smallChip, pollOptions.length >= 4 ? styles.disabledChip : null]}
                onPress={handleAddPollOption}
                disabled={pollOptions.length >= 4}
              >
                <Text style={styles.smallChipText}>Ajouter une réponse</Text>
              </Pressable>
              <Text style={styles.pollHint}>2 à 4 réponses</Text>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={handlePublish}
          style={[styles.publishButton, !canPublish || publishing ? styles.publishDisabled : null]}
          disabled={!canPublish || publishing}
        >
          <Text style={styles.publishText}>{publishing ? "Publication..." : "Publier"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Pastel.background },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: "transparent",
  },
  headerAction: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: Font.bold, color: Pastel.text },
  content: { padding: 14, gap: 14, paddingBottom: 44 },
  input: {
    minHeight: 180,
    color: Pastel.text,
    fontSize: 20,
    lineHeight: 28,
    textAlignVertical: "top",
  },
  photosRow: { gap: 10, paddingRight: 10 },
  photoWrap: {
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  photoPreview: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15,23,42,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  actionChipActive: {
    backgroundColor: Pastel.primary,
    borderColor: Pastel.primary,
  },
  actionText: { color: Pastel.text, fontSize: 16, fontFamily: Font.semiBold },
  actionTextActive: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.semiBold },
  pollCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
    gap: 10,
  },
  pollTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text },
  pollInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: Pastel.text,
    backgroundColor: Pastel.surfaceAlt,
  },
  pollOptionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollRemoveBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
  },
  pollActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
  },
  disabledChip: { opacity: 0.45 },
  smallChipText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.textMuted },
  pollHint: { fontSize: 12, color: Pastel.textMuted },
  publishButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Pastel.primary,
  },
  publishDisabled: {
    opacity: 0.4,
  },
  publishText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 16 },
});
