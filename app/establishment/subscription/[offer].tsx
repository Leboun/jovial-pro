import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import JovialProShell from "@/components/ui/JovialProShell";
import JovialProStepBar from "@/components/ui/JovialProStepBar";
import { ESTABLISHMENT_PREVIEW_ENABLED } from "@/constants/establishmentPreview";
import { formatOfferPrice, getOfferByKey, type JovialProOfferKey } from "@/constants/jovialPro";
import { useAuth } from "@/providers/AuthProvider";
import { createCheckoutSession } from "@/services/billing";
import {
  ensureStubEstablishmentForPro,
  fetchRealVenueByOwner,
  getSubscription,
  listSubscriptionPlanPrices,
  listSubscriptionPlans,
} from "@/services/establishment";
import { OFFER_TO_PLAN_CODE, planCodeToOfferKey } from "@/utils/jovialProBilling";

type BillingInterval = "month" | "year";

export default function EstablishmentSubscriptionCheckoutScreen() {
  const router = useRouter();
  const { offer, interval } = useLocalSearchParams<{ offer?: string; interval?: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(interval === "month" ? "month" : "year");
  const [submitting, setSubmitting] = useState(false);

  const offerKey = useMemo(() => {
    if (offer === "visibilite" || offer === "rayonnement" || offer === "pro") {
      return offer as JovialProOfferKey;
    }
    return null;
  }, [offer]);

  const selectedOffer = offerKey ? getOfferByKey(offerKey) : null;

  useEffect(() => {
    if (interval === "month" || interval === "year") {
      setSelectedInterval(interval);
    }
  }, [interval]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextPlans, nextPrices] = await Promise.all([
          listSubscriptionPlans().catch(() => []),
          listSubscriptionPlanPrices().catch(() => []),
        ]);
        const profile = userId ? await fetchRealVenueByOwner(userId).catch(() => null) : null;
        const sub = profile ? await getSubscription(profile.id).catch(() => null) : null;

        if (!cancelled) {
          setEstablishment(profile);
          setSubscription(sub);
          setPlans(nextPlans);
          setPrices(nextPrices);
        }
      } catch {
        if (!cancelled) {
          setEstablishment(null);
          setSubscription(null);
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

  const planCode = offerKey ? OFFER_TO_PLAN_CODE[offerKey] : null;
  const selectedPlan = useMemo(() => plans.find((item) => item.code === planCode) ?? null, [planCode, plans]);
  const availablePrices = useMemo(
    () => prices.filter((item) => selectedPlan && item.plan_id === selectedPlan.id && item.active),
    [prices, selectedPlan]
  );
  const intervalPrice = useMemo(
    () => availablePrices.find((item) => item.interval === selectedInterval) ?? null,
    [availablePrices, selectedInterval]
  );

  const priceLabel = useMemo(() => {
    if (!selectedOffer) return "";
    if (selectedInterval === "year") {
      return formatOfferPrice(selectedOffer.annualPrice);
    }
    if (intervalPrice) return `${(intervalPrice.price_cents / 100).toFixed(2).replace(".", ",")} EUR/mois`;
    return `${selectedOffer.monthlyPrice.toFixed(2).replace(".", ",")} EUR/mois`;
  }, [intervalPrice, selectedInterval, selectedOffer]);

  const isCurrent = currentOfferKey === offerKey;
  const canCheckout = !!userId && !isCurrent;
  const checkoutPath = offerKey ? `/establishment/subscription/${offerKey}?interval=${selectedInterval}` : "/establishment/offers";
  const nextBackOfficePath = "/establishment/dashboard";

  const handleCheckout = async () => {
    if (!userId || !selectedOffer || !offerKey) {
      Alert.alert("Indisponible", "Connecte-toi d'abord pour finaliser cette souscription.");
      return;
    }
    if (!intervalPrice?.stripe_price_id) {
      try {
        setSubmitting(true);
        await ensureStubEstablishmentForPro(userId);
      } catch { /* non-bloquant */ } finally {
        setSubmitting(false);
      }
      router.replace("/establishment/dashboard");
      return;
    }

    try {
      setSubmitting(true);
      const venue = establishment ?? (await ensureStubEstablishmentForPro(userId));
      if (!venue?.id) {
        throw new Error("Venue missing");
      }

      if (!establishment) {
        setEstablishment(venue);
      }

      const baseUrl =
        typeof window !== "undefined" && window.location?.origin
          ? `${window.location.origin}/establishment/subscription`
          : "https://jovial.app/establishment/subscription";
      const result = await createCheckoutSession({
        venueId: venue.id,
        priceId: intervalPrice.stripe_price_id,
        successUrl: `${baseUrl}?checkout=success`,
        cancelUrl: `${baseUrl}/${offerKey}?checkout=cancel&interval=${selectedInterval}`,
      });
      if (!result?.url) {
        throw new Error("Checkout URL missing");
      }
      if (typeof window !== "undefined") {
        window.location.href = result.url;
      } else {
        await Linking.openURL(result.url);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir la page de paiement pour le moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#111827"} />
      </View>
    );
  }

  if (!selectedOffer || !offerKey) {
    return (
      <JovialProShell
        currentPath="/establishment/subscription"
        title="Configurer votre forfait"
        showNavigation={false}
      >
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Offre introuvable</Text>
          <Text style={styles.noticeText}>Choisis une offre depuis la page précédente.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace("/establishment/offers")}>
            <Text style={styles.primaryButtonText}>Retour aux offres</Text>
          </Pressable>
        </View>
      </JovialProShell>
    );
  }

  return (
    <JovialProShell
      currentPath="/establishment/subscription"
      title="Configurer votre forfait"
      subtitle="Choisis ton rythme de facturation puis finalise la souscription. Le compte n'est créé qu'à cette étape."
      showNavigation={false}
    >
      <JovialProStepBar
        step={2}
        caption="Tu valides d'abord le forfait. Le compte partenaire et le paiement arrivent juste après."
      />
      <Pressable style={styles.backLink} onPress={() => router.replace("/establishment/offers")}>
        <Text style={styles.backLinkText}>Retour aux offres</Text>
      </Pressable>

      <View style={styles.checkoutLayout}>
        <View style={styles.checkoutMain}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Détails du forfait</Text>
            <View style={styles.intervalRow}>
              {(["month", "year"] as BillingInterval[]).map((nextInterval) => {
                const active = selectedInterval === nextInterval;
                const matchingPrice = availablePrices.find((item) => item.interval === nextInterval);
                const label =
                  nextInterval === "year"
                    ? formatOfferPrice(selectedOffer.annualPrice)
                    : matchingPrice
                      ? `${(matchingPrice.price_cents / 100).toFixed(2).replace(".", ",")} EUR/mois`
                      : `${selectedOffer.monthlyPrice.toFixed(2).replace(".", ",")} EUR/mois`;
                return (
                  <Pressable
                    key={nextInterval}
                    style={[styles.intervalCard, active ? styles.intervalCardActive : null]}
                    onPress={() => setSelectedInterval(nextInterval)}
                  >
                    <Text style={[styles.intervalTitle, active ? styles.intervalTitleActive : null]}>
                      {nextInterval === "year" ? "Facturation annuelle" : "Facturation mensuelle"}
                    </Text>
                    <Text style={[styles.intervalText, active ? styles.intervalTextActive : null]}>{label}</Text>
                    {nextInterval === "year" ? <Text style={styles.intervalMeta}>Économisez sur 12 mois</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {!userId ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Coordonnées</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Compte partenaire</Text>
                <Text style={styles.infoValue}>Création du compte à l'étape suivante</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Principales fonctionnalités</Text>
            <View style={styles.featuresList}>
              {selectedOffer.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>FORFAIT</Text>
          <Text style={styles.summaryTitle}>{selectedOffer.name}</Text>
          <Text style={styles.summaryLabel}>{selectedOffer.shortLabel}</Text>
          <Text style={styles.summaryPrice}>{priceLabel}</Text>
          <Text style={styles.summaryText}>{selectedOffer.summary}</Text>
          <View style={styles.summaryPills}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>Essai gratuit activé au démarrage</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>
                {ESTABLISHMENT_PREVIEW_ENABLED
                  ? "Back-office accessible à l'étape suivante"
                  : "Compte demandé à l'étape suivante"}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLineLabel}>Souscription</Text>
            <Text style={styles.summaryLineValue}>{selectedInterval === "year" ? "Annuel" : "Mensuel"}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLineLabel}>Paiement aujourd'hui</Text>
            <Text style={styles.summaryLineValue}>{priceLabel}</Text>
          </View>
          {isCurrent ? (
            <View style={styles.currentPill}>
              <Text style={styles.currentPillText}>Cette offre est déjà active</Text>
            </View>
          ) : null}

          {!userId ? (
            <>
              <Pressable
                style={styles.payButton}
                onPress={() =>
                  router.push({
                    pathname: "/establishment/signup",
                    params: {
                      offer: offerKey,
                      interval: selectedInterval,
                      next: ESTABLISHMENT_PREVIEW_ENABLED ? nextBackOfficePath : checkoutPath,
                    },
                  })
                }
              >
                <Text style={styles.payButtonText}>Suivant</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryAction}
                onPress={() =>
                  router.push({
                    pathname: "/establishment/login",
                    params: { next: ESTABLISHMENT_PREVIEW_ENABLED ? nextBackOfficePath : checkoutPath },
                  })
                }
              >
                <Text style={styles.secondaryActionText}>J'ai déjà un compte</Text>
              </Pressable>
              <Text style={styles.summaryHint}>
                {ESTABLISHMENT_PREVIEW_ENABLED
                  ? "Le paiement reste de côté pour l'instant. Crée ou reconnecte ton compte puis ouvre le back-office."
                  : "Tu peux consulter les offres librement. Le compte partenaire n'est demandé qu'ici, juste avant la souscription."}
              </Text>
            </>
          ) : (
            <>
              {ESTABLISHMENT_PREVIEW_ENABLED ? (
                <>
                  <Pressable
                    style={styles.payButton}
                    onPress={() => router.push(nextBackOfficePath)}
                  >
                    <Text style={styles.payButtonText}>Suivant</Text>
                  </Pressable>
                  <Text style={styles.summaryHint}>
                    Le paiement est temporairement contourné pendant le développement du back-office.
                  </Text>
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.payButton, (!canCheckout || submitting) ? styles.payButtonDisabled : null]}
                    disabled={!canCheckout || submitting}
                    onPress={handleCheckout}
                  >
                    <Text style={styles.payButtonText}>
                      {isCurrent ? "Offre déjà active" : submitting ? "Ouverture..." : "Procéder au paiement"}
                    </Text>
                  </Pressable>
                  <Text style={styles.summaryHint}>
                    {intervalPrice?.stripe_price_id
                      ? "Tu seras redirigé vers une page de paiement sécurisée pour finaliser la souscription."
                      : "Le paiement Stripe sera activé prochainement. Tu peux déjà valider ton choix d'offre."}
                  </Text>
                </>
              )}
            </>
          )}
        </View>
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
    backgroundColor: "#f8faff",
    padding: 20,
  },
  noticeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 24,
    gap: 12,
  },
  noticeTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  noticeText: { fontSize: 14, lineHeight: 20, color: "#9CA3AF" },
  primaryButton: {
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  backLink: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  backLinkText: { color: "#2B4E93", fontSize: 13, fontWeight: "700" },
  checkoutLayout: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  checkoutMain: {
    flexGrow: 1,
    flexBasis: 540,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 22,
    gap: 16,
  },
  sectionTitle: { color: "#111827", fontSize: 22, fontWeight: "800" },
  intervalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  intervalCard: {
    minWidth: 220,
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    padding: 18,
    gap: 6,
  },
  intervalCardActive: {
    borderColor: "#2B4E93",
    backgroundColor: "#F7F9FF",
  },
  intervalTitle: { color: "#111827", fontSize: 16, fontWeight: "800" },
  intervalTitleActive: { color: "#111827" },
  intervalText: { color: "#111827", fontSize: 15, fontWeight: "700" },
  intervalTextActive: { color: "#111827" },
  intervalMeta: { color: "#9CA3AF", fontSize: 12, fontWeight: "600" },
  infoBox: {
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    padding: 16,
    gap: 4,
  },
  infoLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  infoValue: { color: "#111827", fontSize: 16, fontWeight: "700" },
  featuresList: { gap: 10 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#2B4E93",
    marginTop: 6,
  },
  featureText: { flex: 1, color: "#111827", fontSize: 14, lineHeight: 21 },
  summaryCard: {
    width: 360,
    maxWidth: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 24,
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  summaryEyebrow: { color: "#111827", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  summaryTitle: { color: "#111827", fontSize: 32, fontWeight: "800" },
  summaryLabel: { color: "#9CA3AF", fontSize: 13, fontWeight: "700" },
  summaryPrice: { color: "#111827", fontSize: 24, fontWeight: "800" },
  summaryText: { color: "#9CA3AF", fontSize: 14, lineHeight: 21 },
  summaryPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryPill: {
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryPillText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "700",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  summaryLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLineLabel: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
  summaryLineValue: { color: "#111827", fontSize: 14, fontWeight: "800" },
  currentPill: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  currentPillText: { color: "#111827", fontSize: 12, fontWeight: "800" },
  payButton: {
    marginTop: 8,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#2B4E93",
  },
  payButtonDisabled: {
    backgroundColor: "#D9DEE8",
  },
  payButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondaryAction: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  secondaryActionText: { color: "#111827", fontSize: 14, fontWeight: "700" },
  summaryHint: { color: "#9CA3AF", fontSize: 12, lineHeight: 18 },
});
