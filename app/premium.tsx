import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import {
  getOfferingPackages,
  purchasePackage,
  restorePurchases,
} from "@/services/purchases";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const MONTHLY_PRICE = "2,99 €";
const YEARLY_PRICE = "29,99 €";
const YEARLY_MONTHLY_EQUIV = "2,49 €";
const YEARLY_SAVING = "Meilleur prix";

type Plan = "monthly" | "yearly";

const FEATURES: { label: string; basic: string | boolean; plus: string | boolean }[] = [
  { label: "Géolocalisation des établissements", basic: true, plus: true },
  { label: "Filtres avancés", basic: true, plus: true },
  { label: "Réservation d'activités", basic: true, plus: true },
  { label: "Accès à l'agenda des événements", basic: true, plus: true },
  { label: "Accès et création de club", basic: true, plus: true },
  { label: "Ajout de lieux favoris", basic: "2 max", plus: "Illimité" },
  { label: "Offres privilèges dans les établissements", basic: false, plus: true },
  { label: "Accès à l'agenda des amis", basic: false, plus: true },
  { label: "Carte des lieux favoris des amis", basic: false, plus: true },
  { label: "Statistiques personnelles", basic: false, plus: true },
  { label: "Badge Jovial+ sur ton profil", basic: false, plus: true },
];

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium } = useIsPremium();
  const [plan, setPlan] = useState<Plan>("yearly");
  const [monthlyPkg, setMonthlyPkg] = useState<any>(null);
  const [annualPkg, setAnnualPkg] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Recupere les offres RevenueCat (vide tant que le SDK/les cles ne sont pas la)
  useEffect(() => {
    let cancelled = false;
    getOfferingPackages().then((pkgs) => {
      if (cancelled) return;
      setMonthlyPkg(pkgs.find((p) => p?.packageType === "MONTHLY") ?? null);
      setAnnualPkg(pkgs.find((p) => p?.packageType === "ANNUAL") ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  // Prix reels (depuis le store) si dispo, sinon prix affiches en dur
  const monthlyPriceLabel = monthlyPkg?.product?.priceString ?? MONTHLY_PRICE;
  const yearlyPriceLabel = annualPkg?.product?.priceString ?? YEARLY_PRICE;

  const handleSubscribe = async () => {
    const pkg = plan === "monthly" ? monthlyPkg : annualPkg;
    if (!pkg) {
      // SDK pas encore actif (build sans RevenueCat ou cles manquantes)
      Alert.alert(
        "Bientôt disponible",
        "Le paiement arrive très prochainement. Merci pour ton intérêt pour Jovial+ !",
        [{ text: "OK" }]
      );
      return;
    }
    setPurchasing(true);
    const res = await purchasePackage(pkg);
    setPurchasing(false);
    if (res.cancelled) return;
    if (res.premium) {
      Alert.alert("Bienvenue dans Jovial+ 🎉", "Ton abonnement est activé. Profite bien !", [
        { text: "Super", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert("Oups", res.error ?? "Le paiement n'a pas pu aboutir. Réessaie dans un instant.");
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    Alert.alert(
      ok ? "Achats restaurés" : "Aucun achat trouvé",
      ok
        ? "Ton abonnement Jovial+ a été réactivé."
        : "Aucun abonnement actif n'a été trouvé sur ce compte."
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
            {plan === "monthly" ? monthlyPriceLabel : yearlyPriceLabel}
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
          <Pressable
            style={[styles.cta, purchasing ? styles.ctaDisabled : null]}
            onPress={handleSubscribe}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>Essayer 30 jours gratuitement</Text>
            )}
          </Pressable>
        )}

        {!isPremium ? (
          <Text style={styles.ctaNote}>
            {`Puis ${plan === "monthly" ? `${monthlyPriceLabel}/mois` : `${yearlyPriceLabel}/an`} · sans engagement, résiliable à tout moment`}
          </Text>
        ) : null}

        <Pressable onPress={handleRestore} disabled={restoring} hitSlop={8} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>
            {restoring ? "Restauration…" : "Restaurer mes achats"}
          </Text>
        </Pressable>

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
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  ctaNote: { textAlign: "center", fontSize: 11, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  restoreBtn: { alignSelf: "center", paddingVertical: 6 },
  restoreText: { fontSize: 13, color: Pastel.primary, fontFamily: Font.semiBold, textDecorationLine: "underline", includeFontPadding: false },

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
