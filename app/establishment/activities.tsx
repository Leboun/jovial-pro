import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import { useEstablishment } from "@/providers/EstablishmentProvider";
import {
  deleteVenueBookingActivity,
  fetchGamesCatalog,
  fetchVenueBookingActivities,
  syncVenueActivitiesSummary,
  GameOption,
  toggleActivityFeatured,
  upsertVenueBookingActivity,
  VenueBookingActivity,
} from "@/services/bookings";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";
import { getPlanCapabilities } from "@/utils/planFeatureGate";
import { invalidateExploreCache } from "@/services/exploreCache";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

export default function EstablishmentActivitiesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { venue, subscription } = useEstablishment();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [establishmentId, setEstablishmentId] = useState<number | null>(null);
  const [activities, setActivities] = useState<VenueBookingActivity[]>([]);
  const [games, setGames] = useState<GameOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [quantityText, setQuantityText] = useState("1");
  const [reservableQuantityText, setReservableQuantityText] = useState("1");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [bookingMode, setBookingMode] = useState<"none" | "jovial" | "external">("none");
  const [bookingUrl, setBookingUrl] = useState("");
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [tagsLimit, setTagsLimit] = useState(3);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !venue) return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
          if (!gate.ok || !gate.venueId) {
            if (!cancelled) { setActivities([]); setGames([]); setEstablishmentId(null); }
            return;
          }
          const [rows, allGames] = await Promise.all([fetchVenueBookingActivities(gate.venueId), fetchGamesCatalog()]);
          syncVenueActivitiesSummary(gate.venueId).catch(() => null);
          const cleanRows = rows.filter((a): a is VenueBookingActivity => a != null);
          const caps = getPlanCapabilities(subscription?.plan);
          if (!cancelled) { setActivities(cleanRows); setGames(allGames); setEstablishmentId(gate.venueId); setTagsLimit(caps?.tagsLimit ?? 3); }
        } catch {
          if (!cancelled) { setActivities([]); setGames([]); setEstablishmentId(null); }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [router, userId, venue, subscription])
  );

  const handleRefresh = useCallback(async () => {
    if (!userId || !venue) return;
    setRefreshing(true);
    try {
      const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
      if (!gate.ok || !gate.venueId) return;
      const [rows, allGames] = await Promise.all([fetchVenueBookingActivities(gate.venueId), fetchGamesCatalog()]);
      setActivities(rows.filter((a): a is VenueBookingActivity => a != null));
      setGames(allGames);
      setEstablishmentId(gate.venueId);
      setTagsLimit(getPlanCapabilities(subscription?.plan)?.tagsLimit ?? 3);
    } catch { /* ignore */ } finally {
      setRefreshing(false);
    }
  }, [router, userId, venue, subscription]);

  const bookingEnabledCount = useMemo(() => activities.filter((a) => a.booking_enabled).length, [activities]);
  const reservableUnitsCount = useMemo(() => activities.reduce((t, a) => t + Math.max(0, a.reservable_quantity || 0), 0), [activities]);
  const featuredCount = useMemo(() => activities.filter((a) => a.is_featured).length, [activities]);
  const selectedGame = useMemo(() => games.find((g) => g.id === selectedGameId) ?? null, [games, selectedGameId]);

  const formatPrice = (activity: VenueBookingActivity) => {
    if (!activity.payment_required || !activity.price_cents) return "Gratuit";
    return `${(activity.price_cents / 100).toFixed(2).replace(".", ",")} €`;
  };

  const handleToggleFeatured = useCallback(async (activity: VenueBookingActivity) => {
    if (!establishmentId) return;
    const next = !activity.is_featured;
    if (next && featuredCount >= tagsLimit) return;
    setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, is_featured: next } : a)));
    try {
      await toggleActivityFeatured(activity.id, establishmentId, next);
      invalidateExploreCache();
    } catch {
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, is_featured: activity.is_featured } : a)));
    }
  }, [establishmentId, featuredCount, tagsLimit]);

  const resetForm = () => {
    setEditingId(null); setSelectedGameId(null); setQuantityText("1");
    setReservableQuantityText("1"); setBookingEnabled(false); setBookingMode("none");
    setBookingUrl(""); setPaymentRequired(false);
    setPriceText(""); setPickerOpen(false); setFormError(null);
  };

  const loadActivities = async (venueId: number) => {
    const rows = await fetchVenueBookingActivities(venueId);
    setActivities(rows.filter((a): a is VenueBookingActivity => a != null));
  };

  const submitForm = async () => {
    if (!establishmentId) return;
    setFormError(null);
    if (!selectedGameId) { setFormError("Sélectionne un type d'activité."); return; }
    const quantity = Math.max(1, Number.parseInt(quantityText, 10) || 0);
    if (!quantity) { setFormError("Indique un nombre d'unités supérieur ou égal à 1."); return; }
    const reservableQuantity = bookingEnabled ? Math.max(1, Number.parseInt(reservableQuantityText, 10) || 0) : 0;
    if (bookingEnabled && reservableQuantity > quantity) { setFormError("Le nombre réservable ne peut pas dépasser le total disponible sur place."); return; }
    if (bookingMode === "external" && !bookingUrl.trim()) { setFormError("Renseigne l'URL de ton site de réservation."); return; }
    const normalizedPrice = priceText.replace(",", ".").trim();
    const parsedPrice = normalizedPrice ? Number.parseFloat(normalizedPrice) : 0;
    if (paymentRequired && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) { setFormError("Renseigne un prix valide."); return; }
    const duplicate = activities.find((item) => item.game_id === selectedGameId && (editingId == null || item.id !== editingId));
    if (duplicate) { setFormError("Cette activité est déjà configurée. Modifie la ligne existante."); return; }
    try {
      setSaving(true);
      await upsertVenueBookingActivity({ venueId: establishmentId, activityId: editingId, gameId: selectedGameId, quantity, reservableQuantity, bookingEnabled, bookingMode, bookingUrl: bookingUrl.trim() || null, paymentRequired, priceCents: Math.round((paymentRequired ? parsedPrice : 0) * 100) });
      invalidateExploreCache();
      await loadActivities(establishmentId);
      resetForm();
    } catch (err) {
      setFormError(typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "Impossible d'enregistrer cette activité.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (activity: VenueBookingActivity) => {
    setEditingId(activity.id);
    setSelectedGameId(activity.game_id);
    setQuantityText(String(Math.max(1, activity.quantity || 1)));
    setReservableQuantityText(String(Math.max(0, activity.reservable_quantity || 0)));
    setBookingEnabled(activity.booking_enabled);
    setBookingMode(activity.booking_mode ?? (activity.booking_enabled ? "jovial" : "none"));
    setBookingUrl(activity.booking_url ?? "");
    setPaymentRequired(activity.payment_required);
    setPriceText(activity.payment_required ? (activity.price_cents / 100).toString().replace(".", ",") : "");
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const targetId = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      setSaving(true);
      await deleteVenueBookingActivity(targetId);
      invalidateExploreCache();
      if (establishmentId) await loadActivities(establishmentId);
      if (editingId === targetId) resetForm();
    } catch { setFormError("Suppression impossible."); } finally { setSaving(false); }
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
      title="Activités"
      subtitle="Configure les activités visibles sur ta fiche et celles que les utilisateurs peuvent réserver."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
    >
      {/* Métriques */}
      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{activities.length}</Text>
          <Text style={styles.metricLabel}>Activité{activities.length > 1 ? "s" : ""} configurée{activities.length > 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: Pastel.teal }]}>{bookingEnabledCount}</Text>
          <Text style={styles.metricLabel}>Réservable{bookingEnabledCount > 1 ? "s" : ""} en ligne</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: Pastel.primary }]}>{featuredCount}/{tagsLimit}</Text>
          <Text style={styles.metricLabel}>Mises en avant</Text>
        </View>
      </View>

      {/* Info mise en avant */}
      {activities.length > 0 && (
        <View style={styles.infoBar}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.infoBarText}>
            Les activités ⭐ sont affichées en priorité sur ta fiche dans l'app Jovial ({featuredCount}/{tagsLimit} emplacements utilisés).
          </Text>
        </View>
      )}

      {/* Confirmation suppression */}
      {confirmDeleteId ? (
        <View style={styles.deleteCard}>
          <View style={styles.deleteCardLeft}>
            <Ionicons name="warning-outline" size={20} color="#BE123C" />
            <View style={styles.deleteCardText}>
              <Text style={styles.deleteCardTitle}>Supprimer cette activité ?</Text>
              <Text style={styles.deleteCardHint}>Elle sera retirée de la fiche et plus visible dans l'app.</Text>
            </View>
          </View>
          <View style={styles.deleteCardRow}>
            <Pressable style={styles.deleteCancelBtn} onPress={() => setConfirmDeleteId(null)}>
              <Text style={styles.deleteCancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.deleteOkBtn} onPress={executeDelete}>
              <Text style={styles.deleteOkText}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Formulaire */}
      <View style={styles.formCard}>
        <View style={styles.formTitleRow}>
          <View style={styles.sectionBadge}>
            <Ionicons name={editingId ? "pencil" : "add"} size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.formTitle}>{editingId ? "Modifier l'activité" : "Ajouter une activité"}</Text>
        </View>

        {/* Étape 1 — Type */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>1 · Quelle activité ?</Text>
          <Pressable style={styles.selectField} onPress={() => setPickerOpen((v) => !v)}>
            <Text style={selectedGame ? styles.selectText : styles.selectPlaceholder}>
              {selectedGame ? selectedGame.name : "Choisir dans le catalogue..."}
            </Text>
            <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={16} color={Pastel.textMuted} />
          </Pressable>
          {pickerOpen && (
            <ScrollView style={styles.dropdown} nestedScrollEnabled>
              {games.map((game) => (
                <Pressable key={game.id} style={[styles.dropdownItem, game.id === selectedGameId && styles.dropdownItemActive]}
                  onPress={() => { setSelectedGameId(game.id); setPickerOpen(false); }}>
                  <Text style={[styles.dropdownText, game.id === selectedGameId && styles.dropdownTextActive]}>{game.name}</Text>
                  {game.id === selectedGameId && <Ionicons name="checkmark" size={14} color={Pastel.teal} />}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Étape 2 — Quantité */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>2 · Combien d'unités sur place ?</Text>
          <TextInput
            value={quantityText}
            onChangeText={setQuantityText}
            keyboardType="number-pad"
            placeholder="Ex: 6"
            placeholderTextColor={Pastel.textMuted}
            style={styles.input}
          />
          <Text style={styles.stepHint}>Ex: 6 cibles de fléchettes présentes dans ton établissement.</Text>
        </View>

        {/* Étape 3 — Réservation */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>3 · Mode de réservation</Text>
          <View style={styles.optionCards}>
            <Pressable
              style={[styles.optionCard, bookingMode === "none" && styles.optionCardActive]}
              onPress={() => { setBookingMode("none"); setBookingEnabled(false); }}
            >
              <Ionicons name="eye-outline" size={20} color={bookingMode === "none" ? Pastel.primary : Pastel.textMuted} />
              <Text style={[styles.optionCardTitle, bookingMode === "none" && styles.optionCardTitleActive]}>Visible uniquement</Text>
              <Text style={styles.optionCardDesc}>Affiché sur la fiche, sans réservation.</Text>
            </Pressable>
            <Pressable
              style={[styles.optionCard, bookingMode === "jovial" && styles.optionCardActiveTeal]}
              onPress={() => { setBookingMode("jovial"); setBookingEnabled(true); }}
            >
              <Ionicons name="calendar-outline" size={20} color={bookingMode === "jovial" ? Pastel.teal : Pastel.textMuted} />
              <Text style={[styles.optionCardTitle, bookingMode === "jovial" && styles.optionCardTitleTeal]}>Via Jovial</Text>
              <Text style={styles.optionCardDesc}>Réservation directement dans l'app Jovial.</Text>
            </Pressable>
            <Pressable
              style={[styles.optionCard, bookingMode === "external" && styles.optionCardActive]}
              onPress={() => { setBookingMode("external"); setBookingEnabled(true); }}
            >
              <Ionicons name="link-outline" size={20} color={bookingMode === "external" ? Pastel.primary : Pastel.textMuted} />
              <Text style={[styles.optionCardTitle, bookingMode === "external" && styles.optionCardTitleActive]}>Mon site web</Text>
              <Text style={styles.optionCardDesc}>Redirige vers ton propre système de résa.</Text>
            </Pressable>
          </View>

          {bookingMode === "jovial" && (
            <View style={styles.subField}>
              <Text style={styles.subFieldLabel}>Unités réservables (sur les {quantityText || "?"} disponibles)</Text>
              <TextInput
                value={reservableQuantityText}
                onChangeText={setReservableQuantityText}
                keyboardType="number-pad"
                placeholder="Ex: 1"
                placeholderTextColor={Pastel.textMuted}
                style={styles.input}
              />
              <Text style={styles.stepHint}>Ex: 1 réservable sur 6 — les 5 autres restent en accès libre.</Text>
            </View>
          )}

          {bookingMode === "external" && (
            <View style={styles.subField}>
              <Text style={styles.subFieldLabel}>URL de ton site de réservation</Text>
              <TextInput
                value={bookingUrl}
                onChangeText={setBookingUrl}
                placeholder="https://monsite.fr/reservation"
                placeholderTextColor={Pastel.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.stepHint}>En cliquant sur "Réserver" dans l'app, l'utilisateur sera redirigé vers cette URL.</Text>
            </View>
          )}
        </View>

        {/* Étape 4 — Tarification */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>4 · Tarification</Text>
          <View style={styles.optionCards}>
            <Pressable
              style={[styles.optionCard, !paymentRequired && styles.optionCardActive]}
              onPress={() => setPaymentRequired(false)}
            >
              <Ionicons name="gift-outline" size={20} color={!paymentRequired ? Pastel.primary : Pastel.textMuted} />
              <Text style={[styles.optionCardTitle, !paymentRequired && styles.optionCardTitleActive]}>Gratuit</Text>
              <Text style={styles.optionCardDesc}>Aucun paiement requis pour accéder à l'activité.</Text>
            </Pressable>
            <Pressable
              style={[styles.optionCard, paymentRequired && styles.optionCardActive]}
              onPress={() => setPaymentRequired(true)}
            >
              <Ionicons name="card-outline" size={20} color={paymentRequired ? Pastel.primary : Pastel.textMuted} />
              <Text style={[styles.optionCardTitle, paymentRequired && styles.optionCardTitleActive]}>Payant</Text>
              <Text style={styles.optionCardDesc}>Un tarif est demandé à la réservation.</Text>
            </Pressable>
          </View>

          {paymentRequired && (
            <View style={styles.subField}>
              <Text style={styles.subFieldLabel}>Prix en euros (ex: 12,50)</Text>
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={Pastel.textMuted}
                style={styles.input}
              />
            </View>
          )}
        </View>

        {formError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.formActions}>
          <Pressable style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={submitForm} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
              <Text style={styles.btnPrimaryText}>{editingId ? "Mettre à jour" : "Ajouter l'activité"}</Text>
            )}
          </Pressable>
          {editingId && (
            <Pressable style={styles.btnSecondary} onPress={resetForm}>
              <Text style={styles.btnSecondaryText}>Annuler</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Liste des activités */}
      {activities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="game-controller-outline" size={32} color={Pastel.teal} />
          <Text style={styles.emptyTitle}>Aucune activité configurée</Text>
          <Text style={styles.emptyHint}>Ajoute ta première activité via le formulaire ci-dessus pour qu'elle apparaisse sur ta fiche Jovial.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {activities.map((activity) => (
            <View key={activity.id} style={[styles.activityCard, activity.is_featured && styles.activityCardFeatured]}>
              <View style={styles.activityTop}>
                <View style={styles.activityTopLeft}>
                  <Text style={styles.activityName}>{activity.name}</Text>
                  <View style={styles.activityBadges}>
                    {activity.booking_enabled ? (
                      <View style={styles.badgeTeal}>
                        <Text style={styles.badgeTealText}>Réservable</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeGray}>
                        <Text style={styles.badgeGrayText}>Visible uniquement</Text>
                      </View>
                    )}
                    <View style={activity.payment_required ? styles.badgeBlue : styles.badgeGray}>
                      <Text style={activity.payment_required ? styles.badgeBlueText : styles.badgeGrayText}>
                        {formatPrice(activity)}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  style={[styles.starBtn, activity.is_featured && styles.starBtnActive]}
                  onPress={() => handleToggleFeatured(activity)}
                  hitSlop={10}
                >
                  <Ionicons
                    name={activity.is_featured ? "star" : "star-outline"}
                    size={18}
                    color={activity.is_featured ? "#F59E0B" : (!activity.is_featured && featuredCount >= tagsLimit ? "#D1D5DB" : Pastel.textMuted)}
                  />
                </Pressable>
              </View>

              <View style={styles.activityDetails}>
                <View style={styles.activityDetail}>
                  <Ionicons name="layers-outline" size={13} color={Pastel.textMuted} />
                  <Text style={styles.activityDetailText}>{activity.quantity} unité{activity.quantity > 1 ? "s" : ""} sur place</Text>
                </View>
                {activity.booking_mode === "jovial" && (
                  <View style={styles.activityDetail}>
                    <Ionicons name="calendar-outline" size={13} color={Pastel.teal} />
                    <Text style={[styles.activityDetailText, { color: Pastel.teal }]}>
                      {activity.reservable_quantity} réservable{activity.reservable_quantity > 1 ? "s" : ""} via Jovial · {Math.max(0, activity.quantity - activity.reservable_quantity)} en accès libre
                    </Text>
                  </View>
                )}
                {activity.booking_mode === "external" && activity.booking_url && (
                  <View style={styles.activityDetail}>
                    <Ionicons name="link-outline" size={13} color={Pastel.primary} />
                    <Text style={[styles.activityDetailText, { color: Pastel.primary }]} numberOfLines={1}>
                      Résa externe → {activity.booking_url}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.activityActions}>
                <Pressable style={styles.btnSecondary} onPress={() => startEdit(activity)}>
                  <Ionicons name="pencil-outline" size={13} color={Pastel.text} />
                  <Text style={styles.btnSecondaryText}>Modifier</Text>
                </Pressable>
                <Pressable style={styles.btnDanger} onPress={() => setConfirmDeleteId(activity.id)}>
                  <Ionicons name="trash-outline" size={13} color="#BE123C" />
                  <Text style={styles.btnDangerText}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerTitle: { fontSize: 22, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },

  // Boutons
  btnPrimary: { backgroundColor: Pastel.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  btnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Pastel.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Pastel.border },
  btnSecondaryText: { color: Pastel.text, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  btnDanger: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF1F2", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#FBCFE8" },
  btnDangerText: { color: "#BE123C", fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  btnDisabled: { opacity: 0.5 },

  // Métriques
  metrics: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  metricCard: { flex: 1, minWidth: 120, backgroundColor: Pastel.surface, borderRadius: 18, borderWidth: 1, borderColor: Pastel.border, padding: 16, gap: 4, alignItems: "center" },
  metricValue: { color: Pastel.primary, fontSize: 28, fontFamily: Font.display, includeFontPadding: false },
  metricLabel: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },

  // Info bar
  infoBar: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 14, borderWidth: 1, borderColor: "#FDE68A", padding: 12 },
  infoBarText: { color: "#92400E", fontSize: 13, fontFamily: Font.semiBold, flex: 1, lineHeight: 18, includeFontPadding: false },

  // Formulaire
  formCard: { backgroundColor: Pastel.surface, borderRadius: 24, borderWidth: 1, borderColor: Pastel.border, padding: 20, gap: 20 },
  formTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Pastel.teal, alignItems: "center", justifyContent: "center" },
  formTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  formStep: { gap: 10 },
  stepLabel: { color: Pastel.text, fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  stepHint: { color: Pastel.textMuted, fontSize: 12, lineHeight: 17, includeFontPadding: false },
  subField: { gap: 8, backgroundColor: Pastel.surfaceSoft, borderRadius: 14, padding: 12 },
  subFieldLabel: { color: Pastel.text, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },

  // Sélecteur
  selectField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Pastel.surfaceAlt, borderRadius: 14, borderWidth: 1, borderColor: Pastel.border, minHeight: 46, paddingHorizontal: 14 },
  selectText: { color: Pastel.text, fontSize: 14, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  selectPlaceholder: { color: Pastel.textMuted, fontSize: 14, flex: 1, includeFontPadding: false },
  dropdown: { maxHeight: 180, borderWidth: 1, borderColor: Pastel.border, borderRadius: 14, backgroundColor: Pastel.surface },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Pastel.border },
  dropdownItemActive: { backgroundColor: Pastel.tealSoft },
  dropdownText: { color: Pastel.text, fontSize: 14, fontFamily: Font.regular, includeFontPadding: false },
  dropdownTextActive: { color: Pastel.teal, fontFamily: Font.semiBold },

  // Input
  input: { backgroundColor: Pastel.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Pastel.border, minHeight: 46, paddingHorizontal: 14, color: Pastel.text, fontSize: 14, fontFamily: Font.regular },

  // Option cards (réservation / tarif)
  optionCards: { flexDirection: "row", gap: 10 },
  optionCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surfaceAlt, padding: 14, gap: 6, alignItems: "flex-start" },
  optionCardActive: { borderColor: Pastel.primary, backgroundColor: Pastel.primarySoft },
  optionCardActiveTeal: { borderColor: Pastel.teal, backgroundColor: Pastel.tealSoft },
  optionCardTitle: { color: Pastel.text, fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
  optionCardTitleActive: { color: Pastel.primary },
  optionCardTitleTeal: { color: Pastel.teal },
  optionCardDesc: { color: Pastel.textMuted, fontSize: 11, lineHeight: 15, includeFontPadding: false },

  // Erreur
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, borderWidth: 1, borderColor: "#FECACA", padding: 12 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },

  // Actions formulaire
  formActions: { flexDirection: "row", gap: 10, alignItems: "center" },

  // Liste activités
  list: { gap: 12 },
  activityCard: { backgroundColor: Pastel.surface, borderRadius: 20, borderWidth: 1, borderColor: Pastel.border, padding: 16, gap: 12 },
  activityCardFeatured: { borderColor: "#F59E0B", borderWidth: 2, backgroundColor: "#FFFDF0" },
  activityTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  activityTopLeft: { flex: 1, gap: 8 },
  activityName: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  activityBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badgeTeal: { backgroundColor: Pastel.tealSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Pastel.teal },
  badgeTealText: { color: Pastel.teal, fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  badgeBlue: { backgroundColor: Pastel.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Pastel.primary },
  badgeBlueText: { color: Pastel.primary, fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  badgeGray: { backgroundColor: Pastel.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Pastel.border },
  badgeGrayText: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  activityDetails: { gap: 6 },
  activityDetail: { flexDirection: "row", alignItems: "center", gap: 6 },
  activityDetailText: { color: Pastel.textMuted, fontSize: 13, fontFamily: Font.regular, includeFontPadding: false },
  activityActions: { flexDirection: "row", gap: 8 },
  starBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Pastel.surfaceAlt, borderWidth: 1, borderColor: Pastel.border },
  starBtnActive: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },

  // Vide
  emptyCard: { backgroundColor: Pastel.surface, borderRadius: 24, borderWidth: 1, borderColor: Pastel.border, padding: 28, gap: 10, alignItems: "center" },
  emptyTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  emptyHint: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", includeFontPadding: false },

  // Suppression
  deleteCard: { backgroundColor: "#FFF1F2", borderRadius: 18, borderWidth: 1, borderColor: "#FBCFE8", padding: 16, gap: 12 },
  deleteCardLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  deleteCardText: { flex: 1, gap: 3 },
  deleteCardTitle: { color: "#BE123C", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  deleteCardHint: { color: "#BE123C", fontSize: 13, lineHeight: 18, opacity: 0.8, includeFontPadding: false },
  deleteCardRow: { flexDirection: "row", gap: 10 },
  deleteCancelBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surface },
  deleteCancelText: { color: Pastel.text, fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  deleteOkBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: "#BE123C" },
  deleteOkText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
});
