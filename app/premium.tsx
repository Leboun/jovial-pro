import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsPremium } from "@/hooks/useIsPremium";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const MONTHLY_PRICE = "4,99 €";
const YEARLY_PRICE = "49,99 €";
const YEARLY_MONTHLY_EQUIV = "4,17 €";
const YEARLY_SAVING = "30 jours offerts";

type Plan = "monthly" | "yearly";

const FEATURES: { label: string; basic: string | boolean; plus: string | boolean }[] = [
  { label: "Géolocalisation des bars", basic: true, plus: true },
  { label: "Filtres avancés", basic: true, plus: true },
  { label: "Réservation d'activités", basic: true, plus: true },
  { label: "Accès à l'agenda des événements", basic: true, plus: true },
  { label: "Accès et création de club", basic: true, plus: true },
  { label: "Ajout de bars / lieux favoris", basic: "2 max", plus: "Illimité" },
  { label: "Offres privilèges dans les établissements", basic: false, plus: true },
  { label: "Accès à l'agenda des copains", basic: false, plus: true },
  { label: "Carte des bars favoris des amis", basic: false, plus: true },
  { label: "Statistiques personnelles", basic: false, plus: true },
  { label: "Statut Jovial+ (cercle doré sur la photo)", basic: false, plus: true },
];

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium } = useIsPremium();
  const [plan, setPlan] = useState<Plan>("yearly");

  const handleSubscribe = () => {
    // TODO: intégrer RevenueCat ici
    Alert.alert(
      "Bientôt disponible",
      "Le paiement sera disponible très prochainement. Merci pour ton intérêt pour Jovial+ !",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>JOVIAL+</Text>
        </View>
        <Text style={styles.heroTitle} adjustsFontSizeToFit numberOfLines={1}>Passe au niveau supérieur</Text>
        <Text style={styles.heroSubtitle}>
          Accède à toutes les fonctionnalités et vis une expérience Jovial sans limite.
        </Text>

        <View style={styles.planToggle}>
          <Pressable
            style={[styles.planBtn, plan === "monthly" ? styles.planBtnActive : null]}
            onPress={() => setPlan("monthly")}
            hitSlop={8}
          >
            <Text style={[styles.planBtnText, plan === "monthly" ? styles.planBtnTextActive : null]}>
              Mensuel
            </Text>
          </Pressable>
          <Pressable
            style={[styles.planBtn, plan === "yearly" ? styles.planBtnActive : null]}
            onPress={() => setPlan("yearly")}
            hitSlop={8}
          >
            <Text style={[styles.planBtnText, plan === "yearly" ? styles.planBtnTextActive : null]}>
              Annuel
            </Text>
            <View style={styles.savingBadge}>
              <Text style={styles.savingBadgeText}>{YEARLY_SAVING}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.priceMain} adjustsFontSizeToFit numberOfLines={1}>
            {plan === "monthly" ? MONTHLY_PRICE : YEARLY_PRICE}
          </Text>
          <Text style={styles.priceSub}>
            {plan === "monthly"
              ? "/ mois"
              : `/ an · soit ${YEARLY_MONTHLY_EQUIV}/mois`}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isPremium ? (
          <View style={styles.alreadyPremium}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.alreadyPremiumText}>Tu es déjà abonné à Jovial+</Text>
          </View>
        ) : (
          <Pressable style={styles.cta} onPress={handleSubscribe}>
            <Text style={styles.ctaText}>
              {plan === "monthly" ? `S'abonner · ${MONTHLY_PRICE}/mois` : `S'abonner · ${YEARLY_PRICE}/an`}
            </Text>
          </Pressable>
        )}

        <Text style={styles.ctaNote}>30 premiers jours offerts · Engagement minimum 1 an</Text>

        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <View style={{ flex: 1 }} />
            <Text style={styles.tableColLabel}>Basic</Text>
            <Text style={[styles.tableColLabel, styles.tableColPlus]}>Jovial+</Text>
          </View>

          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowAlt : null]}>
              <Text style={styles.tableFeature}>{f.label}</Text>
              <View style={styles.tableCell}>
                {f.basic === true ? (
                  <Ionicons name="checkmark" size={15} color="#6B7280" />
                ) : f.basic === false ? (
                  <Text style={styles.tableDash}>—</Text>
                ) : (
                  <Text style={styles.tableValue}>{f.basic}</Text>
                )}
              </View>
              <View style={[styles.tableCell, styles.tableCellPlus]}>
                {f.plus === true ? (
                  <Ionicons name="checkmark" size={15} color={Pastel.teal} />
                ) : f.plus === false ? (
                  <Text style={styles.tableDash}>—</Text>
                ) : (
                  <Text style={[styles.tableValue, { color: Pastel.teal, fontFamily: Font.bold }]}>{f.plus}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.legalNote}>
          Abonnement annuel avec engagement minimum d'un an. Les 30 premiers jours sont offerts. À l'issue de la période d'essai, le montant sera prélevé selon la formule choisie. Renouvellement automatique.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },

  hero: {
    backgroundColor: Pastel.primary,
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    alignSelf: "flex-start",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 4,
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Pastel.cream,
  },
  heroBadgeText: { color: Pastel.accentText, fontSize: 11, fontFamily: Font.extraBold, letterSpacing: 1.5, includeFontPadding: false },
  heroTitle: { color: "#FFFFFF", fontSize: 34, fontFamily: Font.display, textAlign: "center", letterSpacing: 1, includeFontPadding: false },
  heroSubtitle: { color: "rgba(255,255,255,0.65)", fontSize: 13, textAlign: "center", lineHeight: 19, fontFamily: Font.regular, includeFontPadding: false },

  planToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 3,
    marginTop: 6,
  },
  planBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  planBtnActive: { backgroundColor: "#FFFFFF" },
  planBtnText: { color: "rgba(255,255,255,0.65)", fontFamily: Font.bold, fontSize: 13, includeFontPadding: false },
  planBtnTextActive: { color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  savingBadge: { backgroundColor: Pastel.teal, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  savingBadgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: Font.extraBold, includeFontPadding: false },

  priceBlock: { alignItems: "center", marginTop: 4 },
  priceMain: { color: "#FFFFFF", fontSize: 44, fontFamily: Font.display, letterSpacing: 1, includeFontPadding: false },
  priceSub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2, fontFamily: Font.regular, includeFontPadding: false },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 48 },

  alreadyPremium: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#D1FAE5",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  alreadyPremiumText: { color: "#065F46", fontFamily: Font.bold, fontSize: 14, includeFontPadding: false },

  cta: {
    backgroundColor: Pastel.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Pastel.teal,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  ctaNote: { textAlign: "center", fontSize: 11, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },

  tableCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Pastel.border,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Pastel.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  tableColLabel: { width: 56, textAlign: "center", fontSize: 12, fontFamily: Font.bold, color: Pastel.textMuted, includeFontPadding: false },
  tableColPlus: { color: Pastel.teal },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14 },
  tableRowAlt: { backgroundColor: Pastel.background },
  tableFeature: { flex: 1, fontSize: 13, color: Pastel.text, lineHeight: 17, fontFamily: Font.regular, includeFontPadding: false },
  tableCell: { width: 56, alignItems: "center" },
  tableCellPlus: {},
  tableDash: { color: Pastel.border, fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  tableValue: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },
  legalNote: { fontSize: 11, color: Pastel.textMuted, textAlign: "center", lineHeight: 16, paddingHorizontal: 8, fontFamily: Font.regular, includeFontPadding: false },
});
