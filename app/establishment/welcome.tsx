import {
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
import { Font } from "@/constants/typography";

let logoSource: ReturnType<typeof require> | null = null;
try {
  logoSource = require("@/assets/images/jovial-logo.png");
} catch {
  logoSource = null;
}

export default function EstablishmentWelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  const goToOffers = () => router.push("/establishment/offers");
  const goToLogin = () => router.push("/establishment/login");

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── NAV ── */}
      <View style={[styles.nav, isDesktop && styles.navDesktop]}>
        <View style={styles.brandRow}>
          {logoSource ? (
            <Image source={logoSource} style={styles.logoImg} resizeMode="contain" />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>J</Text>
            </View>
          )}
          <View>
            <Text style={styles.brandName}>Jovial</Text>
            <Text style={styles.brandSub}>Espace Partenaire</Text>
          </View>
        </View>
        <Pressable style={styles.loginBtn} onPress={goToLogin}>
          <Ionicons name="log-in-outline" size={15} color={"#111827"} />
          <Text style={styles.loginBtnText}>Se connecter</Text>
        </Pressable>
      </View>

      {/* ── 1. HERO ── */}
      <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
        <View style={styles.heroTag}>
          <View style={styles.heroDot} />
          <Text style={styles.heroTagText}>30 jours offerts à l'activation</Text>
        </View>

        <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>
          Remplissez votre{"\n"}établissement.{"\n"}
          <Text style={styles.heroTitleAccent}>Sans effort.</Text>
        </Text>

        <Text style={styles.heroDesc}>
          Jovial vous permet d'attirer plus de clients, gérer vos réservations et créer une vraie
          communauté locale — tout depuis une seule plateforme.
        </Text>

        <View style={styles.heroTrust}>
          {["Paiement sécurisé", "30 jours offerts", "Support dédié"].map((t, i) => (
            <View key={t} style={styles.heroTrustItem}>
              {i > 0 && <View style={styles.heroTrustSep} />}
              <Ionicons name="checkmark-circle" size={13} color={"#10B981"} />
              <Text style={styles.heroTrustText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.heroCtas, isDesktop && styles.heroCtasDesktop]}>
          <Pressable style={styles.heroPrimaryBtn} onPress={goToOffers}>
            <Text style={styles.heroPrimaryBtnText}>Choisir mon offre</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.heroSecondaryBtn} onPress={() => {}}>
            <Ionicons name="play-circle-outline" size={16} color={"#111827"} />
            <Text style={styles.heroSecondaryBtnText}>Voir comment ça marche</Text>
          </Pressable>
        </View>
      </View>

      {/* ── 2. PROBLÈME → SOLUTION ── */}
      <View style={styles.section}>
        <View style={[styles.problemBlock, isDesktop && styles.problemBlockDesktop]}>
          <View style={styles.problemLeft}>
            <Text style={styles.sectionEyebrow}>Le constat</Text>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              Gérer un établissement aujourd'hui, c'est compliqué.
            </Text>
            <View style={styles.painList}>
              {PAIN_POINTS.map((p) => (
                <View key={p} style={styles.painItem}>
                  <View style={styles.painDot} />
                  <Text style={styles.painText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.solutionRight}>
            <View style={styles.solutionCard}>
              <View style={styles.solutionIconWrap}>
                <Ionicons name="flash" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.solutionTitle}>Avec Jovial, tout devient simple.</Text>
              <Text style={styles.solutionDesc}>
                Une seule plateforme. Tout ce dont votre établissement a besoin pour
                attirer, fidéliser et piloter — sans se disperser.
              </Text>
              <Pressable style={styles.solutionCta} onPress={goToOffers}>
                <Text style={styles.solutionCtaText}>Découvrir la solution</Text>
                <Ionicons name="arrow-forward" size={14} color={"#111827"} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* ── 3. VALEUR ── */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Ce que Jovial change pour vous</Text>
        <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
          Les bénéfices concrets, pas les fonctionnalités.
        </Text>
        <View style={[styles.valueGrid, isDesktop && styles.valueGridDesktop]}>
          {VALUE_CARDS.map((card) => (
            <View key={card.title} style={styles.valueCard}>
              <View style={styles.valueIconWrap}>
                <Ionicons name={card.icon as any} size={20} color={"#111827"} />
              </View>
              <Text style={styles.valueCardTitle}>{card.title}</Text>
              <Text style={styles.valueCardDesc}>{card.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 4. TRANSFORMATION ── */}
      <View style={styles.transformBlock}>
        <Text style={styles.transformEyebrow}>La transformation</Text>
        <Text style={[styles.transformTitle, isDesktop && styles.transformTitleDesktop]}>
          Passez d'un établissement discret{"\n"}à un lieu incontournable.
        </Text>

        <View style={[styles.beforeAfterRow, isDesktop && styles.beforeAfterRowDesktop]}>
          <View style={[styles.beforeCard, isDesktop && styles.beforeAfterCardDesktop]}>
            <View style={styles.beforeAfterHeader}>
              <View style={styles.beforeDotWrap}>
                <Ionicons name="close" size={14} color="#DC2626" />
              </View>
              <Text style={styles.beforeAfterLabel}>Sans Jovial</Text>
            </View>
            {BEFORE_ITEMS.map((item) => (
              <View key={item} style={styles.beforeAfterItem}>
                <Ionicons name="remove-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.beforeItemText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.afterCard, isDesktop && styles.beforeAfterCardDesktop]}>
            <View style={styles.beforeAfterHeader}>
              <View style={styles.afterDotWrap}>
                <Ionicons name="checkmark" size={14} color="#059669" />
              </View>
              <Text style={[styles.beforeAfterLabel, styles.afterLabel]}>Avec Jovial</Text>
            </View>
            {AFTER_ITEMS.map((item) => (
              <View key={item} style={styles.beforeAfterItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.afterItemText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── 5. RASSURANCE ── */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Conçu pour vous</Text>
        <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
          Pensé pour les établissements{"\n"}qui veulent grandir.
        </Text>
        <View style={[styles.reassuranceGrid, isDesktop && styles.reassuranceGridDesktop]}>
          {REASSURANCE.map((item) => (
            <View key={item.label} style={styles.reassuranceCard}>
              <View style={styles.reassuranceIconWrap}>
                <Ionicons name={item.icon as any} size={20} color={"#111827"} />
              </View>
              <Text style={styles.reassuranceLabel}>{item.label}</Text>
              <Text style={styles.reassuranceDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 6. CTA FINAL ── */}
      <View style={styles.finalCta}>
        <Text style={styles.finalCtaEyebrow}>30 jours offerts à l'inscription</Text>
        <Text style={[styles.finalCtaTitle, isDesktop && styles.finalCtaTitleDesktop]}>
          Prêt à remplir{"\n"}votre établissement ?
        </Text>
        <Text style={styles.finalCtaDesc}>
          Rejoignez Jovial en moins de 2 minutes.{"\n"}
          Aucun paiement avant la validation finale.
        </Text>
        <Pressable style={styles.finalCtaBtn} onPress={goToOffers}>
          <Text style={styles.finalCtaBtnText}>Choisir mon offre maintenant</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  "Trop d'outils différents à gérer",
  "Difficulté à remplir certains créneaux",
  "Peu de fidélisation client",
  "Communication dispersée sur plusieurs canaux",
];

const VALUE_CARDS = [
  {
    icon: "map-outline",
    title: "Attirez plus de clients localement",
    desc: "Soyez visible là où vos clients vous cherchent et apparaissez comme une référence autour de vous.",
  },
  {
    icon: "calendar-outline",
    title: "Remplissez votre agenda automatiquement",
    desc: "Publiez vos événements, gérez les inscriptions et envoyez des rappels sans effort.",
  },
  {
    icon: "people-circle-outline",
    title: "Fidélisez avec votre propre communauté",
    desc: "Créez un espace où vos clients reviennent, interagissent et s'engagent.",
  },
  {
    icon: "bookmark-outline",
    title: "Gérez vos réservations simplement",
    desc: "Centralisez et suivez toutes vos réservations depuis un seul tableau de bord.",
  },
  {
    icon: "gift-outline",
    title: "Offrez des avantages qui font revenir",
    desc: "Récompensez vos clients fidèles avec des offres exclusives réservées aux membres Jovial.",
  },
  {
    icon: "bar-chart-outline",
    title: "Pilotez votre activité en temps réel",
    desc: "Accédez à vos statistiques et prenez de meilleures décisions.",
  },
];

const BEFORE_ITEMS = [
  "Agenda irrégulier et creux",
  "Peu de clients fidèles",
  "Communication dispersée",
  "Aucune visibilité sur vos résultats",
];

const AFTER_ITEMS = [
  "Agenda rempli et actif",
  "Clients engagés et fidèles",
  "Activité centralisée et optimisée",
  "Décisions basées sur des données réelles",
];

const REASSURANCE = [
  {
    icon: "layers-outline",
    label: "Solution tout-en-un",
    desc: "Un seul outil pour gérer votre visibilité, vos réservations, votre communauté et vos événements.",
  },
  {
    icon: "flash-outline",
    label: "Mise en place en quelques minutes",
    desc: "Créez votre compte et activez votre fiche établissement sans formation ni technicité.",
  },
  {
    icon: "shield-checkmark-outline",
    label: "Aucun engagement compliqué",
    desc: "Engagement annuel simple et transparent. 30 jours offerts pour tester sans risque.",
  },
  {
    icon: "headset-outline",
    label: "Accompagnement dédié",
    desc: "Notre équipe est là pour vous aider à configurer votre fiche et tirer le meilleur de Jovial.",
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { paddingBottom: 64 },

  // Nav
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  navDesktop: {
    maxWidth: 1080,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 40,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoImg: { width: 44, height: 44, borderRadius: 12 },
  logoFallback: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  logoFallbackText: { color: "#FFFFFF", fontSize: 24, fontFamily: Font.extraBold, letterSpacing: -1, includeFontPadding: false },
  brandName: { color: "#111827", fontSize: 19, fontFamily: Font.extraBold, letterSpacing: -0.5, includeFontPadding: false },
  brandSub: { color: "#9CA3AF", fontSize: 11, fontFamily: Font.semiBold, includeFontPadding: false },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  loginBtnText: { color: "#111827", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 48,
    gap: 20,
  },
  heroDesktop: {
    maxWidth: 1080,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 40,
    paddingTop: 64,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "#10B981",
  },
  heroTagText: { color: "#065F46", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  heroTitle: {
    fontSize: 44,
    fontFamily: Font.extraBold,
    color: "#111827",
    letterSpacing: -1.5,
    lineHeight: 52,
    includeFontPadding: false,
  },
  heroTitleDesktop: { fontSize: 60, lineHeight: 68 },
  heroTitleAccent: { color: "#111827" },
  heroDesc: {
    fontSize: 16,
    color: "#9CA3AF",
    lineHeight: 26,
    maxWidth: 540,
    includeFontPadding: false,
  },
  heroTrust: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  heroTrustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroTrustSep: {
    width: 3,
    height: 3,
    borderRadius: 99,
    backgroundColor: "#E5E7EB",
    marginRight: 4,
  },
  heroTrustText: { color: "#9CA3AF", fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  heroCtas: { gap: 12 },
  heroCtasDesktop: { flexDirection: "row", alignItems: "center" },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 28,
    alignSelf: "flex-start",
    shadowColor: "#111827",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  heroPrimaryBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
  },
  heroSecondaryBtnText: { color: "#111827", fontSize: 15, fontFamily: Font.bold, includeFontPadding: false },

  // Shared section wrapper
  section: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
    maxWidth: 1080,
    alignSelf: "center",
    width: "100%",
  },
  sectionEyebrow: {
    color: "#111827",
    fontSize: 12,
    fontFamily: Font.extraBold,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    includeFontPadding: false,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 30,
    fontFamily: Font.extraBold,
    letterSpacing: -0.8,
    lineHeight: 38,
    includeFontPadding: false,
  },
  sectionTitleDesktop: { fontSize: 38, lineHeight: 46 },

  // Problem / Solution
  problemBlock: { gap: 24 },
  problemBlockDesktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  problemLeft: { flex: 1, gap: 20 },
  painList: { gap: 12 },
  painItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  painDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "#DC2626",
    marginTop: 6,
    flexShrink: 0,
  },
  painText: { color: "#111827", fontSize: 15, lineHeight: 22, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  solutionRight: { flex: 1 },
  solutionCard: {
    backgroundColor: "#0F172A",
    borderRadius: 26,
    padding: 26,
    gap: 14,
  },
  solutionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  solutionTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: Font.extraBold, lineHeight: 27, includeFontPadding: false },
  solutionDesc: { color: "rgba(255,255,255,0.62)", fontSize: 14, lineHeight: 22, includeFontPadding: false },
  solutionCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  solutionCtaText: { color: "#111827", fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },

  // Value
  valueGrid: { gap: 12 },
  valueGridDesktop: { flexDirection: "row", flexWrap: "wrap" },
  valueCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 10,
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 260,
  },
  valueIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  valueCardTitle: { color: "#111827", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
  valueCardDesc: { color: "#9CA3AF", fontSize: 13, lineHeight: 20, includeFontPadding: false },

  // Transformation
  transformBlock: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 28,
  },
  transformEyebrow: {
    color: "#111827",
    fontSize: 12,
    fontFamily: Font.extraBold,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    textAlign: "center",
    includeFontPadding: false,
  },
  transformTitle: {
    color: "#111827",
    fontSize: 30,
    fontFamily: Font.extraBold,
    letterSpacing: -0.8,
    lineHeight: 38,
    textAlign: "center",
    includeFontPadding: false,
  },
  transformTitleDesktop: { fontSize: 38, lineHeight: 46 },
  beforeAfterRow: {
    gap: 16,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  beforeAfterRowDesktop: { flexDirection: "row" },
  beforeCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF5F5",
    padding: 20,
    gap: 14,
  },
  afterCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#F0FDF4",
    padding: 20,
    gap: 14,
  },
  beforeAfterCardDesktop: { flex: 1 },
  beforeAfterHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  beforeDotWrap: {
    width: 26,
    height: 26,
    borderRadius: 99,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  afterDotWrap: {
    width: 26,
    height: 26,
    borderRadius: 99,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  beforeAfterLabel: { color: "#7F1D1D", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  afterLabel: { color: "#065F46" },
  beforeAfterItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  beforeItemText: { color: "#991B1B", fontSize: 14, lineHeight: 21, flex: 1, fontFamily: Font.semiBold, includeFontPadding: false },
  afterItemText: { color: "#065F46", fontSize: 14, lineHeight: 21, flex: 1, fontFamily: Font.semiBold, includeFontPadding: false },

  // Reassurance
  reassuranceGrid: { gap: 12 },
  reassuranceGridDesktop: { flexDirection: "row", flexWrap: "wrap" },
  reassuranceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 10,
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
  },
  reassuranceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  reassuranceLabel: { color: "#111827", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  reassuranceDesc: { color: "#9CA3AF", fontSize: 13, lineHeight: 20, includeFontPadding: false },

  // Final CTA
  finalCta: {
    margin: 20,
    marginTop: 8,
    backgroundColor: "#0F172A",
    borderRadius: 30,
    padding: 36,
    alignItems: "center",
    gap: 16,
  },
  finalCtaEyebrow: {
    color: "#10B981",
    fontSize: 13,
    fontFamily: Font.extraBold,
    textTransform: "uppercase",
    letterSpacing: 1,
    includeFontPadding: false,
  },
  finalCtaTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontFamily: Font.extraBold,
    letterSpacing: -1,
    lineHeight: 42,
    textAlign: "center",
    includeFontPadding: false,
  },
  finalCtaTitleDesktop: { fontSize: 44, lineHeight: 52 },
  finalCtaDesc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 400,
    includeFontPadding: false,
  },
  finalCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 30,
    shadowColor: "#111827",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginTop: 4,
  },
  finalCtaBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },
});
