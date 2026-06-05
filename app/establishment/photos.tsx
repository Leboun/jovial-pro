import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
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
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const FALLBACK_IMAGE = require("../../assets/images/welcome-hero.png");
const PHOTO_BUCKET = "establishment-media";
const MAX_PHOTOS = 10;
const MIN_RECOMMENDED = 3;

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

  const progressLabel = useMemo(() => {
    if (photos.length === 0) return "Ajoute au moins 3 photos pour apparaître sur la carte Jovial.";
    if (photos.length < MIN_RECOMMENDED) return `Plus que ${MIN_RECOMMENDED - photos.length} photo${MIN_RECOMMENDED - photos.length > 1 ? "s" : ""} pour atteindre le minimum recommandé.`;
    if (photos.length < MAX_PHOTOS) return `Bonne base ! Tu peux aller jusqu'à ${MAX_PHOTOS} photos.`;
    return "Galerie complète — tous les emplacements sont utilisés.";
  }, [photos.length]);

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

  const handleUploadLogo = async () => {
    if (!profile) return;
    try {
      const image = await pickAndPrepareImage({ targetWidth: 600, quality: 0.9 });
      if (!image) return;
      setSaving(true);
      const path = `${profile.id}/logo/${Date.now()}.${image.extension}`;
      const url = await uploadImage({ bucket: PHOTO_BUCKET, path, uri: image.uri, contentType: image.contentType });
      const updated = await updateMyEstablishment(profile.id, { logo_url: url });
      if (updated) { setProfile(updated); }
      else { setProfile((current) => (current ? { ...current, logo_url: url } : current)); }
    } catch (error) {
      const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "Impossible d'ajouter le logo.";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!profile) return;
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Limite atteinte", "Tu peux ajouter jusqu'à 10 photos maximum.");
      return;
    }
    try {
      const image = await pickAndPrepareImage({ targetWidth: 1800, quality: 0.88 });
      if (!image) return;
      setSaving(true);
      const path = `${profile.id}/photos/${Date.now()}.${image.extension}`;
      const url = await uploadImage({ bucket: PHOTO_BUCKET, path, uri: image.uri, contentType: image.contentType });
      const nextPhotos = [...photos, url];
      const updated = await updateMyEstablishment(profile.id, { photos: nextPhotos, cover_url: nextPhotos[0] ?? null });
      if (updated) { setProfile(updated); } else {
        setProfile((current) => (current ? { ...current, photos: nextPhotos, cover_url: nextPhotos[0] ?? null } : current));
      }
      setPhotos(nextPhotos);
    } catch (error) {
      const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "Impossible d'ajouter cette photo.";
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
      const url = await uploadImage({ bucket: PHOTO_BUCKET, path, uri: image.uri, contentType: image.contentType });
      const nextPhotos = [...photos];
      nextPhotos[index] = url;
      await persistPhotos(nextPhotos);
    } catch (error) {
      const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "Impossible de remplacer cette photo.";
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

  const confirmDelete = async () => {
    if (!confirmDeletePhoto) return;
    const target = confirmDeletePhoto;
    setConfirmDeletePhoto(null);
    await persistPhotos(photos.filter((item) => item !== target));
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Connexion requise</Text>
        <Pressable style={styles.btnPrimary} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.btnPrimaryText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Photos"
      subtitle="Gère les visuels de ton établissement — la première photo est ta couverture principale."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
    >
      {/* Confirmation suppression */}
      {confirmDeletePhoto ? (
        <View style={styles.deleteConfirm}>
          <View style={styles.deleteConfirmLeft}>
            <Ionicons name="warning-outline" size={20} color="#BE123C" />
            <View style={styles.deleteConfirmText}>
              <Text style={styles.deleteConfirmTitle}>Supprimer cette photo ?</Text>
              <Text style={styles.deleteConfirmHint}>Elle sera retirée de la fiche et de la couverture si c'est la première.</Text>
            </View>
          </View>
          <View style={styles.deleteConfirmRow}>
            <Pressable style={styles.deleteCancel} onPress={() => setConfirmDeletePhoto(null)}>
              <Text style={styles.deleteCancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.deleteOk} onPress={confirmDelete}>
              <Text style={styles.deleteOkText}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Barre de progression */}
      <View style={styles.progressBlock}>
        <View style={styles.progressHeader}>
          <View style={styles.progressLeft}>
            <Text style={styles.progressTitle}>
              {photos.length === MAX_PHOTOS ? "✓ Galerie complète" : `${photos.length} / ${MAX_PHOTOS} photos`}
            </Text>
            <Text style={styles.progressSub}>{progressLabel}</Text>
          </View>
          <Pressable
            style={[styles.btnPrimary, (photos.length >= MAX_PHOTOS || saving) && styles.btnDisabled]}
            onPress={handleAddPhoto}
            disabled={photos.length >= MAX_PHOTOS || saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
              <View style={styles.btnInner}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>Ajouter</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {
            width: `${(photos.length / MAX_PHOTOS) * 100}%` as any,
            backgroundColor: photos.length < MIN_RECOMMENDED ? "#F59E0B" : Pastel.teal,
          }]} />
        </View>
        {photos.length < MIN_RECOMMENDED && photos.length > 0 && (
          <View style={styles.progressWarning}>
            <Ionicons name="information-circle-outline" size={14} color="#92400E" />
            <Text style={styles.progressWarningText}>3 photos minimum recommandées pour apparaître dans les résultats Jovial.</Text>
          </View>
        )}
      </View>

      {/* Logo de l'établissement */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>◎</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Logo de l'établissement</Text>
            <Text style={styles.cardHint}>Affiché en rond sur ta fiche Jovial. Idéalement carré, sur fond uni.</Text>
          </View>
        </View>
        <View style={styles.logoRow}>
          <View style={styles.logoPreview}>
            {profile?.logo_url ? (
              <Image source={{ uri: profile.logo_url }} style={styles.logoImg} contentFit="cover" />
            ) : (
              <Ionicons name="business-outline" size={28} color={Pastel.textMuted} />
            )}
          </View>
          <Pressable style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={handleUploadLogo} disabled={saving}>
            <View style={styles.btnInner}>
              <Ionicons name={profile?.logo_url ? "refresh" : "add"} size={16} color="#FFFFFF" />
              <Text style={styles.btnPrimaryText}>{profile?.logo_url ? "Remplacer le logo" : "Ajouter un logo"}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Preview couverture */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>★</Text></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Photo de couverture</Text>
            <Text style={styles.cardHint}>C'est la première image que voient les utilisateurs Jovial avant d'ouvrir ta fiche.</Text>
          </View>
        </View>
        <Image
          source={previewPhoto ? { uri: previewPhoto } : FALLBACK_IMAGE}
          style={styles.coverImage}
          contentFit="cover"
        />
        {photos.length === 0 && (
          <Pressable style={styles.emptyAddBtn} onPress={handleAddPhoto} disabled={saving}>
            <Ionicons name="image-outline" size={20} color={Pastel.teal} />
            <Text style={styles.emptyAddText}>Importer ma première photo</Text>
          </Pressable>
        )}
      </View>

      {/* Galerie */}
      {photos.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.sectionBadge, { backgroundColor: Pastel.primary }]}><Text style={styles.sectionBadgeText}>☰</Text></View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Galerie</Text>
              <Text style={styles.cardHint}>Réorganise les photos avec les flèches — la première devient automatiquement la couverture.</Text>
            </View>
          </View>

          <View style={styles.galleryGrid}>
            {photos.map((photo, index) => (
              <View key={`${photo}-${index}`} style={[styles.galleryItem, index === 0 && styles.galleryItemFirst]}>
                <View style={styles.galleryImageWrapper}>
                  <Image source={{ uri: photo }} style={styles.galleryImage} contentFit="cover" />
                  <View style={[styles.badge, index === 0 ? styles.badgeTeal : styles.badgeGray]}>
                    <Text style={styles.badgeText}>{index === 0 ? "★ Couverture" : `#${index + 1}`}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsGrid}>
                  {/* Réorganiser */}
                  <View style={styles.moveRow}>
                    <Pressable
                      style={[styles.iconBtn, index === 0 && styles.iconBtnDisabled]}
                      onPress={() => movePhoto(index, -1)}
                      disabled={index === 0 || saving}
                    >
                      <Ionicons name="arrow-back" size={15} color={index === 0 ? "#D1D5DB" : Pastel.text} />
                    </Pressable>
                    <Text style={styles.moveLabel}>Réorganiser</Text>
                    <Pressable
                      style={[styles.iconBtn, index === photos.length - 1 && styles.iconBtnDisabled]}
                      onPress={() => movePhoto(index, 1)}
                      disabled={index === photos.length - 1 || saving}
                    >
                      <Ionicons name="arrow-forward" size={15} color={index === photos.length - 1 ? "#D1D5DB" : Pastel.text} />
                    </Pressable>
                  </View>

                  {/* Mettre en couverture */}
                  {index !== 0 && (
                    <Pressable style={styles.actionBtn} onPress={() => makePreview(index)} disabled={saving}>
                      <Ionicons name="star-outline" size={14} color={Pastel.teal} />
                      <Text style={[styles.actionBtnText, { color: Pastel.teal }]}>Mettre en couverture</Text>
                    </Pressable>
                  )}

                  {/* Remplacer */}
                  <Pressable style={styles.actionBtn} onPress={() => handleReplacePhoto(index)} disabled={saving}>
                    <Ionicons name="pencil-outline" size={14} color={Pastel.text} />
                    <Text style={styles.actionBtnText}>Remplacer</Text>
                  </Pressable>

                  {/* Supprimer */}
                  <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => setConfirmDeletePhoto(photo)} disabled={saving}>
                    <Ionicons name="trash-outline" size={14} color="#BE123C" />
                    <Text style={[styles.actionBtnText, { color: "#BE123C" }]}>Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerTitle: { fontSize: 22, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },

  // Boutons
  btnPrimary: { backgroundColor: Pastel.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  btnDisabled: { opacity: 0.45 },

  // Logo
  logoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  logoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%" },

  // Progression
  progressBlock: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 18,
    gap: 10,
  },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  progressLeft: { flex: 1, gap: 3 },
  progressTitle: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  progressSub: { color: Pastel.textMuted, fontSize: 13, lineHeight: 18, includeFontPadding: false },
  progressTrack: { height: 6, backgroundColor: Pastel.border, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99 },
  progressWarning: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFFBEB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  progressWarningText: { color: "#92400E", fontSize: 12, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },

  // Card
  card: { backgroundColor: Pastel.surface, borderRadius: 24, borderWidth: 1, borderColor: Pastel.border, padding: 18, gap: 14 },
  cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardHeaderText: { flex: 1, gap: 3 },
  cardTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  cardHint: { color: Pastel.textMuted, fontSize: 13, lineHeight: 18, includeFontPadding: false },

  // Section badge
  sectionBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Pastel.teal, alignItems: "center", justifyContent: "center", marginTop: 1 },
  sectionBadgeText: { color: "#FFFFFF", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },

  // Cover
  coverImage: { width: "100%", aspectRatio: 16 / 6, borderRadius: 16, backgroundColor: Pastel.surfaceAlt },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: Pastel.teal, borderStyle: "dashed" },
  emptyAddText: { color: Pastel.teal, fontSize: 14, fontFamily: Font.semiBold, includeFontPadding: false },

  // Galerie
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  galleryItem: { width: 240, backgroundColor: Pastel.surfaceSoft, borderRadius: 18, padding: 12, gap: 10, borderWidth: 1, borderColor: Pastel.border },
  galleryItemFirst: { borderColor: Pastel.teal, borderWidth: 2 },
  galleryImageWrapper: { position: "relative" },
  galleryImage: { width: "100%", aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: Pastel.surfaceAlt },
  badge: { position: "absolute", top: 8, left: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTeal: { backgroundColor: Pastel.teal },
  badgeGray: { backgroundColor: "rgba(0,0,0,0.45)" },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },

  // Actions galerie
  actionsGrid: { gap: 7 },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  moveLabel: { flex: 1, color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Pastel.surface, borderWidth: 1, borderColor: Pastel.border },
  iconBtnDisabled: { opacity: 0.3 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: Pastel.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Pastel.border },
  actionBtnText: { color: Pastel.text, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  actionBtnDanger: { borderColor: "#FBCFE8", backgroundColor: "#FFF1F2" },

  // Suppression
  deleteConfirm: { backgroundColor: "#FFF1F2", borderRadius: 18, borderWidth: 1, borderColor: "#FBCFE8", padding: 16, gap: 12 },
  deleteConfirmLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  deleteConfirmText: { flex: 1, gap: 3 },
  deleteConfirmTitle: { color: "#BE123C", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  deleteConfirmHint: { color: "#BE123C", fontSize: 13, lineHeight: 18, opacity: 0.8, includeFontPadding: false },
  deleteConfirmRow: { flexDirection: "row", gap: 10 },
  deleteCancel: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surface },
  deleteCancelText: { color: Pastel.text, fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  deleteOk: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: "#BE123C" },
  deleteOkText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
});
