import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import {
  EstablishmentProfile,
  getMyEstablishment,
  pickAndPrepareImage,
  updateMyEstablishment,
  uploadImage,
} from "@/services/establishment";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";

const FALLBACK_IMAGE = require("../../assets/images/welcome-hero.png");
const PHOTO_BUCKET = "establishment-media";
const MAX_PHOTOS = 10;

export default function EstablishmentPhotosScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<EstablishmentProfile | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
          if (!gate.ok) { if (!cancelled) { setProfile(null); setPhotos([]); } return; }
          const establishment = await getMyEstablishment(userId);
          if (!cancelled) {
            setProfile(establishment);
            setPhotos((establishment?.photos?.filter(Boolean) ?? []).slice(0, MAX_PHOTOS));
          }
        } catch {
          if (!cancelled) { setProfile(null); setPhotos([]); }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [router, userId])
  );

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
      if (!gate.ok) return;
      const establishment = await getMyEstablishment(userId);
      setProfile(establishment);
      setPhotos((establishment?.photos?.filter(Boolean) ?? []).slice(0, MAX_PHOTOS));
    } catch { /* ignore */ } finally {
      setRefreshing(false);
    }
  }, [router, userId]);

  const previewPhoto = useMemo(() => photos[0] ?? profile?.cover_url ?? null, [photos, profile?.cover_url]);

  const persistPhotos = async (nextPhotos: string[]) => {
    if (!profile) return;
    setSaving(true);
    try {
      const cleanPhotos = nextPhotos.filter(Boolean).slice(0, MAX_PHOTOS);
      const updated = await updateMyEstablishment(profile.id, {
        photos: cleanPhotos,
        cover_url: cleanPhotos[0] ?? null,
      });
      if (updated) {
        setProfile(updated);
      } else {
        setProfile((current) => (current ? { ...current, photos: cleanPhotos, cover_url: cleanPhotos[0] ?? null } : current));
      }
      setPhotos(cleanPhotos);
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer la galerie.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!profile) return;
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Limite atteinte", "Vous pouvez ajouter jusqu'à 10 photos maximum.");
      return;
    }

    try {
      const image = await pickAndPrepareImage({ targetWidth: 1800, quality: 0.88 });
      if (!image) return;

      setSaving(true);
      const path = `${profile.id}/photos/${Date.now()}.${image.extension}`;
      const url = await uploadImage({
        bucket: PHOTO_BUCKET,
        path,
        uri: image.uri,
        contentType: image.contentType,
      });
      const nextPhotos = [...photos, url];
      const updated = await updateMyEstablishment(profile.id, {
        photos: nextPhotos,
        cover_url: nextPhotos[0] ?? null,
      });
      if (updated) {
        setProfile(updated);
      } else {
        setProfile((current) => (current ? { ...current, photos: nextPhotos, cover_url: nextPhotos[0] ?? null } : current));
      }
      setPhotos(nextPhotos);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "Impossible d'ajouter cette photo.";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  const handleReplacePhoto = async (index: number) => {
    if (!profile || index < 0 || index >= photos.length) return;

    try {
      const image = await pickAndPrepareImage({ targetWidth: 1800, quality: 0.88 });
      if (!image) return;

      setSaving(true);
      const path = `${profile.id}/photos/${Date.now()}-${index}.${image.extension}`;
      const url = await uploadImage({
        bucket: PHOTO_BUCKET,
        path,
        uri: image.uri,
        contentType: image.contentType,
      });

      const nextPhotos = [...photos];
      nextPhotos[index] = url;
      await persistPhotos(nextPhotos);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "Impossible de remplacer cette photo.";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  const movePhoto = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= photos.length) return;
    const nextPhotos = [...photos];
    [nextPhotos[index], nextPhotos[targetIndex]] = [nextPhotos[targetIndex], nextPhotos[index]];
    await persistPhotos(nextPhotos);
  };

  const makePreview = async (index: number) => {
    if (index <= 0) return;
    const nextPhotos = [...photos];
    const [selected] = nextPhotos.splice(index, 1);
    nextPhotos.unshift(selected);
    await persistPhotos(nextPhotos);
  };

  const removePhoto = (photo: string) => {
    setConfirmDeletePhoto(photo);
  };

  const confirmDelete = async () => {
    if (!confirmDeletePhoto) return;
    const target = confirmDeletePhoto;
    setConfirmDeletePhoto(null);
    await persistPhotos(photos.filter((item) => item !== target));
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.primaryButtonText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#2B4E93"} />
      </View>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Photos"
      subtitle="Ajoutez jusqu'à 10 photos, organisez leur ordre et choisissez la preview en mettant la photo voulue en première position."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      rightSlot={
        <View style={styles.counterCard}>
          <Text style={styles.counterValue}>{photos.length}/{MAX_PHOTOS}</Text>
          <Text style={styles.counterLabel}>photos utilisées</Text>
        </View>
      }
    >
      {confirmDeletePhoto ? (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteConfirmText}>Supprimer cette photo ?</Text>
          <Text style={styles.deleteConfirmHint}>Elle sera retirée de la fiche et de la preview si elle est en première position.</Text>
          <View style={styles.deleteConfirmRow}>
            <Pressable style={styles.deleteConfirmCancel} onPress={() => setConfirmDeletePhoto(null)}>
              <Text style={styles.deleteConfirmCancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.deleteConfirmOk} onPress={confirmDelete}>
              <Text style={styles.deleteConfirmOkText}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroText}>
            <Text style={styles.cardTitle}>Photo de preview</Text>
            <Text style={styles.cardText}>
              La première photo de la liste est celle qui sera utilisée avant l'ouverture de la fiche et comme couverture principale.
              Chaque import ouvre aussi l'outil de recadrage du téléphone.
            </Text>
          </View>
          <Pressable
            style={[styles.primaryButton, photos.length >= MAX_PHOTOS || saving ? styles.buttonDisabled : null]}
            onPress={handleAddPhoto}
            disabled={photos.length >= MAX_PHOTOS || saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Ajouter une photo</Text>}
          </Pressable>
        </View>

        <Image
          source={previewPhoto ? { uri: previewPhoto } : FALLBACK_IMAGE}
          style={styles.coverImage}
          contentFit="cover"
        />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Galerie</Text>
          <Text style={styles.counterText}>{photos.length} visuel(x)</Text>
        </View>

        {photos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.cardText}>
              Aucune photo pour le moment. Commence par importer les visuels du lieu.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handleAddPhoto} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Importer ma première photo</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.galleryGrid}>
            {photos.map((photo, index) => (
              <View key={`${photo}-${index}`} style={styles.galleryItem}>
                <Image source={{ uri: photo }} style={styles.galleryImage} contentFit="cover" />

                <View style={styles.galleryMeta}>
                  <View style={styles.galleryMetaText}>
                    <Text style={styles.galleryLabel}>{index === 0 ? "Preview actuelle" : `Photo ${index + 1}`}</Text>
                    <Text style={styles.galleryHint}>
                      {index === 0 ? "Visible avant l'ouverture de la fiche" : "Réorganisable"}
                    </Text>
                  </View>
                  <View style={[styles.previewBadge, index === 0 ? styles.previewBadgeActive : null]}>
                    <Text style={[styles.previewBadgeText, index === 0 ? styles.previewBadgeTextActive : null]}>
                      #{index + 1}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.iconButton, index === 0 ? styles.iconButtonDisabled : null]}
                    onPress={() => movePhoto(index, -1)}
                    disabled={index === 0 || saving}
                  >
                    <Ionicons name="arrow-back" size={16} color={index === 0 ? "#9CA3AF" : "#111827"} />
                  </Pressable>
                  <Pressable
                    style={[styles.iconButton, index === photos.length - 1 ? styles.iconButtonDisabled : null]}
                    onPress={() => movePhoto(index, 1)}
                    disabled={index === photos.length - 1 || saving}
                  >
                    <Ionicons name="arrow-forward" size={16} color={index === photos.length - 1 ? "#9CA3AF" : "#111827"} />
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryButton, saving ? styles.buttonDisabled : null]}
                    onPress={() => handleReplacePhoto(index)}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryButtonText}>Recadrer / remplacer</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryButton, index === 0 ? styles.buttonDisabled : null]}
                    onPress={() => makePreview(index)}
                    disabled={index === 0 || saving}
                  >
                    <Text style={styles.secondaryButtonText}>Mettre en preview</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dangerButton, saving ? styles.buttonDisabled : null]}
                    onPress={() => removePhoto(photo)}
                    disabled={saving}
                  >
                    <Text style={styles.dangerButtonText}>Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F8F9FA",
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 14,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
  },
  heroText: { flex: 1, minWidth: 260, gap: 6 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  cardTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  cardText: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  counterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    minWidth: 116,
  },
  counterValue: { color: "#111827", fontSize: 22, fontWeight: "800" },
  counterLabel: { color: "#9CA3AF", fontSize: 11, fontWeight: "700", textAlign: "center" },
  counterText: { color: "#111827", fontSize: 12, fontWeight: "800" },
  coverImage: {
    width: "100%",
    aspectRatio: 16 / 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  emptyState: { gap: 12, alignItems: "flex-start" },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  galleryItem: {
    width: 300,
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  galleryImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  galleryMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  galleryMetaText: { flex: 1, gap: 2 },
  galleryLabel: { color: "#111827", fontSize: 13, fontWeight: "800" },
  galleryHint: { color: "#9CA3AF", fontSize: 12, lineHeight: 17 },
  previewBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  previewBadgeActive: {
    backgroundColor: "#2B4E93",
    borderColor: "#2B4E93",
  },
  previewBadgeText: { color: "#111827", fontSize: 11, fontWeight: "800" },
  previewBadgeTextActive: { color: "#FFFFFF" },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  iconButtonDisabled: { opacity: 0.45 },
  primaryButton: {
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryButtonText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  dangerButton: {
    backgroundColor: "#FFF1F2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FBCFE8",
  },
  dangerButtonText: { color: "#BE123C", fontSize: 12, fontWeight: "700" },
  buttonDisabled: { opacity: 0.5 },
  deleteConfirm: {
    backgroundColor: "#FFF1F2",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    padding: 18,
    gap: 10,
  },
  deleteConfirmText: {
    color: "#BE123C",
    fontSize: 15,
    fontWeight: "800",
  },
  deleteConfirmHint: {
    color: "#BE123C",
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  deleteConfirmRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  deleteConfirmCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  deleteConfirmCancelText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteConfirmOk: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#BE123C",
  },
  deleteConfirmOkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
