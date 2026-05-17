import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { createPost, uploadPostPhoto } from "@/services/club";
import { listMyEvents, EstablishmentEvent } from "@/services/establishment";

const MAX_PHOTOS = 5;

export default function ClubNewPostScreen() {
  const router = useRouter();
  const { clubId, venueId } = useLocalSearchParams<{ clubId?: string; venueId?: string }>();

  const parsedClubId = clubId ? parseInt(clubId, 10) : null;
  const parsedVenueId = venueId ? parseInt(venueId, 10) : null;

  const [content, setContent] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<EstablishmentEvent[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parsedVenueId) return;
    listMyEvents(parsedVenueId)
      .then((list) => {
        const upcoming = list.filter(
          (e) => e.is_published && new Date(e.starts_at) >= new Date()
        );
        setEvents(upcoming);
      })
      .catch(() => {});
  }, [parsedVenueId]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const handleAddPhoto = async () => {
    if (!parsedVenueId || photoUrls.length >= MAX_PHOTOS) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadPostPhoto(parsedVenueId);
      if (url) setPhotoUrls((prev) => [...prev, url]);
    } catch {
      setError("Upload impossible.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!parsedClubId || !parsedVenueId || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        club_id: parsedClubId,
        author_venue_id: parsedVenueId,
        content: content.trim(),
        photo_urls: photoUrls,
        event_id: selectedEventId,
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de publier.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = content.trim().length >= 1 && !submitting;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={"#111827"} />
          <Text style={styles.backBtnText}>Retour</Text>
        </Pressable>
        <Text style={styles.pageTitle}>Nouvelle publication</Text>
        <Text style={styles.pageSubtitle}>
          Partagez une actualité, une photo ou un événement avec les membres de votre club.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Contenu texte */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Contenu *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={content}
          onChangeText={setContent}
          placeholder="Rédigez votre publication…"
          placeholderTextColor={"#9CA3AF"}
          multiline
          maxLength={1200}
          autoFocus
        />
        <Text style={styles.fieldHint}>{content.length}/1200 caractères</Text>
      </View>

      {/* Photos */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.fieldLabel}>Photos</Text>
          <Text style={styles.fieldHint}>{photoUrls.length}/{MAX_PHOTOS}</Text>
        </View>

        {photoUrls.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
            {photoUrls.map((url, i) => (
              <View key={i} style={styles.photoWrap}>
                <Image source={{ uri: url }} style={styles.photoThumb} />
                <Pressable style={styles.photoRemoveBtn} onPress={() => handleRemovePhoto(i)}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {photoUrls.length < MAX_PHOTOS ? (
          <Pressable
            style={styles.addPhotoBtn}
            onPress={handleAddPhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator color={"#111827"} size="small" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={18} color={"#111827"} />
                <Text style={styles.addPhotoBtnText}>Ajouter une photo</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* Partager un événement */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Partager un événement (optionnel)</Text>
        <Text style={styles.fieldHint}>
          Associez un de vos événements à venir à cette publication.
        </Text>

        {selectedEvent ? (
          <View style={styles.eventSelected}>
            <View style={styles.eventSelectedInfo}>
              <Ionicons name="calendar" size={16} color={"#111827"} />
              <View style={styles.eventSelectedText}>
                <Text style={styles.eventSelectedTitle} numberOfLines={1}>
                  {selectedEvent.title}
                </Text>
                <Text style={styles.eventSelectedDate}>
                  {new Date(selectedEvent.starts_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.eventRemoveBtn}
              onPress={() => setSelectedEventId(null)}
            >
              <Ionicons name="close" size={16} color={"#9CA3AF"} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setShowEventPicker((v) => !v)}
          >
            <Ionicons name="calendar-outline" size={16} color={"#111827"} />
            <Text style={styles.secondaryBtnText}>
              {showEventPicker ? "Fermer" : "Choisir un événement"}
            </Text>
          </Pressable>
        )}

        {showEventPicker && !selectedEvent ? (
          <View style={styles.eventPicker}>
            {events.length === 0 ? (
              <Text style={styles.fieldHint}>
                Aucun événement à venir publié. Créez-en un depuis l'onglet Événements.
              </Text>
            ) : (
              events.map((event) => (
                <Pressable
                  key={event.id}
                  style={styles.eventPickerItem}
                  onPress={() => {
                    setSelectedEventId(event.id);
                    setShowEventPicker(false);
                  }}
                >
                  <Ionicons name="calendar-outline" size={15} color={"#111827"} />
                  <View style={styles.eventPickerItemText}>
                    <Text style={styles.eventPickerItemTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.eventPickerItemDate}>
                      {new Date(event.starts_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      {/* Soumettre */}
      <Pressable
        style={[styles.primaryBtn, !canSubmit ? styles.btnDisabled : null]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="send-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Publier</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F9FA" },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 48,
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  },
  header: { gap: 6 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backBtnText: { color: "#111827", fontSize: 13, fontWeight: "700" },
  pageTitle: { color: "#111827", fontSize: 26, fontWeight: "800" },
  pageSubtitle: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: { color: "#111827", fontSize: 13, fontWeight: "700" },
  fieldHint: { color: "#9CA3AF", fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#111827",
    backgroundColor: "#F3F4F6",
    fontSize: 14,
  },
  textArea: { minHeight: 140, textAlignVertical: "top" },
  photosScroll: { marginHorizontal: -4 },
  photoWrap: { position: "relative", marginHorizontal: 4 },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  photoRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#111827",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  addPhotoBtnText: { color: "#111827", fontWeight: "700", fontSize: 13 },
  eventSelected: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 12,
  },
  eventSelectedInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  eventSelectedText: { flex: 1, gap: 2 },
  eventSelectedTitle: { color: "#111827", fontSize: 14, fontWeight: "700" },
  eventSelectedDate: { color: "#111827", fontSize: 12, opacity: 0.8 },
  eventRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryBtnText: { color: "#111827", fontWeight: "700", fontSize: 13 },
  eventPicker: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    overflow: "hidden",
  },
  eventPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  eventPickerItemText: { flex: 1, gap: 2 },
  eventPickerItemTitle: { color: "#111827", fontSize: 14, fontWeight: "700" },
  eventPickerItemDate: { color: "#9CA3AF", fontSize: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});
