import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Image as RNImage, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { Asset } from "expo-asset";
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

const VISUALS: { key: string; label: string; file: string; source: any }[] = [
  { key: "generique", label: "Générique", file: "jovial-generique.png", source: require("../../assets/comm-kit/generique.png") },
  { key: "flechette", label: "Fléchettes", file: "jovial-flechettes.png", source: require("../../assets/comm-kit/flechette.png") },
  { key: "danse", label: "Danse", file: "jovial-danse.png", source: require("../../assets/comm-kit/danse.png") },
  { key: "standup", label: "Stand-up", file: "jovial-standup.png", source: require("../../assets/comm-kit/stand-up.png") },
  { key: "sticker", label: "Sticker", file: "jovial-sticker.png", source: require("../../assets/comm-kit/sticker.png") },
  { key: "logo", label: "Logo Jovial", file: "jovial-logo.png", source: require("../../assets/images/logo_jovial.png") },
  { key: "mascotte", label: "Mascotte", file: "jovial-mascotte.png", source: require("../../assets/images/logo_mascotte.png") },
];

export default function CommunicationKitScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<EstablishmentProfile | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
    {
      label: "Facebook / Instagram",
      text: `🎉 Bonne nouvelle ! ${venueName} est désormais sur Jovial 🎯\n\nVous cherchez où jouer aux fléchettes, au billard, ou passer une super soirée ? Retrouvez-nous sur Jovial, l'appli qui référence les meilleurs lieux pour sortir et s'amuser près de chez vous !\n\n📲 Téléchargez l'appli, découvrez nos jeux & événements, et réservez en quelques clics.\n👉 ${APP_LINK}\n\n#Jovial #SortezJouer`,
    },
    {
      label: "LinkedIn",
      text: `Fiers d'annoncer que ${venueName} rejoint Jovial Pro 🎯\n\nJovial, c'est l'application qui connecte les établissements (bars, pubs, lieux de jeux…) à une communauté en quête de sorties conviviales : jeux, événements, soirées.\n\nGrâce à Jovial Pro, nous gagnons en visibilité, mettons en avant nos activités et touchons de nouveaux clients.\n\n👉 Vous gérez un établissement ? Découvrez Jovial Pro, ça vaut le coup.\n📲 Côté public : l'appli est dispo pour trouver votre prochaine sortie !\n\n${APP_LINK}\n#Jovial #JovialPro #Hospitality`,
    },
    {
      label: "Story Instagram (courte)",
      text: `On est sur Jovial ! 🎯 Nos jeux & événements sont dans l'appli 👉 ${APP_LINK}`,
    },
  ];

  const copy = async (text: string, key: string) => {
    try {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (Platform.OS === "web" && nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2200);
      } else {
        await Share.share({ message: text });
      }
    } catch {
      /* ignore */
    }
  };

  const openUrl = (url: string) => Linking.openURL(url).catch(() => {});
  const shareNative = async () => {
    try {
      await Share.share({ message: shareTexts[0].text });
    } catch {
      copy(shareTexts[0].text, "share");
    }
  };
  const shareWhatsApp = () => openUrl(`https://wa.me/?text=${encodeURIComponent(shareTexts[0].text)}`);
  const shareFacebook = () => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_LINK)}`);

  const downloadImage = async (source: any, filename: string) => {
    try {
      const asset = Asset.fromModule(source);
      if (Platform.OS === "web") {
        const doc: any = (globalThis as any).document;
        const uri = asset.uri || asset.localUri || RNImage.resolveAssetSource(source)?.uri;
        if (!uri) {
          Alert.alert("Oups", "Visuel introuvable.");
          return;
        }
        try {
          const res = await fetch(uri);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = doc.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          doc.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
        } catch {
          (globalThis as any).open?.(uri, "_blank");
        }
        return;
      }
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Autorisation requise", "Autorise l'accès aux photos pour enregistrer le visuel.");
        return;
      }
      await asset.downloadAsync();
      await MediaLibrary.saveToLibraryAsync(asset.localUri || asset.uri);
      Alert.alert("Téléchargé !", "Le visuel est enregistré dans ta galerie.");
    } catch {
      Alert.alert("Oups", "Téléchargement impossible.");
    }
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
            <Pressable style={styles.btnOutline} onPress={() => copy(APP_LINK, "link")}>
              <Ionicons name={copiedKey === "link" ? "checkmark" : "copy-outline"} size={15} color={Pastel.primary} />
              <Text style={styles.btnOutlineText}>{copiedKey === "link" ? "Copié !" : "Copier le lien"}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Visuels & logos à télécharger */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.sectionBadge}><Ionicons name="images-outline" size={16} color="#FFFFFF" /></View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Visuels & logos à télécharger</Text>
            <Text style={styles.cardHint}>Récupère nos visuels prêts à poster, ainsi que le logo et la mascotte Jovial.</Text>
          </View>
        </View>

        <View style={styles.charterNotice}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Pastel.primary} />
          <Text style={styles.charterNoticeText}>
            <Text style={styles.charterNoticeStrong}>Charte de marque — </Text>
            Le logo et la mascotte Jovial sont protégés. Tout visuel ou support de communication les utilisant doit être soumis à l'équipe Jovial pour validation avant publication. Contact : hello@getjovial.fr
          </Text>
        </View>

        <View style={styles.visualGrid}>
          {VISUALS.map((v) => (
            <View key={v.key} style={styles.visualItem}>
              <Image source={v.source} style={styles.visualThumb} contentFit="contain" />
              <Pressable style={styles.visualDownloadBtn} onPress={() => downloadImage(v.source, v.file)}>
                <Ionicons name="download-outline" size={15} color="#FFFFFF" />
                <Text style={styles.visualDownloadText}>{v.label}</Text>
              </Pressable>
            </View>
          ))}
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
        {shareTexts.map((t, i) => (
          <View key={i} style={styles.textBlock}>
            <Text style={styles.textBlockLabel}>{t.label}</Text>
            <Text style={styles.textBlockBody}>{t.text}</Text>
            <Pressable style={styles.btnOutline} onPress={() => copy(t.text, `text-${i}`)}>
              <Ionicons name={copiedKey === `text-${i}` ? "checkmark" : "copy-outline"} size={15} color={Pastel.primary} />
              <Text style={styles.btnOutlineText}>{copiedKey === `text-${i}` ? "Copié !" : "Copier"}</Text>
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

  /* Charte + galerie de visuels */
  charterNotice: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Pastel.primarySoft,
    borderRadius: 14,
    padding: 12,
    alignItems: "flex-start",
  },
  charterNoticeText: { flex: 1, fontSize: 12, fontFamily: Font.medium, color: Pastel.text, lineHeight: 17, includeFontPadding: false },
  charterNoticeStrong: { fontFamily: Font.extraBold, color: Pastel.primary },
  visualGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  visualItem: { width: "47%", flexGrow: 1, gap: 8 },
  visualThumb: { width: "100%", height: 150, borderRadius: 12, backgroundColor: Pastel.surfaceAlt },
  visualDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Pastel.primary,
    borderRadius: 999,
    paddingVertical: 9,
  },
  visualDownloadText: { fontSize: 12, fontFamily: Font.bold, color: "#FFFFFF", includeFontPadding: false },

  /* Textes */
  textBlock: {
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  textBlockLabel: { fontSize: 12, fontFamily: Font.extraBold, color: Pastel.primary, textTransform: "uppercase", letterSpacing: 0.5, includeFontPadding: false },
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
