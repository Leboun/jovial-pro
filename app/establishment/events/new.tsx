import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { isEstablishmentPreviewEnabled } from "@/constants/establishmentPreview";
import { useAuth } from "@/providers/AuthProvider";
import {
  EstablishmentSubscription,
  EventCategory,
  createEvent,
  fetchEventCategories,
  getBackOfficeEstablishment,
  getSubscription,
  incrementEventsUsed,
  pickAndPrepareImage,
  uploadImage,
} from "@/services/establishment";
import { parseEventDateTimeInputs } from "@/utils/eventDateTime";
import { canCreateEvent, getRemainingEvents } from "@/utils/planFeatureGate";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type FormErrors = { category?: string; title?: string; startsAt?: string; description?: string; duration?: string };

const PHOTO_BUCKET = "establishment-media";

export default function EstablishmentEventCreateScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const previewMode = isEstablishmentPreviewEnabled(userId);

  const [loading, setLoading] = useState(true);
  const [gateRedirecting, setGateRedirecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<EstablishmentSubscription | null>(null);
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [dateText, setDateText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const parsedStartsAt = useMemo(() => parseEventDateTimeInputs(dateText, timeText), [dateText, timeText]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const establishment = await getBackOfficeEstablishment(userId);
        if (!establishment) {
          if (!cancelled) { setGateRedirecting(true); router.replace("/establishment/offers"); }
          return;
        }
        let sub = null;
        try { sub = await getSubscription(establishment.id); } catch { /* continue */ }
        const cats = await fetchEventCategories().catch(() => [] as EventCategory[]);
        if (!cancelled) { setProfileId(establishment.id); setSubscription(sub); setEventCategories(cats); }
      } catch {
        if (!cancelled) setError("Impossible de charger les données.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [previewMode, router, userId]);

  const remainingQuota = useMemo(() => getRemainingEvents(subscription), [subscription]);

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
    else if (parsedStartsAt.getTime() < Date.now()) nextErrors.startsAt = "La date doit être dans le futur.";
    if (description.trim().length > 800) nextErrors.description = "Description trop longue (800 max).";
    if (durationMinutes) {
      const value = Number(durationMinutes);
      if (Number.isNaN(value) || value <= 0) nextErrors.duration = "Durée invalide.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!profileId) return;
    if (!validate()) return;
    if (subscription && !canCreateEvent(subscription)) {
      setError("Quota annuel atteint. Passe à l'Offre Rayonnement ou Pro pour des événements illimités.");
      return;
    }
    setSaving(true);
    try {
      const durationValue = Number(durationMinutes);
      const endsAt = parsedStartsAt && !Number.isNaN(durationValue) && durationValue > 0
        ? new Date(parsedStartsAt.getTime() + durationValue * 60 * 1000).toISOString() : null;
      await createEvent({ venue_id: profileId, title: title.trim(), description: description.trim() || null, starts_at: parsedStartsAt!.toISOString(), ends_at: endsAt, cover_url: coverUrl || null, category_id: selectedCategoryId, is_published: true });
      if (subscription) {
        try { await incrementEventsUsed(profileId, subscription.events_used_year + 1); } catch { /* non-critical */ }
      }
      router.push("/establishment/events");
    } catch { setError("Impossible de créer l'événement. Veuillez réessayer."); } finally { setSaving(false); }
  };

  if (!userId || loading || gateRedirecting) {
    return <View style={styles.center}><ActivityIndicator color={Pastel.teal} size="large" /></View>;
  }

  if (!profileId) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Accès indisponible</Text>
        <Pressable style={styles.btnPrimary} onPress={() => router.replace("/establishment/offers")}>
          <Text style={styles.btnPrimaryText}>Voir les offres</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <JovialProShell currentPath="/establishment/events/new" title="Créer un événement" subtitle={remainingQuota !== null ? `Il te reste ${remainingQuota} événement${remainingQuota > 1 ? "s" : ""} dans ton quota annuel.` : undefined}>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Résumé live */}
      {(title.trim() || parsedStartsAt) && (
        <View style={styles.summaryCard}>
          <Ionicons name="eye-outline" size={14} color={Pastel.teal} />
          <Text style={styles.summaryText}>
            {[title.trim(), parsedStartsAt?.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), parsedStartsAt?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")}
          </Text>
        </View>
      )}

      {/* 1 — Catégorie */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Catégorie <Text style={styles.required}>*</Text></Text>
            <Text style={styles.cardHint}>Choisissez la catégorie qui correspond à votre événement — elle permet aux utilisateurs de le trouver dans Explore.</Text>
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
            <Text style={styles.cardHint}>Titre, description et date de l'événement.</Text>
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
            <Text style={styles.cardHint}>Une belle photo augmente l'engagement sur l'événement.</Text>
          </View>
        </View>
        <Pressable style={styles.photoBtn} onPress={handleCoverUpload} disabled={saving}>
          <Ionicons name="image-outline" size={18} color={Pastel.teal} />
          <Text style={styles.photoBtnText}>{coverUrl ? "Changer la photo" : "Ajouter une photo"}</Text>
        </Pressable>
        {coverUrl && <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />}
      </View>

      {/* Bouton créer */}
      <Pressable style={[styles.btnCreate, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
          <>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.btnCreateText}>Créer l'événement</Text>
          </>
        )}
      </Pressable>

    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerTitle: { fontSize: 20, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  btnPrimary: { backgroundColor: Pastel.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, borderWidth: 1, borderColor: "#FECACA", padding: 12 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Pastel.tealSoft, borderRadius: 14, borderWidth: 1, borderColor: Pastel.teal, padding: 12 },
  summaryText: { color: Pastel.teal, fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
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
  btnCreate: { backgroundColor: Pastel.primary, borderRadius: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnCreateText: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  btnDisabled: { opacity: 0.5 },
});
