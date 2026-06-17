import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";

import JovialProShell from "@/components/ui/JovialProShell";
import { formatOfferPrice, getOfferByKey, JOVIAL_PRO_OFFERS } from "@/constants/jovialPro";
import { useAuth } from "@/providers/AuthProvider";
import {
  getMyEstablishment,
  getSubscription,
  listSubscriptionPlanPrices,
  listSubscriptionPlans,
} from "@/services/establishment";
import { OFFER_TO_PLAN_CODE, planCodeToOfferKey } from "@/utils/jovialProBilling";
import { Font } from "@/constants/typography";
import { Pastel } from "@/constants/pastel";

const OFFER_RANK: Record<string, number> = { visibilite: 0, rayonnement: 1, pro: 2 };

export default function EstablishmentSubscriptionScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ checkout?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [establishment, setEstablishment] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);

  useEffect(() => {
    if (params.checkout === "success") {
      router.replace("/establishment/profile");
    }
  }, [params.checkout, router]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const estab = await getMyEstablishment(userId);
        if (!cancelled) setEstablishment(estab);
        const [nextPlans, nextPrices] = await Promise.all([
          listSubscriptionPlans().catch(() => []),
          listSubscriptionPlanPrices().catch(() => []),
        ]);
        const sub = estab ? await getSubscription(estab.id) : null;
        if (!cancelled) {
          setSubscription(sub);
          setPlans(nextPlans);
          setPrices(nextPrices);
        }
      } catch {
        if (!cancelled) { setSubscription(null); setEstablishment(null); setPlans([]); setPrices([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const currentOfferKey = useMemo(() => {
    if (!subscription || subscription.status !== "active") return null;
    return planCodeToOfferKey(subscription.plan);
  }, [subscription]);

  const currentOffer = currentOfferKey ? getOfferByKey(currentOfferKey) : null;

  useEffect(() => {
    if (!loading && currentOfferKey) {
      router.replace(`/establishment/subscription/${currentOfferKey}` as any);
    }
  }, [loading, currentOfferKey, router]);
  const currentRank = currentOfferKey ? (OFFER_RANK[currentOfferKey] ?? -1) : -1;
  const isTopPlan = currentRank >= Math.max(...Object.values(OFFER_RANK));

  const upgradeOffers = useMemo(() =>
    JOVIAL_PRO_OFFERS.filter((o) => (OFFER_RANK[o.key] ?? -1) > currentRank),
    [currentRank]
  );

  const getMonthPrice = (offerKey: string) => {
    const planCode = OFFER_TO_PLAN_CODE[offerKey as keyof typeof OFFER_TO_PLAN_CODE];
    if (!planCode) return null;
    const plan = plans.find((p) => p.code === planCode);
    if (!plan) return null;
    return prices.find((p) => p.plan_id === plan.id && p.interval === "month" && p.active) ?? null;
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Connexion requise</Text>
        <Pressable style={styles.btn} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.btnText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  // Tant que les données chargent OU qu'une redirection vers la page detail de l'offre
  // active est imminente, on garde le shell (sidebar) + loader pour eviter le "saut" visuel.
  if (loading || currentOfferKey) {
    return (
      <JovialProShell currentPath={pathname} title="Mon offre" loading>
        <View />
      </JovialProShell>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Mon offre"
      subtitle={currentOffer ? `Tu es sur l'${currentOffer.name}.` : "Choisis ta formule."}
    >
      {/* Carte offre actuelle */}
      {currentOffer ? (
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>Offre active</Text>
              </View>
              <Text style={styles.heroName}>{currentOffer.name}</Text>
              <Text style={styles.heroPrice}>{formatOfferPrice(currentOffer.annualPrice)}</Text>
              <Text style={styles.heroSummary}>{currentOffer.summary}</Text>
            </View>
            {isTopPlan && (
              <View style={styles.topBadge}>
                <Text style={styles.topBadgeText}>✦ Le plus complet</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.featureGrid}>
            {currentOffer.features.slice(0, 4).map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureDot}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.manageBtn}
            onPress={() => router.push({ pathname: "/establishment/subscription/[offer]", params: { offer: currentOffer.key } })}
          >
            <Text style={styles.manageBtnText}>Gérer mon abonnement →</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.noOfferCard}>
          <Text style={styles.noOfferTitle}>Aucune offre active</Text>
          <Text style={styles.noOfferText}>Choisis une formule ci-dessous pour démarrer.</Text>
        </View>
      )}

      {/* Offres supérieures ou toutes les offres si pas d'abonnement */}
      {!isTopPlan && (
        <View style={styles.upgradeSection}>
          <Text style={styles.upgradeTitle}>
            {currentOffer ? "Monter en gamme" : "Nos formules"}
          </Text>
          <View style={styles.upgradeList}>
            {(currentOffer ? upgradeOffers : JOVIAL_PRO_OFFERS).map((offer) => {
              const monthlyPrice = getMonthPrice(offer.key);
              const showRecommended = offer.recommended && currentRank < 1;
              return (
                <Pressable
                  key={offer.key}
                  style={styles.upgradeCard}
                  onPress={() => router.push({ pathname: "/establishment/subscription/[offer]", params: { offer: offer.key } })}
                >
                  <View style={styles.upgradeCardHeader}>
                    <View style={styles.upgradeCardTitles}>
                      <Text style={styles.upgradeCardName}>{offer.name}</Text>
                      <Text style={styles.upgradeCardLabel}>{offer.shortLabel}</Text>
                    </View>
                    <View style={styles.upgradeCardRight}>
                      {showRecommended && (
                        <View style={styles.recommendedPill}>
                          <Text style={styles.recommendedPillText}>★ Recommandée</Text>
                        </View>
                      )}
                      {offer.key === "pro" && (
                        <View style={styles.proPill}>
                          <Text style={styles.proPillText}>✦ Le plus complet</Text>
                        </View>
                      )}
                      <View style={styles.upgradePriceBlock}>
                        <Text style={styles.upgradePrice}>{formatOfferPrice(offer.annualPrice)}</Text>
                        {monthlyPrice && (
                          <Text style={styles.upgradePriceMeta}>
                            {(monthlyPrice.price_cents / 100).toFixed(2).replace(".", ",")} €/mois
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.upgradeSummary}>{offer.summary}</Text>
                  <View style={styles.upgradeFeatures}>
                    {offer.features.slice(0, 3).map((f) => (
                      <Text key={f} style={styles.upgradeFeatureText}>· {f}</Text>
                    ))}
                  </View>
                  <Text style={styles.upgradeCtaText}>Choisir cette formule →</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerText: { fontSize: 18, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  btn: { backgroundColor: Pastel.teal, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  btnText: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },

  // Hero offre actuelle
  heroCard: {
    backgroundColor: Pastel.tealSoft,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Pastel.teal,
    padding: 24,
    gap: 18,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  heroLeft: { flex: 1, gap: 6 },
  heroPill: {
    alignSelf: "flex-start",
    backgroundColor: Pastel.teal,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroPillText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  heroName: { color: Pastel.text, fontSize: 26, fontFamily: Font.extraBold, includeFontPadding: false },
  heroPrice: { color: Pastel.teal, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  heroSummary: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, includeFontPadding: false },
  topBadge: {
    backgroundColor: Pastel.teal,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  topBadgeText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  divider: { height: 1, backgroundColor: Pastel.teal, opacity: 0.2 },
  featureGrid: { gap: 10 },
  featureRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  featureDot: { color: Pastel.teal, fontSize: 13, fontFamily: Font.extraBold, lineHeight: 20, includeFontPadding: false },
  featureText: { color: Pastel.text, fontSize: 14, lineHeight: 20, flex: 1, includeFontPadding: false },
  manageBtn: {
    backgroundColor: Pastel.teal,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  manageBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },

  // Aucune offre
  noOfferCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 20,
    gap: 8,
  },
  noOfferTitle: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  noOfferText: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, includeFontPadding: false },

  // Section monter en gamme
  upgradeSection: { gap: 14 },
  upgradeTitle: { color: Pastel.text, fontSize: 20, fontFamily: Font.extraBold, includeFontPadding: false },
  upgradeList: { gap: 12 },
  upgradeCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  upgradeCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  upgradeCardTitles: { flex: 1, gap: 2 },
  upgradeCardName: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  upgradeCardLabel: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  upgradeCardRight: { alignItems: "flex-end", gap: 6 },
  recommendedPill: {
    backgroundColor: Pastel.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedPillText: { color: Pastel.primary, fontSize: 10, fontFamily: Font.extraBold, includeFontPadding: false },
  proPill: {
    backgroundColor: Pastel.tealSoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.teal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proPillText: { color: Pastel.teal, fontSize: 10, fontFamily: Font.extraBold, includeFontPadding: false },
  upgradePriceBlock: { alignItems: "flex-end", gap: 1 },
  upgradePrice: { color: Pastel.text, fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  upgradePriceMeta: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.semiBold, includeFontPadding: false },
  upgradeSummary: { color: Pastel.textMuted, fontSize: 13, lineHeight: 19, includeFontPadding: false },
  upgradeFeatures: { gap: 4 },
  upgradeFeatureText: { color: Pastel.text, fontSize: 13, lineHeight: 18, includeFontPadding: false },
  upgradeCtaText: { color: Pastel.teal, fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
});
