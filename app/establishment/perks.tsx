import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

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
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const PERK_FREQUENCIES: PerkFrequency[] = ["per_visit", "weekly", "biweekly", "monthly"];

const FREQUENCY_HINTS: Record<PerkFrequency, string> = {
  per_visit: "L'utilisateur peut en profiter à chaque visite.",
  weekly: "Une fois par semaine — idéal pour fidéliser les habitués.",
  biweekly: "Toutes les 2 semaines — bon équilibre fréquence/générosité.",
  monthly: "Une fois par mois — parfait pour un avantage généreux.",
};

function formatRedemptionDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
  const totalRedemptions = redemptions.length;

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
    } catch { /* ignore */ } finally { setRefreshing(false); }
  }, [router, userId]);

  const reload = async (venueId: number) => {
    const [rows, recent] = await Promise.all([fetchVenuePerks(venueId), fetchRecentRedemptions(venueId)]);
    setPerks(rows); setRedemptions(recent);
  };

  const resetForm = () => {
    setEditingId(null); setTitle(""); setDescription("");
    setSelectedFrequency("weekly"); setIsActive(true); setFormError(null);
  };

  const startEdit = (perk: VenuePerk) => {
    setEditingId(perk.id); setTitle(perk.title);
    setDescription(perk.description ?? ""); setSelectedFrequency(perk.frequency);
    setIsActive(perk.is_active); setFormError(null);
  };

  const submitForm = async () => {
    if (!establishmentId) return;
    setFormError(null);
    if (title.trim().length < 3 || title.trim().length > 60) { setFormError("Le titre doit faire entre 3 et 60 caractères."); return; }
    if (description.trim().length > 200) { setFormError("La description ne peut pas dépasser 200 caractères."); return; }
    try {
      setSaving(true);
      await upsertVenuePerk({ perkId: editingId, venueId: establishmentId, title: title.trim(), description: description.trim() || null, frequency: selectedFrequency, isActive });
      await reload(establishmentId);
      resetForm();
    } catch (err) {
      setFormError(typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "Impossible d'enregistrer cet avantage.");
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (perk: VenuePerk) => {
    if (!establishmentId) return;
    try { await toggleVenuePerkActive(perk.id, !perk.is_active); await reload(establishmentId); }
    catch { setFormError("Impossible de modifier l'état de cet avantage."); }
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
      title="Avantages Premium"
      subtitle="Des offres exclusives pour les membres Jovial Premium — ton meilleur levier pour attirer et fidéliser."
      onRefresh={handleRefresh}
      refreshing={refreshing}
      loading={loading}
    >
      {/* Règle obligatoire — toujours visible */}
      <View style={[styles.obligatoryCard, activeCount > 0 ? styles.obligatoryCardOk : styles.obligatoryCardKo]}>
        <View style={styles.obligatoryLeft}>
          <Ionicons
            name={activeCount > 0 ? "checkmark-circle" : "close-circle"}
            size={28}
            color={activeCount > 0 ? Pastel.teal : "#BE123C"}
          />
          <View style={styles.obligatoryText}>
            <Text style={[styles.obligatoryTitle, activeCount === 0 && styles.obligatoryTitleKo]}>
              {activeCount > 0
                ? "✓ Ton établissement est visible sur l'app"
                : "⛔ Ton établissement n'apparaît pas sur l'app"}
            </Text>
            <Text style={styles.obligatoryDesc}>
              {activeCount > 0
                ? `Tu as ${activeCount} avantage${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}. Continue à les rendre attractifs pour fidéliser tes clients.`
                : "Un avantage Premium actif est obligatoire pour apparaître sur la carte Jovial. Sans lui, les utilisateurs ne peuvent pas te trouver."}
            </Text>
          </View>
        </View>
        {activeCount === 0 && (
          <View style={styles.obligatoryBadge}>
            <Text style={styles.obligatoryBadgeText}>OBLIGATOIRE</Text>
          </View>
        )}
      </View>

      {/* Bloc motivationnel */}
      <View style={styles.motivCard}>
        <View style={styles.motivHeader}>
          <Text style={styles.motivTitle}>Pourquoi proposer un avantage attractif ?</Text>
        </View>
        <View style={styles.motivPoints}>
          <View style={styles.motivPoint}>
            <View style={styles.motivDot} />
            <Text style={styles.motivText}><Text style={styles.motivBold}>Plus de visibilité</Text> — ton établissement est mis en avant pour les membres Jovial Premium de ta zone.</Text>
          </View>
          <View style={styles.motivPoint}>
            <View style={styles.motivDot} />
            <Text style={styles.motivText}><Text style={styles.motivBold}>Plus de fidélité</Text> — un avantage généreux donne envie de revenir régulièrement.</Text>
          </View>
          <View style={styles.motivPoint}>
            <View style={styles.motivDot} />
            <Text style={styles.motivText}><Text style={styles.motivBold}>Nouveaux clients</Text> — les Premium cherchent activement des lieux avec des avantages. Sois visible.</Text>
          </View>
        </View>
        <View style={styles.motivExamples}>
          <Text style={styles.motivExamplesLabel}>Exemples qui fonctionnent bien</Text>
          <Text style={styles.motivExampleChip}>🍺 1 bière offerte</Text>
          <Text style={styles.motivExampleChip}>🎯 Partie gratuite</Text>
          <Text style={styles.motivExampleChip}>💳 -10% sur l'addition</Text>
          <Text style={styles.motivExampleChip}>🥂 Accès prioritaire vendredi soir</Text>
        </View>
      </View>

      {/* Métriques */}
      <View style={styles.metrics}>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, activeCount === 0 ? { color: Pastel.danger } : { color: Pastel.teal }]}>{activeCount}</Text>
          <Text style={styles.metricLabel}>Avantage{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: Pastel.primary }]}>{perks.length}</Text>
          <Text style={styles.metricLabel}>Au total</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: totalRedemptions > 0 ? Pastel.success : Pastel.textMuted }]}>{totalRedemptions}</Text>
          <Text style={styles.metricLabel}>Utilisations récentes</Text>
        </View>
      </View>


      {/* Formulaire */}
      <View style={styles.formCard}>
        <View style={styles.formTitleRow}>
          <View style={styles.sectionBadge}>
            <Ionicons name={editingId ? "pencil" : "add"} size={14} color="#FFFFFF" />
          </View>
          <Text style={styles.formTitle}>{editingId ? "Modifier l'avantage" : "Créer un avantage"}</Text>
        </View>

        {/* Titre */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>Quel est l'avantage ? <Text style={styles.required}>*</Text></Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex : 1 bière offerte, -10% sur l'addition, partie gratuite…"
            placeholderTextColor={Pastel.textMuted}
            style={styles.input}
            maxLength={60}
          />
          <Text style={[styles.stepHint, title.trim().length >= 50 ? { color: "#F59E0B" } : {}]}>
            {title.trim().length}/60 caractères — sois concis et percutant.
          </Text>
        </View>

        {/* Description */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>Précisions <Text style={styles.optional}>(optionnel)</Text></Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ex : valable sur toute la carte, hors boissons spéciales, sur présentation de l'app…"
            placeholderTextColor={Pastel.textMuted}
            style={[styles.input, styles.textArea]}
            multiline
            maxLength={200}
          />
        </View>

        {/* Fréquence */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>À quelle fréquence ?</Text>
          <View style={styles.freqGrid}>
            {PERK_FREQUENCIES.map((freq) => {
              const active = selectedFrequency === freq;
              return (
                <Pressable
                  key={freq}
                  style={[styles.freqCard, active && styles.freqCardActive]}
                  onPress={() => setSelectedFrequency(freq)}
                >
                  <Text style={[styles.freqLabel, active && styles.freqLabelActive]}>{PERK_FREQUENCY_LABELS[freq]}</Text>
                  <Text style={styles.freqHint}>{FREQUENCY_HINTS[freq]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Statut */}
        <View style={styles.formStep}>
          <Text style={styles.stepLabel}>Statut</Text>
          <View style={styles.statusRow}>
            <Pressable style={[styles.statusCard, isActive && styles.statusCardActive]} onPress={() => setIsActive(true)}>
              <Ionicons name="checkmark-circle-outline" size={18} color={isActive ? Pastel.teal : Pastel.textMuted} />
              <Text style={[styles.statusCardLabel, isActive && styles.statusCardLabelActive]}>Actif</Text>
              <Text style={styles.statusCardDesc}>Visible dans l'app immédiatement.</Text>
            </Pressable>
            <Pressable style={[styles.statusCard, !isActive && styles.statusCardInactive]} onPress={() => setIsActive(false)}>
              <Ionicons name="pause-circle-outline" size={18} color={!isActive ? "#6B7280" : Pastel.textMuted} />
              <Text style={[styles.statusCardLabel, !isActive && { color: "#6B7280" }]}>Inactif</Text>
              <Text style={styles.statusCardDesc}>Sauvegardé mais non visible.</Text>
            </Pressable>
          </View>
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
              <Text style={styles.btnPrimaryText}>{editingId ? "Mettre à jour" : "Ajouter l'avantage"}</Text>
            )}
          </Pressable>
          {editingId && (
            <Pressable style={styles.btnSecondary} onPress={resetForm}>
              <Text style={styles.btnSecondaryText}>Annuler</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Liste des avantages */}
      {perks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>Aucun avantage configuré</Text>
          <Text style={styles.emptyHint}>Crée ton premier avantage ci-dessus. Plus il est attractif, plus il attire de membres Premium Jovial dans ton établissement.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {perks.map((perk) => (
            <View key={perk.id} style={[styles.perkCard, !perk.is_active && styles.perkCardInactive, perk.is_active && styles.perkCardActive]}>
              <View style={styles.perkTop}>
                <View style={styles.perkTopLeft}>
                  <Text style={styles.perkEmoji}>✨</Text>
                  <View style={styles.perkInfo}>
                    <Text style={styles.perkTitle}>{perk.title}</Text>
                    <View style={styles.perkMeta}>
                      <Ionicons name="time-outline" size={12} color={Pastel.textMuted} />
                      <Text style={styles.perkMetaText}>{PERK_FREQUENCY_LABELS[perk.frequency]}</Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  style={[styles.toggleBadge, perk.is_active ? styles.toggleBadgeOn : styles.toggleBadgeOff]}
                  onPress={() => handleToggleActive(perk)}
                >
                  <Text style={[styles.toggleBadgeText, perk.is_active ? styles.toggleBadgeTextOn : styles.toggleBadgeTextOff]}>
                    {perk.is_active ? "Actif" : "Inactif"}
                  </Text>
                </Pressable>
              </View>

              {perk.description ? (
                <Text style={styles.perkDescription}>{perk.description}</Text>
              ) : null}

              {confirmDeleteId === perk.id ? (
                <View style={styles.deleteInline}>
                  <Text style={styles.deleteInlineTitle}>Supprimer cet avantage ?</Text>
                  <Text style={styles.deleteInlineHint}>Il ne sera plus visible. L'historique est conservé.</Text>
                  <View style={styles.deleteCardRow}>
                    <Pressable style={styles.deleteCancelBtn} onPress={() => setConfirmDeleteId(null)}>
                      <Text style={styles.deleteCancelText}>Annuler</Text>
                    </Pressable>
                    <Pressable style={styles.deleteOkBtn} onPress={executeDelete}>
                      <Text style={styles.deleteOkText}>Supprimer</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.perkActions}>
                  <Pressable style={styles.btnSecondary} onPress={() => startEdit(perk)}>
                    <Ionicons name="pencil-outline" size={13} color={Pastel.text} />
                    <Text style={styles.btnSecondaryText}>Modifier</Text>
                  </Pressable>
                  <Pressable style={styles.btnDanger} onPress={() => setConfirmDeleteId(perk.id)}>
                    <Ionicons name="trash-outline" size={13} color="#BE123C" />
                    <Text style={styles.btnDangerText}>Supprimer</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Historique */}
      {redemptions.length > 0 && (
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Ionicons name="receipt-outline" size={16} color={Pastel.teal} />
            <Text style={styles.historyTitle}>Dernières utilisations</Text>
          </View>
          {redemptions.map((r) => (
            <View key={r.id} style={styles.historyRow}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyPerkName}>✨ {r.perk_title}</Text>
                <Text style={styles.historyDate}>{formatRedemptionDate(r.redeemed_at)}</Text>
              </View>
              <View style={[styles.historyBadge, r.status === "validated" ? styles.historyBadgeOk : styles.historyBadgePending]}>
                <Text style={styles.historyBadgeText}>{r.status === "validated" ? "Validé" : "En attente"}</Text>
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

  // Bloc obligatoire
  obligatoryCard: { borderRadius: 20, borderWidth: 2, padding: 16, gap: 12 },
  obligatoryCardOk: { backgroundColor: Pastel.tealSoft, borderColor: Pastel.teal },
  obligatoryCardKo: { backgroundColor: "#FEF2F2", borderColor: "#BE123C" },
  obligatoryLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  obligatoryText: { flex: 1, gap: 4 },
  obligatoryTitle: { color: Pastel.text, fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  obligatoryTitleKo: { color: "#BE123C" },
  obligatoryDesc: { color: Pastel.textMuted, fontSize: 13, lineHeight: 18, includeFontPadding: false },
  obligatoryBadge: { alignSelf: "flex-start", backgroundColor: "#BE123C", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  obligatoryBadgeText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.extraBold, letterSpacing: 0.8, includeFontPadding: false },

  // Bloc motivationnel
  motivCard: { backgroundColor: Pastel.tealSoft, borderRadius: 22, borderWidth: 1, borderColor: Pastel.teal, padding: 18, gap: 14 },
  motivHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  motivTitle: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, flex: 1, includeFontPadding: false },
  motivPoints: { gap: 10 },
  motivPoint: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  motivDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: Pastel.teal, marginTop: 6 },
  motivText: { color: Pastel.text, fontSize: 13, lineHeight: 19, flex: 1, includeFontPadding: false },
  motivBold: { fontFamily: Font.extraBold },
  motivExamples: { gap: 8, borderTopWidth: 1, borderTopColor: Pastel.teal, paddingTop: 12, opacity: 0.9 },
  motivExamplesLabel: { color: Pastel.teal, fontSize: 11, fontFamily: Font.extraBold, letterSpacing: 0.5, includeFontPadding: false },
  motivExampleChip: { color: Pastel.text, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },

  // Métriques
  metrics: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  metricCard: { flex: 1, minWidth: 100, backgroundColor: Pastel.surface, borderRadius: 18, borderWidth: 1, borderColor: Pastel.border, padding: 14, gap: 4, alignItems: "center" },
  metricValue: { fontSize: 28, fontFamily: Font.display, includeFontPadding: false },
  metricLabel: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },

  // Formulaire
  formCard: { backgroundColor: Pastel.surface, borderRadius: 24, borderWidth: 1, borderColor: Pastel.border, padding: 20, gap: 18 },
  formTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Pastel.teal, alignItems: "center", justifyContent: "center" },
  formTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  formStep: { gap: 8 },
  stepLabel: { color: Pastel.text, fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  stepHint: { color: Pastel.textMuted, fontSize: 12, lineHeight: 17, includeFontPadding: false },
  required: { color: Pastel.teal },
  optional: { color: Pastel.textMuted, fontFamily: Font.regular },
  input: { backgroundColor: Pastel.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Pastel.border, minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, color: Pastel.text, fontSize: 14, fontFamily: Font.regular },
  textArea: { minHeight: 90, textAlignVertical: "top" },

  // Fréquence
  freqGrid: { gap: 8 },
  freqCard: { borderRadius: 14, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surfaceAlt, padding: 12, gap: 3 },
  freqCardActive: { borderColor: Pastel.primary, backgroundColor: Pastel.primarySoft },
  freqLabel: { color: Pastel.text, fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
  freqLabelActive: { color: Pastel.primary },
  freqHint: { color: Pastel.textMuted, fontSize: 12, lineHeight: 16, includeFontPadding: false },

  // Statut
  statusRow: { flexDirection: "row", gap: 10 },
  statusCard: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surfaceAlt, padding: 12, gap: 4, alignItems: "center" },
  statusCardActive: { borderColor: Pastel.teal, backgroundColor: Pastel.tealSoft },
  statusCardInactive: { borderColor: "#D1D5DB", backgroundColor: "#F9FAFB" },
  statusCardLabel: { color: Pastel.text, fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
  statusCardLabelActive: { color: Pastel.teal },
  statusCardDesc: { color: Pastel.textMuted, fontSize: 11, textAlign: "center", lineHeight: 15, includeFontPadding: false },

  // Erreur
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, borderWidth: 1, borderColor: "#FECACA", padding: 12 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  formActions: { flexDirection: "row", gap: 10, alignItems: "center" },

  // Liste
  list: { gap: 12 },
  perkCard: { backgroundColor: Pastel.surface, borderRadius: 20, borderWidth: 1, borderColor: Pastel.border, padding: 16, gap: 10 },
  perkCardActive: { borderColor: Pastel.teal, borderWidth: 2 },
  perkCardInactive: { opacity: 0.55 },
  perkTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  perkTopLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  perkEmoji: { fontSize: 22, lineHeight: 28 },
  perkInfo: { flex: 1, gap: 4 },
  perkTitle: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  perkMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  perkMetaText: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  perkDescription: { color: Pastel.textMuted, fontSize: 13, lineHeight: 19, includeFontPadding: false },
  toggleBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  toggleBadgeOn: { backgroundColor: Pastel.tealSoft, borderColor: Pastel.teal },
  toggleBadgeOff: { backgroundColor: Pastel.surfaceAlt, borderColor: Pastel.border },
  toggleBadgeText: { fontSize: 12, fontFamily: Font.extraBold, includeFontPadding: false },
  toggleBadgeTextOn: { color: Pastel.teal },
  toggleBadgeTextOff: { color: Pastel.textMuted },
  perkActions: { flexDirection: "row", gap: 8 },

  // Vide
  emptyCard: { backgroundColor: Pastel.surface, borderRadius: 24, borderWidth: 1, borderColor: Pastel.border, padding: 28, gap: 8, alignItems: "center" },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  emptyHint: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", includeFontPadding: false },

  // Suppression inline
  deleteInline: { backgroundColor: "#FFF1F2", borderRadius: 14, borderWidth: 1, borderColor: "#FBCFE8", padding: 14, gap: 8 },
  deleteInlineTitle: { color: "#BE123C", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  deleteInlineHint: { color: "#BE123C", fontSize: 12, lineHeight: 17, opacity: 0.8, includeFontPadding: false },
  deleteCardRow: { flexDirection: "row", gap: 10 },
  deleteCancelBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surface },
  deleteCancelText: { color: Pastel.text, fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  deleteOkBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, backgroundColor: "#BE123C" },
  deleteOkText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },

  // Historique
  historyCard: { backgroundColor: Pastel.surface, borderRadius: 22, borderWidth: 1, borderColor: Pastel.border, padding: 18, gap: 12 },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyTitle: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  historyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Pastel.border },
  historyLeft: { gap: 2, flex: 1 },
  historyPerkName: { color: Pastel.text, fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  historyDate: { color: Pastel.textMuted, fontSize: 12, includeFontPadding: false },
  historyBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  historyBadgeOk: { backgroundColor: Pastel.successSoft },
  historyBadgePending: { backgroundColor: Pastel.surfaceAlt },
  historyBadgeText: { fontSize: 11, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
});
