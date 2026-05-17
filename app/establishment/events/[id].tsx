import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";

import { isEstablishmentPreviewEnabled } from "@/constants/establishmentPreview";
import { useAuth } from "@/providers/AuthProvider";
import {
  EstablishmentEvent,
  EstablishmentSubscription,
  EventParticipant,
  getBackOfficeEstablishment,
  getEventById,
  getSubscription,
  listEventParticipants,
  pickAndPrepareImage,
  updateEvent,
  uploadImage,
} from "@/services/establishment";
import {
  formatEventDateInput,
  formatEventTimeInput,
  parseEventDateTimeInputs,
} from "@/utils/eventDateTime";
import { isEstablishmentFicheComplete } from "@/utils/establishmentFiche";

type FormErrors = {
  category?: string;
  title?: string;
  startsAt?: string;
  description?: string;
  duration?: string;
};

const PHOTO_BUCKET = "establishment-media";
const eventCategories = [
  { id: 1, title: "Musique" },
  { id: 2, title: "Scene & Parole" },
  { id: 3, title: "Jeux" },
  { id: 4, title: "Gastronomie & Boissons" },
  { id: 5, title: "Societe & Engagement" },
  { id: 6, title: "Numerique & Innovation" },
  { id: 7, title: "Bien-etre" },
  { id: 8, title: "Inclusivite & Communautes" },
  { id: 9, title: "Festif" },
  { id: 10, title: "Sport & Retransmissions sportives" },
  { id: 11, title: "Autres" },
];

const buildParticipantLabel = (participant: EventParticipant) => {
  const fullName = [participant.firstname, participant.lastname].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (participant.handle) return `@${participant.handle}`;
  return `Utilisateur ${participant.user_id.slice(0, 8)}`;
};

export default function EstablishmentEventEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const eventId = Number(params.id);

  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const previewMode = isEstablishmentPreviewEnabled(userId);

  const [loading, setLoading] = useState(true);
  const [gateRedirecting, setGateRedirecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<EstablishmentSubscription | null>(null);
  const [event, setEvent] = useState<EstablishmentEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [dateText, setDateText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [originalStartsAt, setOriginalStartsAt] = useState<Date | null>(null);
  const [isPublished, setIsPublished] = useState(true);
  const [coverUrl, setCoverUrl] = useState("");
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  const parsedStartsAt = useMemo(
    () => parseEventDateTimeInputs(dateText, timeText),
    [dateText, timeText]
  );

  useEffect(() => {
    if (!userId || Number.isNaN(eventId)) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setGateRedirecting(false);
      setParticipantsLoading(true);
      try {
        const establishment = await getBackOfficeEstablishment(userId);
        if (!establishment) {
          if (!cancelled) {
            setGateRedirecting(true);
            router.replace("/establishment/offers");
          }
          return;
        }
        const sub = await getSubscription(establishment.id);
        if (!previewMode && (!sub || sub.status !== "active")) {
          if (!cancelled) {
            setGateRedirecting(true);
            router.replace("/establishment/offers");
          }
          return;
        }
        if (!previewMode && !isEstablishmentFicheComplete(establishment)) {
          if (!cancelled) {
            setGateRedirecting(true);
            router.replace("/establishment/profile");
          }
          return;
        }

        const [eventData, participantRows] = await Promise.all([
          getEventById(eventId),
          listEventParticipants(eventId),
        ]);

        if (!eventData || eventData.venue_id !== establishment.id) {
          if (!cancelled) setError("Evenement introuvable.");
          return;
        }

        if (!cancelled) {
          const startDate = new Date(eventData.starts_at);
          setProfileId(establishment.id);
          setSubscription(sub);
          setEvent(eventData);
          setTitle(eventData.title);
          setDescription(eventData.description ?? "");
          setDateText(formatEventDateInput(startDate));
          setTimeText(formatEventTimeInput(startDate));
          setOriginalStartsAt(startDate);
          if (eventData.ends_at) {
            const ends = new Date(eventData.ends_at);
            const diffMinutes = Math.round((ends.getTime() - startDate.getTime()) / 60000);
            setDurationMinutes(diffMinutes > 0 ? String(diffMinutes) : "");
          } else {
            setDurationMinutes("");
          }
          setCoverUrl(eventData.cover_url ?? "");
          setIsPublished(Boolean(eventData.is_published));
          setSelectedCategoryId(eventData.category_id ?? null);
          setParticipants(participantRows);
        }
      } catch {
        if (!cancelled) setError("Impossible de charger l'evenement.");
      } finally {
        if (!cancelled) {
          setParticipantsLoading(false);
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [eventId, previewMode, router, userId]);

  const summaryText = useMemo(() => {
    const pieces: string[] = [];
    if (title.trim()) pieces.push(title.trim());
    if (parsedStartsAt) {
      pieces.push(
        parsedStartsAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      );
    }
    const durationValue = Number(durationMinutes);
    if (!Number.isNaN(durationValue) && durationValue > 0) {
      const hours = Math.floor(durationValue / 60);
      const minutes = durationValue % 60;
      if (hours > 0) pieces.push(`${hours}h${minutes ? ` ${minutes}m` : ""}`);
      else pieces.push(`${minutes}m`);
    }
    return pieces.join(" • ");
  }, [durationMinutes, parsedStartsAt, title]);

  const goingParticipants = useMemo(
    () => participants.filter((participant) => participant.status === "going"),
    [participants]
  );
  const interestedParticipants = useMemo(
    () => participants.filter((participant) => participant.status === "interested"),
    [participants]
  );

  const handleCoverUpload = async () => {
    if (!profileId) return;
    try {
      const image = await pickAndPrepareImage({ targetWidth: 1800, quality: 0.88 });
      if (!image) return;

      setSaving(true);
      const path = `${profileId}/events/${Date.now()}.${image.extension}`;
      const url = await uploadImage({
        bucket: PHOTO_BUCKET,
        path,
        uri: image.uri,
        contentType: image.contentType,
      });
      setCoverUrl(url);
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Upload impossible.";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!selectedCategoryId) nextErrors.category = "Choisissez une categorie.";
    if (title.trim().length < 3 || title.trim().length > 60) {
      nextErrors.title = "Titre entre 3 et 60 caracteres.";
    }
    if (!parsedStartsAt) {
      nextErrors.startsAt = "Renseigne une date JJ/MM/AAAA et une heure HH:MM valides.";
    } else if (originalStartsAt) {
      const sameInstant = parsedStartsAt.getTime() === originalStartsAt.getTime();
      if (!sameInstant && parsedStartsAt.getTime() < Date.now()) {
        nextErrors.startsAt = "La date doit etre dans le futur.";
      }
    } else if (parsedStartsAt.getTime() < Date.now()) {
      nextErrors.startsAt = "La date doit etre dans le futur.";
    }
    if (description.trim().length > 800) {
      nextErrors.description = "Description trop longue (800 max).";
    }
    if (durationMinutes) {
      const value = Number(durationMinutes);
      if (Number.isNaN(value) || value <= 0) {
        nextErrors.duration = "Duree invalide.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!profileId || !event) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const durationValue = Number(durationMinutes);
      const endsAt =
        parsedStartsAt && !Number.isNaN(durationValue) && durationValue > 0
          ? new Date(parsedStartsAt.getTime() + durationValue * 60 * 1000).toISOString()
          : null;

      await updateEvent(event.id, {
        title: title.trim(),
        description: description.trim() || null,
        starts_at: parsedStartsAt!.toISOString(),
        ends_at: endsAt,
        cover_url: coverUrl || null,
        category_id: selectedCategoryId,
        is_published: isPublished,
      });

      Alert.alert("OK", "Evenement mis a jour.");
      router.push("/establishment/events");
    } catch {
      Alert.alert("Erreur", "Impossible de mettre a jour.");
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.primary} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.primaryText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || gateRedirecting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#111827"} />
        {gateRedirecting ? <Text style={styles.hint}>Redirection...</Text> : null}
      </View>
    );
  }

  if (!profileId || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Evenement introuvable</Text>
        <Pressable style={styles.secondary} onPress={() => router.push("/establishment/events")}>
          <Text style={styles.secondaryText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Modifier l'evenement</Text>
          <Pressable style={styles.secondary} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Retour</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {summaryText ? (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>{summaryText}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorie d'evenement</Text>
          <View style={styles.chipRow}>
            {eventCategories.map((category) => {
              const active = selectedCategoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  style={[styles.chip, active ? styles.chipActive : null]}
                  onPress={() => setSelectedCategoryId(category.id)}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {category.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titre"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
          />
          {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description"
            placeholderTextColor={"#9CA3AF"}
            style={[styles.input, styles.textArea]}
            multiline
          />
          {errors.description ? <Text style={styles.error}>{errors.description}</Text> : null}

          <TextInput
            value={dateText}
            onChangeText={setDateText}
            placeholder="Date (JJ/MM/AAAA)"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={timeText}
            onChangeText={setTimeText}
            placeholder="Heure (HH:MM)"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            Tu peux corriger la date, l'heure, la photo et le statut de publication depuis cet ecran.
          </Text>
          {errors.startsAt ? <Text style={styles.error}>{errors.startsAt}</Text> : null}

          <TextInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            placeholder="Duree (minutes)"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            keyboardType="numeric"
          />
          {errors.duration ? <Text style={styles.error}>{errors.duration}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo</Text>
          <Pressable style={styles.secondary} onPress={handleCoverUpload}>
            <Text style={styles.secondaryText}>Changer la photo</Text>
          </Pressable>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" /> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.sectionTitle}>Publier</Text>
            <Switch value={isPublished} onValueChange={setIsPublished} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          {participantsLoading ? (
            <ActivityIndicator color={"#111827"} />
          ) : participants.length === 0 ? (
            <Text style={styles.hint}>Aucun utilisateur ne s'est encore signale sur cet evenement.</Text>
          ) : (
            <View style={styles.participantList}>
              <Text style={styles.hint}>
                {goingParticipants.length} participant(s) • {interestedParticipants.length} interesse(s)
              </Text>
              {participants.map((participant) => (
                <View key={`${participant.user_id}-${participant.status}`} style={styles.participantRow}>
                  <View style={styles.participantText}>
                    <Text style={styles.participantName}>{buildParticipantLabel(participant)}</Text>
                    <Text style={styles.participantMeta}>{participant.user_id}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      participant.status === "going" ? styles.statusOn : styles.statusOff,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {participant.status === "going" ? "Participe" : "Interesse"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.primary} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Enregistrer</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { padding: 20, paddingBottom: 120, gap: 16 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    gap: 12,
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#F3F4F6",
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  chipActive: { backgroundColor: "#FDE68A", borderColor: "#FDE68A" },
  chipText: { fontSize: 12, color: "#9CA3AF" },
  chipTextActive: { color: "#92400E", fontWeight: "700" },
  summary: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryText: { color: "#111827", fontSize: 13, fontWeight: "600" },
  cover: { width: "100%", height: 160, borderRadius: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { fontSize: 12, color: "#9CA3AF" },
  error: { color: "#FCA5A5", fontSize: 12 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  primary: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontWeight: "700" },
  secondary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryText: { color: "#111827", fontWeight: "600" },
  participantList: { gap: 10 },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  participantText: { flex: 1, gap: 2 },
  participantName: { color: "#111827", fontSize: 14, fontWeight: "700" },
  participantMeta: { color: "#9CA3AF", fontSize: 11 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusOn: { backgroundColor: "#F3F4F6" },
  statusOff: { backgroundColor: "#F3F4F6" },
  statusText: { color: "#111827", fontSize: 11, fontWeight: "700" },
});
