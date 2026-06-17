import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { isEstablishmentPreviewEnabled } from "@/constants/establishmentPreview";
import { useAuth } from "@/providers/AuthProvider";
import {
  EstablishmentEvent,
  EstablishmentSubscription,
  EventCategory,
  EventParticipant,
  fetchEventCategories,
  getBackOfficeEstablishment,
  getEventById,
  getSubscription,
  listEventParticipants,
  pickAndPrepareImage,
  updateEvent,
  uploadImage,
} from "@/services/establishment";
import { formatEventDateInput, formatEventTimeInput, parseEventDateTimeInputs } from "@/utils/eventDateTime";
import { isEstablishmentFicheComplete } from "@/utils/establishmentFiche";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type FormErrors = { category?: string; title?: string; startsAt?: string; description?: string; duration?: string };

const PHOTO_BUCKET = "establishment-media";

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
  const [event, setEvent] = useState<EstablishmentEvent | null>(null);
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const parsedStartsAt = useMemo(() => parseEventDateTimeInputs(dateText, timeText), [dateText, timeText]);

  useEffect(() => {
    if (!userId || Number.isNaN(eventId)) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null); setGateRedirecting(false); setParticipantsLoading(true);
      try {
        const establishment = await getBackOfficeEstablishment(userId);
        if (!establishment) { if (!cancelled) { setGateRedirecting(true); router.replace("/establishment/offers"); } return; }
        const sub = await getSubscription(establishment.id);
        if (!previewMode && (!sub || sub.status !== "active")) { if (!cancelled) { setGateRedirecting(true); router.replace("/establishment/offers"); } return; }
        if (!previewMode && !isEstablishmentFicheComplete(establishment)) { if (!cancelled) { setGateRedirecting(true); router.replace("/establishment/profile"); } return; }

        const [eventData, participantRows, cats] = await Promise.all([
          getEventById(eventId),
          listEventParticipants(eventId),
          fetchEventCategories().catch(() => [] as EventCategory[]),
        ]);

        if (!eventData || eventData.venue_id !== establishment.id) { if (!cancelled) setError("Événement introuvable."); return; }

        if (!cancelled) {
          const startDate = new Date(eventData.starts_at);
          setProfileId(establishment.id);
          setEvent(eventData);
          setEventCategories(cats);
          setTitle(eventData.title);
          setDescription(eventData.description ?? "");
          setDateText(formatEventDateInput(startDate));
          setTimeText(formatEventTimeInput(startDate));
          setOriginalStartsAt(startDate);
          if (eventData.ends_at) {
            const ends = new Date(eventData.ends_at);
            const diff = Math.round((ends.getTime() - startDate.getTime()) / 60000);
            setDurationMinutes(diff > 0 ? String(diff) : "");
          } else { setDurationMinutes(""); }
          setCoverUrl(eventData.cover_url ?? "");
          setIsPublished(Boolean(eventData.is_published));
          setSelectedCategoryId(eventData.category_id ?? null);
          setParticipants(participantRows);
        }
      } catch { if (!cancelled) setError("Impossible de charger l'événement."); }
      finally { if (!cancelled) { setParticipantsLoading(false); setLoading(false); } }
    };
    load();
    return () => { cancelled = true; };
  }, [eventId, previewMode, router, userId]);

  const goingCount = useMemo(() => participants.filter((p) => p.status === "going").length, [participants]);
  const interestedCount = useMemo(() => participants.filter((p) => p.status === "interested").length, [participants]);

  const handleCoverUpload = async () => {
    if (!profileId) return;
    try {
      const image = await pickAndPrepareImage({ targetWidth: 1800, quality: 0.88 });
      if (!image) return;
      setSaving(true);
      const path = `${profileId}/events/${Date.now()}.${image.extension}`;
      const url = await uploadImage({ bucket: PHOTO_BUCKET, path, uri: image.uri, contentType: image.contentType });
      setCoverUrl(url);
    } catch (err) {
      const message = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "Upload impossible.";
      setError(message);
    } finally { setSaving(false); }
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!selectedCategoryId) nextErrors.category = "Choisissez une catégorie.";
    if (title.trim().length < 3 || title.trim().length > 60) nextErrors.title = "Titre entre 3 et 60 caractères.";
    if (!parsedStartsAt) nextErrors.startsAt = "Renseigne une date JJ/MM/AAAA et une heure HH:MM valides.";
    else if (originalStartsAt) {
      const sameInstant = parsedStartsAt.getTime() === originalStartsAt.getTime();
      if (!sameInstant && parsedStartsAt.getTime() < Date.now()) nextErrors.startsAt = "La date doit être dans le futur.";
    } else if (parsedStartsAt.getTime() < Date.now()) nextErrors.startsAt = "La date doit être dans le futur.";
    if (description.trim().length > 800) nextErrors.description = "Description trop longue (800 max).";
    if (durationMinutes) { const v = Number(durationMinutes); if (Number.isNaN(v) || v <= 0) nextErrors.duration = "Durée invalide."; }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!profileId || !event) return;
    if (!validate()) return;
    setSaving(true);
    try {
      const durationValue = Number(durationMinutes);
      const endsAt = parsedStartsAt && !Number.isNaN(durationValue) && durationValue > 0
        ? new Date(parsedStartsAt.getTime() + durationValue * 60 * 1000).toISOString() : null;
      await updateEvent(event.id, { title: title.trim(), description: description.trim() || null, starts_at: parsedStartsAt!.toISOString(), ends_at: endsAt, cover_url: coverUrl || null, category_id: selectedCategoryId, is_published: isPublished });
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); router.push("/establishment/events"); }, 1200);
    } catch { setError("Impossible de mettre à jour l'événement."); } finally { setSaving(false); }
  };

  if (!userId || loading || gateRedirecting) {
    return <View style={styles.center}><ActivityIndicator color={Pastel.teal} size="large" /></View>;
  }

  if (!profileId || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Événement introuvable</Text>
        <Pressable style={styles.btnSecondary} onPress={() => router.push("/establishment/events")}>
          <Text style={styles.btnSecondaryText}>Retour aux événements</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <JovialProShell currentPath="/establishment/events" title="Modifier l'événement" subtitle={`${event.title}`}>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {saveSuccess && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={15} color="#059669" />
          <Text style={styles.successText}>Événement mis à jour avec succès !</Text>
        </View>
      )}

      {/* 1 — Catégorie */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Catégorie <Text style={styles.required}>*</Text></Text>
            <Text style={styles.cardHint}>Visible dans l'onglet Explore → Événements de l'app.</Text>
          </View>
        </View>
        <View style={styles.chipRow}>
          {eventCategories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <Pressable key={cat.id} style={[styles.chip, active && styles.chipActive]} onPress={() => setSelectedCategoryId(cat.id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.category && <Text style={styles.fieldError}>{errors.category}</Text>}
      </View>

      {/* 2 — Détails */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.badge}><Text style={styles.badgeText}>2</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Détails <Text style={styles.required}>*</Text></Text>
          </View>
        </View>
        <TextInput value={title} onChangeText={setTitle} placeholder="Titre de l'événement" placeholderTextColor={Pastel.textMuted} style={styles.input} maxLength={60} />
        {errors.title && <Text style={styles.fieldError}>{errors.title}</Text>}
        <TextInput value={description} onChangeText={setDescription} placeholder="Description (optionnelle)" placeholderTextColor={Pastel.textMuted} style={[styles.input, styles.textArea]} multiline maxLength={800} />
        <View style={styles.dateRow}>
          <TextInput value={dateText} onChangeText={setDateText} placeholder="JJ/MM/AAAA" placeholderTextColor={Pastel.textMuted} style={[styles.input, styles.dateInput]} autoCapitalize="none" />
          <TextInput value={timeText} onChangeText={setTimeText} placeholder="HH:MM" placeholderTextColor={Pastel.textMuted} style={[styles.input, styles.timeInput]} autoCapitalize="none" />
        </View>
        {errors.startsAt && <Text style={styles.fieldError}>{errors.startsAt}</Text>}
        <TextInput value={durationMinutes} onChangeText={setDurationMinutes} placeholder="Durée en minutes (ex: 120 pour 2h)" placeholderTextColor={Pastel.textMuted} style={styles.input} keyboardType="numeric" />
        {errors.duration && <Text style={styles.fieldError}>{errors.duration}</Text>}
      </View>

      {/* 3 — Photo */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: Pastel.primary }]}><Text style={styles.badgeText}>3</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Photo <Text style={styles.optional}>(optionnelle)</Text></Text>
          </View>
        </View>
        <Pressable style={styles.photoBtn} onPress={handleCoverUpload} disabled={saving}>
          <Ionicons name="image-outline" size={18} color={Pastel.teal} />
          <Text style={styles.photoBtnText}>{coverUrl ? "Changer la photo" : "Ajouter une photo"}</Text>
        </Pressable>
        {coverUrl && <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />}
      </View>

      {/* 4 — Publication */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: Pastel.primary }]}><Text style={styles.badgeText}>4</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Statut de publication</Text>
            <Text style={styles.cardHint}>Un événement publié est visible par tous les utilisateurs Jovial.</Text>
          </View>
        </View>
        <View style={styles.pubRow}>
          <Pressable style={[styles.pubCard, isPublished && styles.pubCardActive]} onPress={() => setIsPublished(true)}>
            <Ionicons name="eye-outline" size={18} color={isPublished ? Pastel.teal : Pastel.textMuted} />
            <Text style={[styles.pubLabel, isPublished && styles.pubLabelActive]}>Publié</Text>
            <Text style={styles.pubDesc}>Visible dans l'app.</Text>
          </Pressable>
          <Pressable style={[styles.pubCard, !isPublished && styles.pubCardDraft]} onPress={() => setIsPublished(false)}>
            <Ionicons name="create-outline" size={18} color={!isPublished ? Pastel.primary : Pastel.textMuted} />
            <Text style={[styles.pubLabel, !isPublished && { color: Pastel.primary }]}>Brouillon</Text>
            <Text style={styles.pubDesc}>Non visible pour l'instant.</Text>
          </Pressable>
        </View>
      </View>

      {/* 5 — Participants */}
      {!participantsLoading && participants.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}><Text style={styles.badgeText}>👥</Text></View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Participants</Text>
              <Text style={styles.cardHint}>{goingCount} participe{goingCount > 1 ? "nt" : ""} · {interestedCount} intéressé{interestedCount > 1 ? "s" : ""}</Text>
            </View>
          </View>
          <View style={styles.participantList}>
            {participants.map((p) => (
              <View key={`${p.user_id}-${p.status}`} style={styles.participantRow}>
                <Text style={styles.participantName}>{buildParticipantLabel(p)}</Text>
                <View style={[styles.participantBadge, p.status === "going" ? styles.participantBadgeGoing : styles.participantBadgeInterested]}>
                  <Text style={styles.participantBadgeText}>{p.status === "going" ? "Participe" : "Intéressé"}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Bouton enregistrer */}
      <Pressable style={[styles.btnSave, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
          <>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.btnSaveText}>Enregistrer les modifications</Text>
          </>
        )}
      </Pressable>

    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerTitle: { fontSize: 20, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  btnSecondary: { backgroundColor: Pastel.surfaceAlt, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: Pastel.border },
  btnSecondaryText: { color: Pastel.text, fontSize: 14, fontFamily: Font.semiBold, includeFontPadding: false },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, borderWidth: 1, borderColor: "#FECACA", padding: 12 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  successBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#D1FAE5", borderRadius: 12, borderWidth: 1, borderColor: "#6EE7B7", padding: 12 },
  successText: { color: "#059669", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  card: { backgroundColor: Pastel.surface, borderRadius: 22, borderWidth: 1, borderColor: Pastel.border, padding: 18, gap: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardHeaderText: { flex: 1, gap: 3 },
  cardTitle: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  cardHint: { color: Pastel.textMuted, fontSize: 12, lineHeight: 17, includeFontPadding: false },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Pastel.teal, alignItems: "center", justifyContent: "center", marginTop: 1 },
  badgeText: { color: "#FFFFFF", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  required: { color: Pastel.teal },
  optional: { color: Pastel.textMuted, fontFamily: Font.regular },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Pastel.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Pastel.surfaceAlt },
  chipActive: { backgroundColor: Pastel.tealSoft, borderColor: Pastel.teal },
  chipText: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  chipTextActive: { color: Pastel.teal, fontFamily: Font.extraBold },
  input: { backgroundColor: Pastel.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Pastel.border, minHeight: 46, paddingHorizontal: 14, paddingVertical: 11, color: Pastel.text, fontSize: 14, fontFamily: Font.regular },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  dateRow: { flexDirection: "row", gap: 10 },
  dateInput: { flex: 2 },
  timeInput: { flex: 1 },
  fieldError: { color: "#DC2626", fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, borderColor: Pastel.teal, borderStyle: "dashed", padding: 14, justifyContent: "center" },
  photoBtnText: { color: Pastel.teal, fontSize: 14, fontFamily: Font.semiBold, includeFontPadding: false },
  cover: { width: "100%", aspectRatio: 16 / 6, borderRadius: 14 },
  pubRow: { flexDirection: "row", gap: 10 },
  pubCard: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surfaceAlt, padding: 14, gap: 4, alignItems: "center" },
  pubCardActive: { borderColor: Pastel.teal, backgroundColor: Pastel.tealSoft },
  pubCardDraft: { borderColor: Pastel.primary, backgroundColor: Pastel.primarySoft },
  pubLabel: { color: Pastel.text, fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
  pubLabelActive: { color: Pastel.teal },
  pubDesc: { color: Pastel.textMuted, fontSize: 11, textAlign: "center", lineHeight: 15, includeFontPadding: false },
  participantList: { gap: 8 },
  participantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Pastel.border },
  participantName: { color: Pastel.text, fontSize: 14, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  participantBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  participantBadgeGoing: { backgroundColor: Pastel.tealSoft },
  participantBadgeInterested: { backgroundColor: Pastel.primarySoft },
  participantBadgeText: { fontSize: 11, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  btnSave: { backgroundColor: Pastel.primary, borderRadius: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnSaveText: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  btnDisabled: { opacity: 0.5 },
});
