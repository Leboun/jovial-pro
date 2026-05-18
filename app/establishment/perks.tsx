import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import {
  PERK_FREQUENCY_LABELS,
  PerkFrequency,
  VenuePerk,
  deleteVenuePerk,
  fetchRecentRedemptions,
  fetchVenuePerks,
  toggleVenuePerkActive,
  upsertVenuePerk,
} from "@/services/perks";
import { ensureEstablishmentFeatureAccess } from "@/utils/establishmentProGate";

const PERK_FREQUENCIES: PerkFrequency[] = ["per_visit", "weekly", "biweekly", "monthly"];

function formatRedemptionDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EstablishmentPerksScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [establishmentId, setEstablishmentId] = useState<number | null>(null);
  const [perks, setPerks] = useState<VenuePerk[]>([]);
  const [redemptions, setRedemptions] = useState<Awaited<ReturnType<typeof fetchRecentRedemptions>>>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState<PerkFrequency>("weekly");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const activeCount = useMemo(() => perks.filter((p) => p.is_active).length, [perks]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const gate = await ensureEstablishmentFeatureAccess({ userId, replace: (href) => router.replace(href as never) });
          if (!gate.ok || !gate.venueId) { if (!cancelled) setEstablishmentId(null); return; }
          const [rows, recent] = await Promise.all([fetchVenuePerks(gate.venueId), fetchRecentRedemptions(gate.venueId)]);
          if (!cancelled) { setPerks(rows); setRedemptions(recent); setEstablishmentId(gate.venueId); }
        } catch {
          if (!cancelled) setEstablishmentId(null);
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
      if (!gate.ok || !gate.venueId) return;
      const [rows, recent] = await Promise.all([fetchVenuePerks(gate.venueId), fetchRecentRedemptions(gate.venueId)]);
      setPerks(rows); setRedemptions(recent); setEstablishmentId(gate.venueId);
    } catch { /* ignore */ } finally {
      setRefreshing(false);
    }
  }, [router, userId]);

  const reload = async (venueId: number) => {
    const [rows, recent] = await Promise.all([
      fetchVenuePerks(venueId),
      fetchRecentRedemptions(venueId),
    ]);
    setPerks(rows);
    setRedemptions(recent);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setSelectedFrequency("weekly");
    setIsActive(true);
    setFormError(null);
  };

  const startEdit = (perk: VenuePerk) => {
    setEditingId(perk.id);
    setTitle(perk.title);
    setDescription(perk.description ?? "");
    setSelectedFrequency(perk.frequency);
    setIsActive(perk.is_active);
    setFormError(null);
  };

  const submitForm = async () => {
    if (!establishmentId) return;
    setFormError(null);

    if (title.trim().length < 3 || title.trim().length > 60) {
      setFormError("Le titre doit faire entre 3 et 60 caractères.");
      return;
    }
    if (description.trim().length > 200) {
      setFormError("La description ne peut pas dépasser 200 caractères.");
      return;
    }

    try {
      setSaving(true);
      await upsertVenuePerk({
        perkId: editingId,
        venueId: establishmentId,
        title: title.trim(),
        description: description.trim() || null,
        frequency: selectedFrequency,
        isActive,
      });
      await reload(establishmentId);
      resetForm();
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Impossible d'enregistrer cet avantage.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (perk: VenuePerk) => {
    if (!establishmentId) return;
    try {
      await toggleVenuePerkActive(perk.id, !perk.is_active);
      await reload(establishmentId);
    } catch {
      setFormError("Impossible de modifier l'état de cet avantage.");
    }
  };

  const executeDelete = async () => {
    if (!confirmDeleteId || !establishmentId) return;
    const targetId = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      setSaving(true);
      await deleteVenuePerk(targetId);
      await reload(establishmentId);
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
      title="Avantages Premium"
      subtitle="Offre des avantages exclusifs aux utilisateurs Jovial Premium pour les fidéliser et les attirer dans ton établissement."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      rightSlot={
        <View style={styles.headerStats}>
          <Text style={styles.headerStatValue}>{activeCount}</Text>
          <Text style={styles.headerStatLabel}>avantage(s) actif(s)</Text>
        </View>
      }
    >
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          ✨ Ces avantages sont visibles par tous les utilisateurs de l'app, mais seuls les abonnés Jovial Premium peuvent les utiliser — un levier puissant pour convertir et fidéliser vos clients
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editingId ? "Modifier un avantage" : "Ajouter un avantage"}</Text>

        <Text style={styles.fieldLabel}>Avantage exclusif Jovial Premium</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex : 1 bière offerte, -10% sur l'addition, accès prioritaire…"
          placeholderTextColor={"#9CA3AF"}
          style={styles.input}
          maxLength={60}
        />
        <Text style={styles.helperText}>{title.trim().length}/60 caractères</Text>

        <Text style={styles.fieldLabel}>Précisions (optionnel)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Ex : valable sur toute la carte, hors boissons spéciales…"
          placeholderTextColor={"#9CA3AF"}
          style={[styles.input, styles.textArea]}
          multiline
          maxLength={200}
        />

        <Text style={styles.fieldLabel}>Fréquence d'utilisation</Text>
        <View style={styles.chipRow}>
          {PERK_FREQUENCIES.map((freq) => {
            const active = selectedFrequency === freq;
            return (
              <Pressable
                key={freq}
                style={[styles.chip, active ? styles.chipActive : null]}
                onPress={() => setSelectedFrequency(freq)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                  {PERK_FREQUENCY_LABELS[freq]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.fieldLabel}>Avantage actif</Text>
          <Pressable
            style={[styles.toggleButton, isActive ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setIsActive((v) => !v)}
          >
            <Text style={styles.toggleText}>{isActive ? "Actif" : "Inactif"}</Text>
          </Pressable>
        </View>

        {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

        <View style={styles.formActions}>
          <Pressable
            style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
            onPress={submitForm}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {editingId ? "Mettre à jour" : "Ajouter l'avantage"}
              </Text>
            )}
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
          <Text style={styles.deleteConfirmText}>Supprimer cet avantage ?</Text>
          <Text style={styles.deleteConfirmHint}>
            Il ne sera plus visible dans l'application. L'historique des utilisations est conservé.
          </Text>
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

      {perks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucun avantage configuré</Text>
          <Text style={styles.emptyText}>
            Crée ton premier avantage ci-dessus pour le rendre visible sur ta fiche dans l'application.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {perks.map((perk) => (
            <View key={perk.id} style={[styles.perkCard, !perk.is_active ? styles.perkCardInactive : null]}>
              <View style={styles.perkHeader}>
                <View style={styles.perkHeaderText}>
                  <Text style={styles.perkIcon}>✨</Text>
                  <View style={styles.perkTitleBlock}>
                    <Text style={styles.perkTitle}>{perk.title}</Text>
                    <Text style={styles.perkMeta}>{PERK_FREQUENCY_LABELS[perk.frequency]}</Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.statusBadge, perk.is_active ? styles.statusOn : styles.statusOff]}
                  onPress={() => handleToggleActive(perk)}
                >
                  <Text style={styles.statusText}>{perk.is_active ? "Actif" : "Inactif"}</Text>
                </Pressable>
              </View>

              {perk.description ? (
                <Text style={styles.perkDescription}>{perk.description}</Text>
              ) : null}

              <View style={styles.cardActions}>
                <Pressable style={styles.secondaryButton} onPress={() => startEdit(perk)}>
                  <Text style={styles.secondaryButtonText}>Modifier</Text>
                </Pressable>
                <Pressable style={styles.dangerButton} onPress={() => setConfirmDeleteId(perk.id)}>
                  <Text style={styles.dangerButtonText}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {redemptions.length > 0 ? (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Dernières utilisations</Text>
          {redemptions.map((r) => (
            <View key={r.id} style={styles.historyRow}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyPerkName}>
                  {PERK_TYPE_ICONS[r.perk_type]} {r.perk_title}
                </Text>
                <Text style={styles.historyDate}>{formatRedemptionDate(r.redeemed_at)}</Text>
              </View>
              <View style={[styles.historyBadge, r.status === "validated" ? styles.historyBadgeOk : styles.historyBadgePending]}>
                <Text style={styles.historyBadgeText}>
                  {r.status === "validated" ? "Validé" : "En attente"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
  headerStatLabel: { color: "#9CA3AF", fontSize: 11, fontWeight: "700", textAlign: "center" },
  infoBanner: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
  },
  infoBannerText: { color: "#9A3412", fontSize: 13, lineHeight: 19 },
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
  chipText: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  chipTextActive: { color: "#92400E", fontWeight: "700" },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 14,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  helperText: { color: "#9CA3AF", fontSize: 12, marginTop: -4 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  toggleButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  toggleOn: { backgroundColor: "#EEF2FF", borderColor: "#2B4E93" },
  toggleOff: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  toggleText: { color: "#2B4E93", fontSize: 12, fontWeight: "800" },
  formActions: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  formErrorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  list: { gap: 14 },
  perkCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 10,
  },
  perkCardInactive: { opacity: 0.6 },
  perkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  perkHeaderText: { flexDirection: "row", gap: 12, flex: 1, alignItems: "flex-start" },
  perkIcon: { fontSize: 24 },
  perkTitleBlock: { gap: 4, flex: 1 },
  perkTitle: { color: "#111827", fontSize: 17, fontWeight: "800" },
  perkMeta: { color: "#9CA3AF", fontSize: 12, lineHeight: 17 },
  perkDescription: { color: "#9CA3AF", fontSize: 13, lineHeight: 19 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusOn: { backgroundColor: "#F3F4F6" },
  statusOff: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  statusText: { color: "#111827", fontSize: 11, fontWeight: "800" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
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
  deleteConfirmOk: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: "#BE123C" },
  deleteConfirmOkText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    gap: 12,
  },
  historyTitle: { color: "#111827", fontSize: 16, fontWeight: "800" },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  historyLeft: { gap: 2, flex: 1 },
  historyPerkName: { color: "#111827", fontSize: 13, fontWeight: "700" },
  historyDate: { color: "#9CA3AF", fontSize: 12 },
  historyBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  historyBadgeOk: { backgroundColor: "#D1FAE5" },
  historyBadgePending: { backgroundColor: "#F3F4F6" },
  historyBadgeText: { fontSize: 11, fontWeight: "700", color: "#111827" },
  primaryButton: {
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
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
});
