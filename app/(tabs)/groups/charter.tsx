import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type CharterSection = { title: string; body: string };

export default function GroupCharterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    returnTo, joinAfter,
    draftName, draftDescription, draftTopicId, draftCategory,
    draftPlaceId, draftPlaceLabel, draftVisibility, draftStep,
    draftAvatarUri, draftCoverUri,
  } = useLocalSearchParams<{
    returnTo?: string; joinAfter?: string;
    draftName?: string; draftDescription?: string; draftTopicId?: string;
    draftCategory?: string; draftPlaceId?: string; draftPlaceLabel?: string;
    draftVisibility?: "public" | "private"; draftStep?: string;
    draftAvatarUri?: string; draftCoverUri?: string;
  }>();
  const [canAccept, setCanAccept] = useState(false);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const sections = useMemo<CharterSection[]>(() => [
    {
      title: "Bienvenue dans l'espace Club de Jovial 🎉",
      body: "Un lieu communautaire où l'on se retrouve autour de passions communes, pour échanger, partager, débattre et créer du lien dans un esprit convivial.\n\nEn rejoignant ou en créant un club, tu t'engages à respecter cette charte, pensée pour garantir une expérience positive, sûre et respectueuse pour tous.",
    },
    {
      title: "1. Respect & bienveillance",
      body: "Jovial est un espace ouvert, inclusif et accueillant.\nChaque membre s'engage à faire preuve de respect, de courtoisie et d'écoute envers les autres, quelles que soient leurs opinions, leurs origines ou leurs passions.\n\n👉 Les échanges doivent rester constructifs, même en cas de désaccord.",
    },
    {
      title: "2. Tolérance zéro pour la haine",
      body: "Aucun propos discriminatoire, raciste, sexiste, homophobe, transphobe, validiste ou haineux n'est toléré.\nCela inclut les insinuations, l'humour blessant, les attaques déguisées ou toute forme de stigmatisation.",
    },
    {
      title: "3. Harcèlement & intimidation",
      body: "Le harcèlement, les menaces, la pression sociale, le stalking ou toute forme d'intimidation sont strictement interdits.\nChacun doit pouvoir s'exprimer librement, sans crainte ni malaise.",
    },
    {
      title: "4. Consentement & limites",
      body: "Le consentement est essentiel.\nToute interaction (discussion sensible, photo, vidéo, message privé ou rencontre) doit respecter les limites de chacun.\n\n👉 Un « non » est toujours valable et doit toujours être respecté.",
    },
    {
      title: "5. Sécurité & responsabilité",
      body: "Chaque membre est responsable de son comportement et veille à la sécurité des autres.\nEn cas de situation à risque ou de comportement inapproprié, il est demandé de le signaler rapidement.",
    },
    {
      title: "6. Alcool & comportements à risque",
      body: "Jovial encourage des moments festifs responsables.\nLes comportements dangereux, agressifs ou irresponsables, notamment liés à la consommation d'alcool ou de stupéfiants, ne sont pas tolérés.",
    },
    {
      title: "7. Contenus partagés",
      body: "Les contenus publiés (messages, photos, commentaires, événements) doivent :\n• être respectueux et appropriés,\n• respecter la loi,\n• ne pas porter atteinte à la dignité ou à la vie privée d'autrui.\n\nTout contenu choquant, illégal ou inadapté pourra être supprimé.",
    },
    {
      title: "8. Confidentialité & vie privée",
      body: "Ne partage jamais d'informations personnelles concernant un autre membre sans son accord explicite.\nLa confiance est essentielle au bon fonctionnement de la communauté.",
    },
    {
      title: "9. Signalement",
      body: "Tout comportement ou contenu inapproprié peut être signalé.\nLes signalements sont pris au sérieux et traités avec attention et confidentialité.",
    },
    {
      title: "10. Sanctions",
      body: "Le non-respect de cette charte peut entraîner, selon la gravité :\n• un avertissement,\n• une suspension temporaire,\n• un bannissement définitif du club ou de la plateforme.",
    },
    {
      title: "🤝 Engagement",
      body: "En rejoignant ou en créant un club sur Jovial, tu t'engages à :\n• respecter cette charte,\n• contribuer à une ambiance positive,\n• protéger l'expérience et le bien-être de chaque membre.",
    },
  ], []);

  const handleAccept = () => {
    if (!canAccept) return;
    router.replace({
      pathname: (returnTo ?? "/groups/new") as any,
      params: {
        charterAccepted: "1",
        ...(joinAfter ? { joinAfter } : {}),
        ...(typeof draftName === "string" ? { draftName } : {}),
        ...(typeof draftDescription === "string" ? { draftDescription } : {}),
        ...(typeof draftTopicId === "string" ? { draftTopicId } : {}),
        ...(typeof draftCategory === "string" ? { draftCategory } : {}),
        ...(typeof draftPlaceId === "string" ? { draftPlaceId } : {}),
        ...(typeof draftPlaceLabel === "string" ? { draftPlaceLabel } : {}),
        ...(typeof draftVisibility === "string" ? { draftVisibility } : {}),
        ...(typeof draftStep === "string" ? { draftStep } : {}),
        ...(typeof draftAvatarUri === "string" ? { draftAvatarUri } : {}),
        ...(typeof draftCoverUri === "string" ? { draftCoverUri } : {}),
      },
    });
  };

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) setCanAccept(true);
  };

  const handleLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    const h = event.nativeEvent.layout.height;
    setLayoutHeight(h);
    if (contentHeight > 0 && contentHeight <= h) setCanAccept(true);
  };

  const handleContentSizeChange = (_: number, h: number) => {
    setContentHeight(h);
    if (layoutHeight > 0 && h <= layoutHeight) setCanAccept(true);
  };

  return (
    <View style={styles.screen}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Charte de respect 😉</Text>
          <Text style={styles.headerSub}>Lis attentivement avant de rejoindre un club.</Text>
        </View>
      </View>

      {/* ── CONTENU ── */}
      <View style={styles.content} onLayout={handleLayout}>
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
        >
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionText}>{section.body}</Text>
            </View>
          ))}
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>

      {/* ── FOOTER ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        {!canAccept ? (
          <View style={styles.scrollHint}>
            <Ionicons name="arrow-down" size={14} color={Pastel.textMuted} />
            <Text style={styles.scrollHintText}>Fais défiler jusqu'en bas pour accepter.</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.primaryBtn, !canAccept ? styles.primaryBtnDisabled : null]}
          onPress={handleAccept}
          disabled={!canAccept}
        >
          <Text style={styles.primaryBtnText}>J'ai lu et j'accepte la charte</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  headerSub: { fontSize: 12, color: Pastel.textMuted, marginTop: 1, fontFamily: Font.regular, includeFontPadding: false },

  content: { flex: 1, paddingHorizontal: 20 },
  scrollBody: { paddingTop: 20, paddingBottom: 8, gap: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  sectionText: { fontSize: 13, color: Pastel.textMuted, lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
  },
  scrollHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  scrollHintText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  primaryBtn: {
    backgroundColor: Pastel.primary,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 15, includeFontPadding: false },
});
