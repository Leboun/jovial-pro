import { useEffect } from "react";
import { useRouter } from "expo-router";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../providers/AuthProvider";
import { isDesktopWeb } from "@/utils/platform";
import { useWindowDimensions } from "react-native";
import { Font } from "@/constants/typography";
import { Pastel } from "@/constants/pastel";

export default function WelcomeScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktopWeb = isDesktopWeb(width);

  useEffect(() => {
    if (loading) return;
    if (desktopWeb) {
      router.replace(session ? "/establishment/dashboard" : "/establishment/offers");
      return;
    }
    if (session) router.replace("/(tabs)/map");
  }, [desktopWeb, loading, session, router]);

  if (desktopWeb) return null;

  return (
    <>
      <StatusBar hidden={true} />
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* Étoiles décoratives */}
        <View style={styles.starsContainer}>
          {[...Array(18)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.star,
                {
                  top: `${Math.sin(i * 137.5) * 38 + 42}%` as any,
                  left: `${(i * 73) % 100}%` as any,
                  width: i % 3 === 0 ? 3 : 2,
                  height: i % 3 === 0 ? 3 : 2,
                  opacity: 0.3 + (i % 5) * 0.1,
                },
              ]}
            />
          ))}
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require("../assets/images/logo_jovial.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Contenu central */}
        <View style={styles.centerContent}>
          <Text style={styles.headline} adjustsFontSizeToFit numberOfLines={3}>LÀ OÙ{"\n"}LA SOIRÉE{"\n"}COMMENCE</Text>
          <Text style={styles.subline}>
            Découvre les meilleurs événements,{"\n"}les bons plans et les soirées{"\n"}près de chez toi !
          </Text>

          {/* CTA principal */}
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
            onPress={() => router.push("/(auth)/signup")}
            hitSlop={8}
          >
            <Text style={styles.ctaBtnText}>DÉCOUVRIR</Text>
          </Pressable>
        </View>

        {/* Lien connexion */}
        <Pressable style={styles.loginLink} onPress={() => router.push("/(auth)/login")} hitSlop={8}>
          <Text style={styles.loginLinkText}>J'ai déjà un compte</Text>
        </Pressable>

        <View style={{ height: insets.bottom || 16 }} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "space-between",
  },
  starsContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  star: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
  },
  logoSection: {
    alignItems: "center",
    marginTop: 36,
  },
  logoImage: {
    width: 380,
    height: 220,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 18,
  },
  headline: {
    color: Pastel.cream,
    fontSize: 52,
    fontFamily: Font.display,
    letterSpacing: 2,
    textAlign: "center",
    lineHeight: 58,
    includeFontPadding: false,
  },
  subline: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    fontFamily: Font.regular,
    lineHeight: 23,
    textAlign: "center",
    includeFontPadding: false,
  },
  ctaBtn: {
    marginTop: 8,
    backgroundColor: Pastel.orange,
    paddingVertical: 16,
    paddingHorizontal: 52,
    borderRadius: 14,
    shadowColor: Pastel.orange,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctaBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: Font.display,
    letterSpacing: 2,
    includeFontPadding: false,
  },
  loginLink: {
    paddingVertical: 8,
    marginBottom: 4,
  },
  loginLinkText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },
});
