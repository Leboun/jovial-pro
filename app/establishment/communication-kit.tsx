import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import { EstablishmentProfile, getMyEstablishment } from "@/services/establishment";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

// TODO: remplacer par le lien stores (smart link) une fois l'appli publiée.
const APP_LINK = "https://getjovial.fr";

export default function CommunicationKitScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<EstablishmentProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const est = await getMyEstablishment(userId);
          if (!cancelled) setProfile(est);
        } catch {
          if (!cancelled) setProfile(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  const venueName = profile?.name?.trim() || "Ton établissement";

  const shareTexts = [
    `🎯 Retrouvez ${venueName} sur Jovial ! Découvrez nos jeux et événements, et réservez en quelques clics : ${APP_LINK}`,
    `On est sur Jovial ! 🎉 L'appli pour trouver des bars avec jeux & événements près de chez toi. Télécharge-la : ${APP_LINK}`,
    `Envie de sortir ce soir ? Retrouve ${venueName} et plein d'autres lieux sur Jovial 👉 ${APP_LINK}`,
  ];

  const copy = async (text: string, label = "Texte") => {
    try {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (Platform.OS === "web" && nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        Alert.alert("Copié !", `${label} copié dans le presse-papiers.`);
      } else {
        await Share.share({ message: text });
      }
    } catch {
      Alert.alert("Oups", "Impossible de copier automatiquement — sélectionne le texte manuellement.");
    }
  };

  const openUrl = (url: string) => Linking.openURL(url).catch(() => {});
  const shareNative = async () => {
    try {
      await Share.share({ message: shareTexts[0] });
    } catch {
      copy(shareTexts[0], "Message");
    }
  };
  const shareWhatsApp = () => openUrl(`https://wa.me/?text=${encodeURIComponent(shareTexts[0])}`);
  const shareFacebook = () => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_LINK)}`);

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
      title="Kit de communication"
      subtitle="Tout pour faire connaître ton établissement sur Jovial et tes réseaux sociaux."
      loading={loading}
    >
      {/* QR code */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.sectionBadge}><Ionicons name="qr-code-outline" size={16} color="#FFFFFF" /></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>QR code vers l'appli</Text>
            <Text style={styles.cardHint}>Imprime-le (sur ta carte, ta vitrine, tes flyers) : tes clients scannent et arrivent sur Jovial.</Text>
          </View>
        </View>
        <View style={styles.qrRow}>
          <View style={styles.qrTile}>
            <QRCode value={APP_LINK} size={150} color={Pastel.night} backgroundColor="#FFFFFF" />
          </View>
          <View style={styles.qrSide}>
            <Text style={styles.linkLabel}>Lien</Text>
            <Text style={styles.linkValue} numberOfLines={2}>{APP_LINK}</Text>
            <Pressable style={styles.btnOutline} onPress={() => copy(APP_LINK, "Lien")}>
              <Ionicons name="copy-outline" size={15} color={Pastel.primary} />
              <Text style={styles.btnOutlineText}>Copier le lien</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Visuel à partager */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.sectionBadge}><Ionicons name="image-outline" size={16} color="#FFFFFF" /></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Visuel prêt à partager</Text>
            <Text style={styles.cardHint}>Fais une capture d'écran de la carte ci-dessous et poste-la en story ou en publication.</Text>
          </View>
        </View>
        <View style={styles.poster}>
          <View style={styles.posterLogo}>
            {profile?.logo_url ? (
              <Image source={profile.logo_url} style={styles.posterLogoImg} contentFit="contain" />
            ) : (
              <Text style={styles.posterLogoLetter}>{venueName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.posterName} numberOfLines={2}>{venueName}</Text>
          <Text style={styles.posterTagline}>est sur</Text>
          <Text style={styles.posterBrand}>JOVIAL</Text>
          <View style={styles.posterQr}>
            <QRCode value={APP_LINK} size={92} color={Pastel.night} backgroundColor="#FFFFFF" />
          </View>
          <Text style={styles.posterFooter}>Scanne & découvre nos jeux et événements 🎯</Text>
        </View>
      </View>

      {/* Textes pré-rédigés */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.sectionBadge}><Ionicons name="chatbox-ellipses-outline" size={16} color="#FFFFFF" /></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Textes prêts à copier</Text>
            <Text style={styles.cardHint}>Choisis un texte et colle-le sur Instagram, Facebook, ta page Google…</Text>
          </View>
        </View>
        {shareTexts.map((text, i) => (
          <View key={i} style={styles.textBlock}>
            <Text style={styles.textBlockBody}>{text}</Text>
            <Pressable style={styles.btnOutline} onPress={() => copy(text, "Texte")}>
              <Ionicons name="copy-outline" size={15} color={Pastel.primary} />
              <Text style={styles.btnOutlineText}>Copier</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Partage direct */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.sectionBadge}><Ionicons name="share-social-outline" size={16} color="#FFFFFF" /></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Partager directement</Text>
            <Text style={styles.cardHint}>Partage le lien de l'appli en un clic.</Text>
          </View>
        </View>
        <View style={styles.shareRow}>
          <Pressable style={[styles.shareBtn, { backgroundColor: "#25D366" }]} onPress={shareWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>WhatsApp</Text>
          </Pressable>
          <Pressable style={[styles.shareBtn, { backgroundColor: "#1877F2" }]} onPress={shareFacebook}>
            <Ionicons name="logo-facebook" size={20} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>Facebook</Text>
          </Pressable>
          <Pressable style={[styles.shareBtn, { backgroundColor: Pastel.primary }]} onPress={shareNative}>
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>Autre…</Text>
          </Pressable>
        </View>
        <Pressable style={styles.btnOutlineWide} onPress={() => copy(shareTexts[0], "Message")}>
          <Ionicons name="logo-instagram" size={16} color={Pastel.primary} />
          <Text style={styles.btnOutlineText}>Copier pour Instagram</Text>
        </Pressable>
      </View>
    </JovialProShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerTitle: { fontSize: 22, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  btnPrimary: { backgroundColor: Pastel.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },

  card: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 18,
    gap: 14,
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sectionBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 16, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  cardHint: { fontSize: 13, fontFamily: Font.medium, color: Pastel.textMuted, lineHeight: 18, includeFontPadding: false },

  /* QR */
  qrRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  qrTile: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  qrSide: { flex: 1, gap: 8 },
  linkLabel: { fontSize: 12, fontFamily: Font.semiBold, color: Pastel.textMuted, includeFontPadding: false },
  linkValue: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },

  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Pastel.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnOutlineWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Pastel.primary,
    borderRadius: 999,
    paddingVertical: 11,
  },
  btnOutlineText: { fontSize: 13, fontFamily: Font.bold, color: Pastel.primary, includeFontPadding: false },

  /* Poster / visuel */
  poster: {
    backgroundColor: Pastel.primary,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 6,
  },
  posterLogo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 6,
  },
  posterLogoImg: { width: "100%", height: "100%" },
  posterLogoLetter: { fontSize: 32, fontFamily: Font.display, color: Pastel.primary, includeFontPadding: false },
  posterName: { fontSize: 20, fontFamily: Font.extraBold, color: "#FFFFFF", textAlign: "center", includeFontPadding: false },
  posterTagline: { fontSize: 13, fontFamily: Font.medium, color: "rgba(255,255,255,0.8)", includeFontPadding: false },
  posterBrand: { fontSize: 30, fontFamily: Font.display, color: "#FFFFFF", letterSpacing: 1, includeFontPadding: false, marginBottom: 8 },
  posterQr: { padding: 8, backgroundColor: "#FFFFFF", borderRadius: 12 },
  posterFooter: { fontSize: 12, fontFamily: Font.semiBold, color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 8, includeFontPadding: false },

  /* Textes */
  textBlock: {
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  textBlockBody: { fontSize: 14, fontFamily: Font.medium, color: Pastel.text, lineHeight: 20, includeFontPadding: false },

  /* Partage */
  shareRow: { flexDirection: "row", gap: 10 },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 12,
  },
  shareBtnText: { fontSize: 13, fontFamily: Font.extraBold, color: "#FFFFFF", includeFontPadding: false },
});
