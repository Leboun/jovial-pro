import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { isEstablishmentPreviewEnabled } from "@/constants/establishmentPreview";
import { useAuth } from "@/providers/AuthProvider";
import {
  EstablishmentSubscription,
  createEvent,
  getBackOfficeEstablishment,
  getSubscription,
  incrementEventsUsed,
  pickAndPrepareImage,
  uploadImage,
} from "@/services/establishment";
import { parseEventDateTimeInputs } from "@/utils/eventDateTime";
import { canCreateEvent, getRemainingEvents } from "@/utils/planFeatureGate";

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
  { id: 2, title: "Scène & Parole" },
  { id: 3, title: "Jeux" },
  { id: 4, title: "Gastronomie & Boissons" },
  { id: 5, title: "Société & Engagement" },
  { id: 6, title: "Numérique & Innovation" },
  { id: 7, title: "Bien-être" },
  { id: 8, title: "Inclusivité & Communautés" },
  { id: 9, title: "Festif" },
  { id: 10, title: "Sport & Retransmissions sportives" },
  { id: 11, title: "Autres" },
];

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
  const [error, setError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [dateText, setDateText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const parsedStartsAt = useMemo(
    () => parseEventDateTimeInputs(dateText, timeText),
    [dateText, timeText]
  );

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setGateRedirecting(false);
      try {
        const establishment = await getBackOfficeEstablishment(userId);
        if (!establishment) {
          if (!cancelled) {
            setGateRedirecting(true);
            router.replace("/establishment/offers");
          }
          return;
        }
        let sub = null;
        try {
          sub = await getSubscription(establishment.id);
        } catch {
          // RLS ou réseau — on continue sans quota (illimité par défaut)
        }

        if (!cancelled) {
          setProfileId(establishment.id);
          setSubscription(sub);
        }
      } catch {
        if (!cancelled) setError("Impossible de charger les données.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [previewMode, router, userId]);

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

  const remainingQuota = useMemo(() => getRemainingEvents(subscription), [subscription]);

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
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!selectedCategoryId) nextErrors.category = "Choisissez une catégorie.";
    if (title.trim().length < 3 || title.trim().length > 60) {
      nextErrors.title = "Titre entre 3 et 60 caractères.";
    }
    if (!parsedStartsAt) {
      nextErrors.startsAt = "Renseigne une date JJ/MM/AAAA et une heure HH:MM valides.";
    } else if (parsedStartsAt.getTime() < Date.now()) {
      nextErrors.startsAt = "La date doit être dans le futur.";
    }
    if (description.trim().length > 800) {
      nextErrors.description = "Description trop longue (800 max).";
    }
    if (durationMinutes) {
      const value = Number(durationMinutes);
      if (Number.isNaN(value) || value <= 0) {
        nextErrors.duration = "Durée invalide.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!profileId) return;
    if (!validate()) return;

    if (subscription && !canCreateEvent(subscription)) {
      setError(
        "Quota annuel atteint (4 événements pour l'Offre Visibilité). Passe à l'Offre Rayonnement ou Pro pour des événements illimités."
      );
      return;
    }

    setSaving(true);
    try {
      const durationValue = Number(durationMinutes);
      const endsAt =
        parsedStartsAt && !Number.isNaN(durationValue) && durationValue > 0
          ? new Date(parsedStartsAt.getTime() + durationValue * 60 * 1000).toISOString()
          : null;

      await createEvent({
        venue_id: profileId,
        title: title.trim(),
        description: description.trim() || null,
        starts_at: parsedStartsAt!.toISOString(),
        ends_at: endsAt,
        cover_url: coverUrl || null,
        category_id: selectedCategoryId,
        is_published: true,
      });

      if (subscription) {
        try { await incrementEventsUsed(profileId, subscription.events_used_year + 1); } catch { /* non-critical */ }
      }

      router.push("/establishment/events");
    } catch (err) {
      setError("Impossible de créer l'événement. Veuillez réessayer.");
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

  if (!profileId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Accès indisponible</Text>
        <Text style={styles.hint}>Vérifie ton offre et ta fiche établissement.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace("/establishment/offers")}>
          <Text style={styles.primaryText}>Voir les offres</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Créer un événement</Text>
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
          <Text style={styles.sectionTitle}>Catégorie d'événement</Text>
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
          <Text style={styles.sectionTitle}>Détails</Text>
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
            Exemple : 29/04/2026 et 19:30. La photo peut être recadrée pendant l'import.
          </Text>
          {errors.startsAt ? <Text style={styles.error}>{errors.startsAt}</Text> : null}

          <TextInput
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            placeholder="Durée (minutes)"
            placeholderTextColor={"#9CA3AF"}
            style={styles.input}
            keyboardType="numeric"
          />
          {errors.duration ? <Text style={styles.error}>{errors.duration}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo</Text>
          <Pressable style={styles.secondary} onPress={handleCoverUpload}>
            <Text style={styles.secondaryText}>Ajouter une photo</Text>
          </Pressable>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" /> : null}
        </View>


      </ScrollView>

      <View style={styles.footer}>
        {Object.keys(errors).length > 0 ? (
          <Text style={styles.footerError}>
            {errors.category ?? errors.title ?? errors.startsAt ?? errors.duration ?? errors.description}
          </Text>
        ) : null}
        {error ? <Text style={styles.footerError}>{error}</Text> : null}
        <Pressable style={styles.primary} onPress={handleSubmit} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Créer l'événement</Text>}
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
  hint: { fontSize: 12, color: "#9CA3AF" },
  error: { color: "#FCA5A5", fontSize: 12 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerError: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
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
});
