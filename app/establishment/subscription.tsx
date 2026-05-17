import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
        const establishment = await getMyEstablishment(userId);
        if (!cancelled) {
          setEstablishment(establishment);
        }

        const [nextPlans, nextPrices] = await Promise.all([
          listSubscriptionPlans().catch(() => []),
          listSubscriptionPlanPrices().catch(() => []),
        ]);

        const sub = establishment ? await getSubscription(establishment.id) : null;
        if (!cancelled) {
          setSubscription(sub);
          setPlans(nextPlans);
          setPrices(nextPrices);
        }
      } catch {
        if (!cancelled) {
          setSubscription(null);
          setEstablishment(null);
          setPlans([]);
          setPrices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const currentOfferKey = useMemo(() => {
    if (!subscription || subscription.status !== "active") return null;
    return planCodeToOfferKey(subscription.plan);
  }, [subscription]);

  const currentOffer = currentOfferKey ? getOfferByKey(currentOfferKey) : null;
  const upgradeOffers = JOVIAL_PRO_OFFERS.filter((offer) => offer.key !== currentOfferKey);

  const getYearPrice = (offerKey: (typeof JOVIAL_PRO_OFFERS)[number]["key"]) => {
    const planCode = OFFER_TO_PLAN_CODE[offerKey];
    if (!planCode) return null;
    const plan = plans.find((item) => item.code === planCode);
    if (!plan) return null;
    return prices.find((item) => item.plan_id === plan.id && item.interval === "year" && item.active) ?? null;
  };

  const getMonthPrice = (offerKey: (typeof JOVIAL_PRO_OFFERS)[number]["key"]) => {
    const planCode = OFFER_TO_PLAN_CODE[offerKey];
    if (!planCode) return null;
    const plan = plans.find((item) => item.code === planCode);
    if (!plan) return null;
    return prices.find((item) => item.plan_id === plan.id && item.interval === "month" && item.active) ?? null;
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.button} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.buttonText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#111827"} />
      </View>
    );
  }

  return (
    <JovialProShell
      currentPath={pathname}
      title="Mon offre"
      subtitle="Compare les formules de façon claire, puis ouvre une page dédiée pour configurer le paiement avant validation."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{currentOffer ? "OFFRE ACTUELLE" : "AUCUNE OFFRE ACTIVE"}</Text>
        <Text style={styles.heroTitle}>{currentOffer?.name ?? "Choisis ton offre"}</Text>
        {currentOffer ? (
          <>
            <Text style={styles.heroPrice}>{formatOfferPrice(currentOffer.annualPrice)}</Text>
            <Text style={styles.heroText}>{currentOffer.summary}</Text>
          </>
        ) : (
          <Text style={styles.heroText}>
            Tu n'as pas encore souscrit d'offre. Clique sur une formule pour ouvrir une page claire de configuration avant paiement.
          </Text>
        )}
        {subscription ? (
          <Text style={styles.heroMeta}>
            Statut : {subscription.status === "active" ? "Actif" : subscription.status}
          </Text>
        ) : (
          <Text style={styles.heroMeta}>Aucune souscription active pour le moment.</Text>
        )}
      </View>

      <View style={styles.cardsRow}>
        {JOVIAL_PRO_OFFERS.map((offer) => {
          const isCurrent = offer.key === currentOfferKey;
          const yearlyPrice = getYearPrice(offer.key);
          const monthlyPrice = getMonthPrice(offer.key);
          const checkoutEnabled = !!yearlyPrice && !!establishment?.id;

          return (
            <Pressable
              key={offer.key}
              style={[
                styles.offerCard,
                offer.recommended ? styles.offerCardRecommended : null,
                isCurrent ? styles.offerCardCurrent : null,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/establishment/subscription/[offer]",
                  params: { offer: offer.key },
                })
              }
            >
              <View style={styles.offerHeader}>
                <View style={styles.offerTitleBlock}>
                  <Text style={styles.offerEyebrow}>JOVIAL PRO</Text>
                  <Text style={styles.offerName}>{offer.name}</Text>
                  <Text style={styles.offerLabel}>{offer.shortLabel}</Text>
                </View>
                {isCurrent ? (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>Active</Text>
                  </View>
                ) : offer.recommended ? (
                  <View style={styles.recommendedPill}>
                    <Text style={styles.recommendedText}>Recommandée</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.priceBlock}>
                <Text style={styles.offerPrice}>{formatOfferPrice(offer.annualPrice)}</Text>
                <Text style={styles.priceMeta}>
                  {monthlyPrice
                    ? `${(monthlyPrice.price_cents / 100).toFixed(2).replace(".", ",")} EUR/mois`
                    : checkoutEnabled
                      ? "Paiement disponible"
                      : "Activation accompagnée"}
                </Text>
              </View>

              <Text style={styles.offerSummary}>{offer.summary}</Text>

              <ScrollView style={styles.featureScroll} nestedScrollEnabled>
                <View style={styles.featureList}>
                  {offer.features.map((feature) => (
                    <View key={feature} style={styles.featureItem}>
                      <View style={styles.featureDot} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>
                  {isCurrent
                    ? "Voir le récapitulatif"
                    : checkoutEnabled
                      ? "Configurer et payer"
                      : "Voir les détails"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Monter en gamme plus tard</Text>
        <Text style={styles.infoText}>
          Une fois la souscription active, cette page affichera clairement ton offre actuelle puis
          les formules supérieures encore disponibles.
        </Text>
        {upgradeOffers.length > 0 ? (
          <Text style={styles.infoText}>
            Offres supérieures disponibles : {upgradeOffers.map((offer) => offer.name).join(" • ")}
          </Text>
        ) : null}
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
  title: { fontSize: 22, fontFamily: Font.bold, color: "#111827", includeFontPadding: false },
  button: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buttonText: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 22,
    gap: 8,
  },
  heroEyebrow: { color: "#111827", fontSize: 11, fontFamily: Font.extraBold, letterSpacing: 1.2, includeFontPadding: false },
  heroTitle: { color: "#111827", fontSize: 28, fontFamily: Font.extraBold, includeFontPadding: false },
  heroPrice: { color: "#111827", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  heroText: { color: "#9CA3AF", fontSize: 14, lineHeight: 21, includeFontPadding: false },
  heroMeta: { color: "#111827", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  cardsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  offerCard: {
    minWidth: 300,
    flexGrow: 1,
    flexBasis: 300,
    minHeight: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 22,
    gap: 16,
  },
  offerCardRecommended: {
    borderColor: "#111827",
    backgroundColor: "#F8FBFF",
  },
  offerCardCurrent: {
    borderColor: "#1E7A36",
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  offerTitleBlock: { gap: 4, flex: 1 },
  offerEyebrow: { color: "#111827", fontSize: 11, fontFamily: Font.extraBold, letterSpacing: 1.2, includeFontPadding: false },
  offerName: { color: "#111827", fontSize: 22, fontFamily: Font.extraBold, includeFontPadding: false },
  offerLabel: { color: "#9CA3AF", fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  recommendedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  recommendedText: { color: "#111827", fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  currentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E9F8EE",
  },
  currentPillText: { color: "#1E7A36", fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
  priceBlock: { gap: 4 },
  offerPrice: { color: "#111827", fontSize: 30, fontFamily: Font.extraBold, includeFontPadding: false },
  priceMeta: { color: "#9CA3AF", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  offerSummary: { color: "#9CA3AF", fontSize: 14, lineHeight: 20, includeFontPadding: false },
  featureScroll: { flex: 1 },
  featureList: { gap: 10 },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    marginTop: 6,
  },
  featureText: { color: "#111827", fontSize: 14, lineHeight: 20, flex: 1, includeFontPadding: false },
  cardFooter: {
    borderRadius: 16,
    backgroundColor: "#111111",
    paddingVertical: 14,
    alignItems: "center",
  },
  cardFooterText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 10,
  },
  infoTitle: { color: "#111827", fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  infoText: { color: "#9CA3AF", fontSize: 14, lineHeight: 21, includeFontPadding: false },
});
