import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getOfferByKey, JOVIAL_PRO_OFFERS } from "@/constants/jovialPro";
import { Pastel } from "@/constants/pastel";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchRealVenueByOwner,
  getSubscription,
  listSubscriptionPlanPrices,
  listSubscriptionPlans,
} from "@/services/establishment";
import { supabase } from "@/services/supabase";
import { OFFER_TO_PLAN_CODE, planCodeToOfferKey } from "@/utils/jovialProBilling";
import { isEstablishmentFicheComplete } from "@/utils/establishmentFiche";
import { Font } from "@/constants/typography";

type Interval = "month" | "year";

export default function EstablishmentOffersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [interval, setInterval] = useState<Interval>("year");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [nextPlans, nextPrices] = await Promise.all([
          listSubscriptionPlans().catch(() => []),
          listSubscriptionPlanPrices().catch(() => []),
        ]);
        const venue = userId ? await fetchRealVenueByOwner(userId).catch(() => null) : null;
        const sub = venue ? await getSubscription(venue.id).catch(() => null) : null;

        if (!cancelled) {
          setSubscription(sub);
          setPlans(nextPlans);
          setPrices(nextPrices);

          if (sub?.status === "active" && venue && isEstablishmentFicheComplete(venue)) {
            router.replace("/establishment/dashboard");
            return;
          }
          if (sub?.status === "active" && venue) {
            router.replace("/establishment/profile");
            return;
          }
        }
      } catch {
        if (!cancelled) {
          setSubscription(null);
          setPlans([]);
          setPrices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [router, userId]);

  const currentOfferKey = useMemo(() => {
    if (!subscription || subscription.status !== "active") return null;
    return planCodeToOfferKey(subscription.plan);
  }, [subscription]);

  const getPrice = (offerKey: string, ivl: Interval) => {
    const planCode = OFFER_TO_PLAN_CODE[offerKey as keyof typeof OFFER_TO_PLAN_CODE];
    if (!planCode) return null;
    const plan = plans.find((p) => p.code === planCode);
    if (!plan) return null;
    return prices.find((p) => p.plan_id === plan.id && p.interval === ivl && p.active) ?? null;
  };

  const savings = (offerKey: string) => {
    const monthly = getPrice(offerKey, "month");
    const yearly = getPrice(offerKey, "year");
    if (!monthly || !yearly) return null;
    const monthlyAnnual = (monthly.price_cents / 100) * 12;
    const annualTotal = yearly.price_cents / 100;
    const pct = Math.round(((monthlyAnnual - annualTotal) / monthlyAnnual) * 100);
    return pct > 0 ? pct : null;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#111827"} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.brandLogoCenter} pointerEvents="none">
          <Image
            source={require("../../assets/images/logo_jovial.png")}
            style={styles.brandLogoTop}
            resizeMode="contain"
          />
        </View>
        {session ? (
          <Pressable
            style={styles.topBarLink}
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace("/establishment/offers");
            }}
          >
            <Ionicons name="log-out-outline" size={15} color={"#9CA3AF"} />
            <Text style={styles.topBarLinkText}>Déconnexion</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.topBarLink}
            onPress={() => router.push("/establishment/login")}
          >
            <Ionicons name="log-in-outline" size={15} color={"#111827"} />
            <Text style={[styles.topBarLinkText, { color: "#111827" }]}>Se connecter</Text>
          </Pressable>
        )}
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Tarifs & Offres</Text>
        <Text style={styles.heroTitle}>Choisissez votre formule</Text>
        <Text style={styles.heroDesc}>
          30 jours offerts à l'activation — aucun paiement avant la validation finale.
        </Text>
      </View>

      {/* Interval toggle */}
      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, interval === "month" && styles.toggleBtnActive]}
            onPress={() => setInterval("month")}
          >
            <Text style={[styles.toggleBtnText, interval === "month" && styles.toggleBtnTextActive]}>
              Mensuel
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, interval === "year" && styles.toggleBtnActive]}
            onPress={() => setInterval("year")}
          >
            <Text style={[styles.toggleBtnText, interval === "year" && styles.toggleBtnTextActive]}>
              Annuel
            </Text>
            {interval === "year" && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>−19%</Text>
              </View>
            )}
          </Pressable>
        </View>
        <Text style={styles.commitmentNote}>
          <Ionicons name="information-circle-outline" size={13} color={"#9CA3AF"} />
          {" "}Engagement minimum 1 an — paiement mensuel ou annuel au choix
        </Text>
      </View>

      {/* Cards */}
      <View style={[styles.cardsRow, isDesktop && styles.cardsRowDesktop]}>
        {JOVIAL_PRO_OFFERS.map((offer) => {
          const isCurrent = offer.key === currentOfferKey;
          const price = getPrice(offer.key, interval);
          const yearPrice = getPrice(offer.key, "year");
          const saving = savings(offer.key);

          return (
            <Pressable
              key={offer.key}
              style={[
                styles.card,
                offer.recommended && styles.cardRecommended,
                offer.key === "pro" && !isCurrent && styles.cardPro,
                isCurrent && styles.cardCurrent,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/establishment/subscription/[offer]",
                  params: { offer: offer.key, interval },
                })
              }
            >
              {/* Recommended banner */}
              {offer.recommended && !isCurrent && currentOfferKey !== "pro" && (
                <View style={styles.recommendedBanner}>
                  <Ionicons name="star" size={11} color={"#111827"} />
                  <Text style={styles.recommendedBannerText}>Recommandée</Text>
                </View>
              )}
              {/* Badge Pro — visible pour tous sauf abonnés Pro actifs */}
              {offer.key === "pro" && !isCurrent && (
                <View style={[styles.recommendedBanner, styles.upsellBanner]}>
                  <Ionicons name="flash" size={11} color={Pastel.teal} />
                  <Text style={[styles.recommendedBannerText, styles.upsellBannerText]}>Le plus complet</Text>
                </View>
              )}
              {isCurrent && (
                <View style={[styles.recommendedBanner, styles.currentBanner]}>
                  <Ionicons name="checkmark-circle" size={11} color="#059669" />
                  <Text style={[styles.recommendedBannerText, styles.currentBannerText]}>Active</Text>
                </View>
              )}

              {/* Card header */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{offer.name}</Text>
                <Text style={styles.cardLabel}>{offer.shortLabel}</Text>
              </View>

              {/* Price */}
              <View style={styles.priceBlock}>
                {price ? (
                  <>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceAmount}>
                        {(price.price_cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })}€
                      </Text>
                      <Text style={styles.priceUnit}>
                        /{interval === "year" ? "an" : "mois"}
                      </Text>
                    </View>
                    {interval === "month" && yearPrice && saving ? (
                      <Text style={styles.priceSavingsHint}>
                        Économisez {saving}% en passant à l'annuel
                      </Text>
                    ) : null}
                    {interval === "year" && saving ? (
                      <View style={styles.savingsPill}>
                        <Text style={styles.savingsPillText}>Vous économisez {saving}%</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.priceNA}>
                    {offer.annualPrice}€{interval === "year" ? "/an" : ` (${offer.monthlyPrice}€/mois)`}
                  </Text>
                )}
              </View>

              <Text style={styles.cardSummary}>{offer.summary}</Text>

              {/* Features */}
              <View style={styles.featureList}>
                {offer.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={15} color={offer.recommended ? "#2B4E93" : "#10B981"} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <View
                style={[
                  styles.cardCta,
                  offer.recommended && styles.cardCtaRecommended,
                  offer.key === "pro" && !isCurrent && styles.cardCtaPro,
                  isCurrent && styles.cardCtaCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.cardCtaText,
                    (offer.recommended || offer.key === "pro" || isCurrent) && styles.cardCtaTextLight,
                  ]}
                >
                  {isCurrent ? "Voir mon abonnement" : offer.primaryCta}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={(offer.recommended || offer.key === "pro" || isCurrent) ? "#FFFFFF" : "#2B4E93"}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Bottom reassurance */}
      <View style={styles.reassurance}>
        {REASSURANCE.map((item) => (
          <View key={item.label} style={styles.reassuranceItem}>
            <Ionicons name={item.icon as any} size={18} color={"#111827"} />
            <View style={styles.reassuranceText}>
              <Text style={styles.reassuranceLabel}>{item.label}</Text>
              <Text style={styles.reassuranceDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const REASSURANCE = [
  {
    icon: "gift-outline",
    label: `30 jours offerts`,
    desc: "Aucun prélèvement pendant la période d'essai.",
  },
  {
    icon: "lock-closed-outline",
    label: "Paiement sécurisé",
    desc: "Powered by Stripe — données jamais stockées sur nos serveurs.",
  },
  {
    icon: "headset-outline",
    label: "Accompagnement dédié",
    desc: "Notre équipe vous aide à configurer votre fiche.",
  },
];

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8faff" },
  content: {
    padding: 20,
    paddingBottom: 56,
    gap: 28,
  },
  contentDesktop: {
    maxWidth: 1120,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8faff",
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 8,
    position: "relative",
    minHeight: 94,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandLogoCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 8,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoTop: {
    width: 230,
    height: 86,
  },
  logoMini: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#2B4E93",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMiniText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: Font.extraBold,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  brandLabel: {
    color: "#111827",
    fontSize: 16,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  topBarLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  topBarLinkText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },

  // Hero
  hero: { gap: 8 },
  heroEyebrow: {
    color: "#111827",
    fontSize: 12,
    fontFamily: Font.extraBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    includeFontPadding: false,
  },
  heroTitle: {
    color: "#111827",
    fontSize: 36,
    fontFamily: Font.extraBold,
    letterSpacing: -1,
    includeFontPadding: false,
  },
  heroDesc: {
    color: "#9CA3AF",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 520,
    includeFontPadding: false,
  },

  // Toggle
  toggleWrap: { gap: 10, alignItems: "flex-start" },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 4,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: "#2B4E93",
    shadowColor: "#2B4E93",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleBtnText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  toggleBtnTextActive: {
    color: "#FFFFFF",
  },
  savingsBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  savingsBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  commitmentNote: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },

  // Cards
  cardsRow: {
    gap: 16,
  },
  cardsRowDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 22,
    gap: 16,
    overflow: "hidden",
  },
  cardRecommended: {
    borderColor: "#2B4E93",
    borderWidth: 2,
    backgroundColor: "#FAFCFF",
  },
  cardPro: {
    borderColor: Pastel.teal,
    borderWidth: 2,
    backgroundColor: "#F6FEFE",
  },
  cardCurrent: {
    borderColor: "#059669",
    borderWidth: 2,
    backgroundColor: "#F0FDF4",
  },

  // Banners
  recommendedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2B4E93",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recommendedBannerText: {
    color: "#2B4E93",
    fontSize: 11,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  currentBanner: {
    backgroundColor: "#D1FAE5",
  },
  currentBannerText: {
    color: "#059669",
  },
  upsellBanner: {
    backgroundColor: Pastel.tealSoft,
    borderWidth: 1,
    borderColor: Pastel.teal,
  },
  upsellBannerText: {
    color: Pastel.teal,
  },

  cardHeader: { gap: 3 },
  cardName: { color: "#111827", fontSize: 22, fontFamily: Font.extraBold, letterSpacing: -0.5, includeFontPadding: false },
  cardLabel: { color: "#9CA3AF", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },

  // Price
  priceBlock: { gap: 5 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  priceAmount: {
    color: "#111827",
    fontSize: 40,
    fontFamily: Font.extraBold,
    letterSpacing: -1,
    lineHeight: 44,
    includeFontPadding: false,
  },
  priceUnit: {
    color: "#9CA3AF",
    fontSize: 16,
    fontFamily: Font.bold,
    paddingBottom: 5,
    includeFontPadding: false,
  },
  priceSavingsHint: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },
  savingsPill: {
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  savingsPillText: {
    color: "#059669",
    fontSize: 12,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  priceNA: {
    color: "#111827",
    fontSize: 24,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },

  cardSummary: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
  },

  // Features
  featureList: { gap: 9 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  featureText: { color: "#111827", fontSize: 13, lineHeight: 19, flex: 1, fontFamily: Font.semiBold, includeFontPadding: false },

  // Card CTA
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 4,
  },
  cardCtaRecommended: {
    backgroundColor: "#2B4E93",
    borderColor: "#2B4E93",
    shadowColor: "#2B4E93",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardCtaPro: {
    backgroundColor: Pastel.teal,
    borderColor: Pastel.teal,
    shadowColor: Pastel.teal,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardCtaCurrent: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  cardCtaText: {
    color: "#2B4E93",
    fontSize: 14,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  cardCtaTextLight: {
    color: "#FFFFFF",
  },

  // Reassurance
  reassurance: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 22,
    gap: 18,
  },
  reassuranceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  reassuranceText: { flex: 1, gap: 2 },
  reassuranceLabel: { color: "#111827", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  reassuranceDesc: { color: "#9CA3AF", fontSize: 13, lineHeight: 19, includeFontPadding: false },
});
