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
  const [bookingEnabled, setBookingEnabled] = useState(true);
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
          // Sync venues.activities so the map preview card stays up-to-date
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

  const bookingEnabledCount = useMemo(
    () => activities.filter((activity) => activity.booking_enabled).length,
    [activities]
  );
  const reservableUnitsCount = useMemo(
    () =>
      activities.reduce((total, activity) => total + Math.max(0, activity.reservable_quantity || 0), 0),
    [activities]
  );

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  const featuredCount = useMemo(
    () => activities.filter((a) => a.is_featured).length,
    [activities]
  );

  const handleToggleFeatured = useCallback(async (activity: VenueBookingActivity) => {
    if (!establishmentId) return;
    const next = !activity.is_featured;
    if (next && featuredCount >= tagsLimit) return;
    setActivities((prev) =>
      prev.map((a) => (a.id === activity.id ? { ...a, is_featured: next } : a))
    );
    try {
      await toggleActivityFeatured(activity.id, establishmentId, next);
    } catch {
      setActivities((prev) =>
        prev.map((a) => (a.id === activity.id ? { ...a, is_featured: activity.is_featured } : a))
      );
    }
  }, [establishmentId, featuredCount]);

  const formatPrice = (activity: VenueBookingActivity) => {
    if (!activity.payment_required || !activity.price_cents) return "Gratuit";
    return `${(activity.price_cents / 100).toFixed(2).replace(".", ",")} ${activity.currency}`;
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedGameId(null);
    setQuantityText("1");
    setReservableQuantityText("1");
    setBookingEnabled(true);
    setPaymentRequired(false);
    setPriceText("");
    setPickerOpen(false);
    setFormError(null);
  };

  const loadActivities = async (venueId: number) => {
    const rows = await fetchVenueBookingActivities(venueId);
    const cleanRows = rows.filter((activity): activity is VenueBookingActivity => activity != null);
    setActivities(cleanRows);
  };

  const submitForm = async () => {
    if (!establishmentId) return;
    setFormError(null);

    if (!selectedGameId) {
      setFormError("Sélectionne un type d'activité.");
      return;
    }
    const quantity = Math.max(1, Number.parseInt(quantityText, 10) || 0);
    if (!quantity) {
      setFormError("Indique un nombre d'unités supérieur ou égal à 1.");
      return;
    }
    const reservableQuantity = bookingEnabled
      ? Math.max(1, Number.parseInt(reservableQuantityText, 10) || 0)
      : 0;
    if (bookingEnabled && reservableQuantity > quantity) {
      setFormError("Le nombre réservable ne peut pas dépasser le total disponible sur place.");
      return;
    }

    const normalizedPrice = priceText.replace(",", ".").trim();
    const parsedPrice = normalizedPrice ? Number.parseFloat(normalizedPrice) : 0;
    if (paymentRequired && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setFormError("Renseigne un prix valide.");
      return;
    }

    const duplicate = activities.find(
      (item) => item.game_id === selectedGameId && (editingId == null || item.id !== editingId)
    );
    if (duplicate) {
      setFormError("Cette activité est déjà configurée. Modifie la ligne existante ou choisis une autre activité.");
      return;
    }

    try {
      setSaving(true);
      await upsertVenueBookingActivity({
        venueId: establishmentId,
        activityId: editingId,
        gameId: selectedGameId,
        quantity,
        reservableQuantity,
        bookingEnabled,
        paymentRequired,
        priceCents: Math.round((paymentRequired ? parsedPrice : 0) * 100),
      });
      await loadActivities(establishmentId);
      resetForm();
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Impossible d'enregistrer cette activité.";
      setFormError(message);
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
    setPaymentRequired(activity.payment_required);
    setPriceText(activity.payment_required ? (activity.price_cents / 100).toString().replace(".", ",") : "");
  };

  const confirmDelete = (activity: VenueBookingActivity) => {
    setConfirmDeleteId(activity.id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const targetId = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      setSaving(true);
      await deleteVenueBookingActivity(targetId);
      if (establishmentId) await loadActivities(establishmentId);
      if (editingId === targetId) resetForm();
    } catch {
      setFormError("Suppression impossible.");
    } finally {
      setSaving(false);
    }
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

  return (
    <JovialProShell
      currentPath={pathname}
      title="Activités"
      subtitle="Pilotez les activités mises en avant sur la fiche et celles qui peuvent être réservées."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
      rightSlot={
        <View style={styles.headerStats}>
          <Text style={styles.headerStatValue}>{activities.length}</Text>
          <Text style={styles.headerStatLabel}>activités configurées</Text>
        </View>
      }
    >
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Activités visibles</Text>
          <Text style={styles.summaryValue}>{activities.length}</Text>
          <Text style={styles.summaryText}>Toutes les activités actuellement configurées sur le lieu.</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Réservations actives</Text>
          <Text style={styles.summaryValue}>{bookingEnabledCount}</Text>
          <Text style={styles.summaryText}>Activités ouvertes à la réservation ou à la demande.</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Unités réservables</Text>
          <Text style={styles.summaryValue}>{reservableUnitsCount}</Text>
          <Text style={styles.summaryText}>Nombre total d'unités que les joueurs peuvent réserver dans l'app.</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editingId ? "Modifier une activité" : "Ajouter une activité"}</Text>

        <Text style={styles.fieldLabel}>Type d'activité</Text>
        <Pressable style={styles.selectField} onPress={() => setPickerOpen((current) => !current)}>
          <Text style={selectedGame ? styles.selectText : styles.selectPlaceholder}>
            {selectedGame ? selectedGame.name : "Choisir une activité"}
          </Text>
        </Pressable>
        {games.length === 0 ? (
          <Text style={styles.helperText}>
            Aucun type d'activite n'est disponible dans le catalogue Supabase pour le moment.
          </Text>
        ) : null}
        {pickerOpen ? (
          <ScrollView style={styles.dropdown} nestedScrollEnabled>
            {games.map((game) => (
              <Pressable
                key={game.id}
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedGameId(game.id);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.dropdownText}>{game.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.fieldLabel}>Nombre total disponible sur place</Text>
        <TextInput
          value={quantityText}
          onChangeText={setQuantityText}
          keyboardType="number-pad"
          placeholder="Ex: 6"
          placeholderTextColor={"#9CA3AF"}
          style={styles.input}
        />
        <Text style={styles.helperText}>
          Exemple : 6 cibles de fléchettes présentes dans l'établissement.
        </Text>

        <View style={styles.toggleRow}>
          <Text style={styles.fieldLabel}>Activité réservable depuis l'app</Text>
          <Pressable
            style={[styles.toggleButton, bookingEnabled ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setBookingEnabled((current) => !current)}
          >
            <Text style={styles.toggleText}>{bookingEnabled ? "Oui" : "Non"}</Text>
          </Pressable>
        </View>

        {bookingEnabled ? (
          <>
            <Text style={styles.fieldLabel}>Nombre réservable dans l'app</Text>
            <TextInput
              value={reservableQuantityText}
              onChangeText={setReservableQuantityText}
              keyboardType="number-pad"
              placeholder="Ex: 1"
              placeholderTextColor={"#9CA3AF"}
              style={styles.input}
            />
            <Text style={styles.helperText}>
              Exemple : 1 cible réservable sur 6, les 5 autres restent disponibles sans réservation.
            </Text>
          </>
        ) : (
          <Text style={styles.helperText}>
            L'activité apparaîtra sur la fiche, mais sans prise de réservation dans l'app.
          </Text>
        )}

        <View style={styles.toggleRow}>
          <Text style={styles.fieldLabel}>Activité payante</Text>
          <Pressable
            style={[styles.toggleButton, paymentRequired ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setPaymentRequired((current) => !current)}
          >
            <Text style={styles.toggleText}>{paymentRequired ? "Oui" : "Non"}</Text>
          </Pressable>
        </View>

        {paymentRequired ? (
          <>
            <Text style={styles.fieldLabel}>Prix de la reservation (EUR)</Text>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
              placeholder="Ex: 12,50"
              placeholderTextColor={"#9CA3AF"}
              style={styles.input}
            />
          </>
        ) : null}

        {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}
        <View style={styles.formActions}>
          <Pressable style={[styles.primaryButton, saving ? styles.buttonDisabled : null]} onPress={submitForm} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{editingId ? "Mettre à jour" : "Ajouter l'activité"}</Text>}
          </Pressable>
          {editingId ? (
            <Pressable style={styles.secondaryButton} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>Annuler</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {confirmDeleteId ? (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteConfirmText}>Supprimer cette activité ?</Text>
          <Text style={styles.deleteConfirmHint}>Elle sera retirée de la fiche et plus visible dans l'application.</Text>
          <View style={styles.deleteConfirmRow}>
            <Pressable style={styles.deleteConfirmCancel} onPress={() => setConfirmDeleteId(null)}>
              <Text style={styles.deleteConfirmCancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.deleteConfirmOk} onPress={executeDelete}>
              <Text style={styles.deleteConfirmOkText}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {activities.length > 0 ? (
        <View style={styles.featuredHint}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.featuredHintText}>
            {featuredCount}/3 activités mises en avant dans l'aperçu de la carte
          </Text>
        </View>
      ) : null}

      {activities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucune activité configurée</Text>
          <Text style={styles.emptyText}>
            Ajoutez votre première activité ci-dessus pour qu'elle apparaisse sur la fiche.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {activities.map((activity) => (
            <View key={activity.id} style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <View style={styles.activityHeaderText}>
                  <View style={styles.activityTitleRow}>
                    <Text style={styles.activityTitle}>{activity.name}</Text>
                    <Pressable
                      onPress={() => handleToggleFeatured(activity)}
                      hitSlop={10}
                      style={styles.starBtn}
                    >
                      <Ionicons
                        name={activity.is_featured ? "star" : "star-outline"}
                        size={20}
                        color={activity.is_featured ? "#F59E0B" : (!activity.is_featured && featuredCount >= tagsLimit ? "#D1D5DB" : "#9CA3AF")}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.activityMeta}>
                    {activity.quantity} unite(s) sur place |{" "}
                    {activity.booking_enabled
                      ? `${activity.reservable_quantity} réservable(s) dans l'app`
                      : "Aucune réservation en ligne"}
                  </Text>
                </View>
                <View style={[styles.badge, activity.booking_enabled ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={styles.badgeText}>
                    {activity.payment_required ? "Payant" : "Gratuit"}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tarif</Text>
                <Text style={styles.detailValue}>{formatPrice(activity)}</Text>
              </View>
              {activity.booking_enabled ? (
                <Text style={styles.noteText}>
                  {Math.max(0, activity.quantity - activity.reservable_quantity)} unité(s) restent disponibles
                  sans réservation.
                </Text>
              ) : null}
              <View style={styles.cardActions}>
                <Pressable style={styles.secondaryButton} onPress={() => startEdit(activity)}>
                  <Text style={styles.secondaryButtonText}>Modifier</Text>
                </Pressable>
                <Pressable style={styles.dangerButton} onPress={() => confirmDelete(activity)}>
                  <Text style={styles.dangerButtonText}>Supprimer</Text>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F8F9FA",
    padding: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  headerStats: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    minWidth: 120,
  },
  headerStatValue: { color: "#111827", fontSize: 24, fontWeight: "800" },
  headerStatLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  summaryCard: {
    minWidth: 260,
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 6,
  },
  summaryLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  summaryValue: { color: "#111827", fontSize: 28, fontWeight: "800" },
  summaryText: { color: "#9CA3AF", fontSize: 13, lineHeight: 19 },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 10,
  },
  formTitle: { color: "#111827", fontSize: 18, fontWeight: "800" },
  fieldLabel: { color: "#111827", fontSize: 13, fontWeight: "700" },
  selectField: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  selectText: { color: "#111827", fontSize: 14, fontWeight: "600" },
  selectPlaceholder: { color: "#9CA3AF", fontSize: 14 },
  dropdown: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownText: { color: "#111827", fontSize: 14 },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 44,
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 14,
  },
  helperText: { color: "#9CA3AF", fontSize: 12, lineHeight: 18, marginTop: -2 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  toggleButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: "#EEF2FF", borderColor: "#2B4E93" },
  toggleOff: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  toggleText: { color: "#2B4E93", fontSize: 12, fontWeight: "800" },
  formActions: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  list: { gap: 14 },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 10,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  activityHeaderText: { gap: 4, flex: 1 },
  activityTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  activityTitle: { color: "#111827", fontSize: 20, fontWeight: "800", flex: 1 },
  starBtn: { padding: 2 },
  featuredHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  featuredHintText: { color: "#92400E", fontSize: 13, fontWeight: "600", flex: 1 },
  activityMeta: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeOn: { backgroundColor: "#F3F4F6" },
  badgeOff: { backgroundColor: "#F3F4F6" },
  badgeText: { color: "#111827", fontSize: 11, fontWeight: "800" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  detailLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  detailValue: { color: "#111827", fontSize: 13, fontWeight: "700" },
  noteText: { color: "#9CA3AF", fontSize: 13, lineHeight: 19, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryButtonText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  dangerButton: {
    backgroundColor: "#FFF1F2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#FBCFE8",
  },
  dangerButtonText: { color: "#BE123C", fontSize: 12, fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 10,
  },
  emptyTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  emptyText: { color: "#9CA3AF", fontSize: 14, lineHeight: 20 },
  formErrorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteConfirm: {
    backgroundColor: "#FFF1F2",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    padding: 18,
    gap: 10,
  },
  deleteConfirmText: { color: "#BE123C", fontSize: 15, fontWeight: "800" },
  deleteConfirmHint: { color: "#BE123C", fontSize: 13, lineHeight: 18, opacity: 0.8 },
  deleteConfirmRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  deleteConfirmCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  deleteConfirmCancelText: { color: "#111827", fontSize: 14, fontWeight: "700" },
  deleteConfirmOk: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#BE123C",
  },
  deleteConfirmOkText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  primaryButton: {
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
