import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { Font } from "@/constants/typography";

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const { email, offer, interval, next } = useLocalSearchParams<{
    email?: string;
    offer?: string;
    interval?: string;
    next?: string;
  }>();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailRedirectTo = Linking.createURL("auth/callback");

  const nextPath = typeof next === "string" && next.startsWith("/establishment/")
    ? next
    : "/establishment/dashboard";

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    setResending(true);
    setResent(false);
    try {
      await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });
      setResent(true);
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((v) => {
          if (v <= 1) { clearInterval(timer); return 0; }
          return v - 1;
        });
      }, 1000);
    } finally {
      setResending(false);
    }
  };

  const handleLogin = () => {
    router.replace({
      pathname: "/establishment/login",
      params: { next: nextPath },
    });
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconOuter}>
            <View style={styles.iconInner}>
              <Ionicons name="mail" size={34} color={"#2B4E93"} />
            </View>
          </View>
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          </View>
        </View>

        {/* Logo row */}
        <View style={styles.logoRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>J</Text>
          </View>
          <View>
            <Text style={styles.brandName}>Jovial Pro</Text>
            <Text style={styles.brandSub}>Espace Partenaire</Text>
          </View>
        </View>

        {/* Text */}
        <View style={styles.textBlock}>
          <Text style={styles.title}>Vérifiez votre boîte mail</Text>
          <Text style={styles.desc}>
            Nous avons envoyé un lien de confirmation à{"\n"}
            <Text style={styles.emailHighlight}>{email ?? "votre adresse e-mail"}</Text>.
          </Text>
          <Text style={styles.hint}>
            Cliquez sur le lien dans le mail pour activer votre compte, puis connectez-vous ici.
          </Text>
        </View>

        {/* Steps */}
        <View style={styles.stepsBlock}>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Primary CTA */}
        <Pressable
          style={styles.primaryBtn}
          onPress={handleLogin}
        >
          <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Se connecter</Text>
        </Pressable>

        {/* Resend */}
        <View style={styles.resendBlock}>
          <Text style={styles.resendLabel}>Vous n'avez pas reçu le mail ?</Text>
          {resent ? (
            <View style={styles.resentRow}>
              <Ionicons name="checkmark-circle" size={15} color={"#10B981"} />
              <Text style={styles.resentText}>E-mail renvoyé{resendCooldown > 0 ? ` — attendre ${resendCooldown}s` : ""}</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.resendBtn, (resending || resendCooldown > 0 || !email) ? styles.resendBtnDisabled : null]}
              onPress={handleResend}
              disabled={resending || resendCooldown > 0 || !email}
            >
              {resending ? (
                <ActivityIndicator size="small" color={"#2B4E93"} />
              ) : (
                <Text style={styles.resendBtnText}>
                  {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : "Renvoyer le lien de confirmation"}
                </Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Footer */}
        <Pressable
          style={styles.backLink}
          onPress={() => router.replace("/establishment/offers")}
        >
          <Ionicons name="arrow-back" size={14} color={"#9CA3AF"} />
          <Text style={styles.backLinkText}>Modifier l'offre</Text>
        </Pressable>
      </View>

      <Text style={styles.spamNote}>
        Si vous ne trouvez pas le mail, vérifiez vos courriers indésirables.
      </Text>
    </View>
  );
}

const STEPS = [
  "Ouvrez votre boîte mail",
  "Cliquez sur « Confirmer mon compte »",
  "Revenez ici et connectez-vous",
];

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8faff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 28,
    gap: 22,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    shadowColor: "#0B0B12",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  // Icon
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 100,
    height: 100,
  },
  iconOuter: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 70,
    height: 70,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  // Logo
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#2B4E93",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B4E93",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  logoText: { color: "#FFFFFF", fontSize: 22, fontFamily: Font.extraBold, letterSpacing: -0.5, includeFontPadding: false },
  brandName: { color: "#111827", fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  brandSub: { color: "#9CA3AF", fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },

  // Text
  textBlock: {
    gap: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: Font.extraBold,
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  desc: {
    fontSize: 14,
    fontFamily: Font.regular,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 22,
    includeFontPadding: false,
  },
  emailHighlight: {
    color: "#111827",
    fontFamily: Font.extraBold,
  },
  hint: {
    fontSize: 13,
    fontFamily: Font.regular,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    includeFontPadding: false,
  },

  // Steps
  stepsBlock: {
    width: "100%",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 16,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "#2B4E93",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  stepText: {
    color: "#111827",
    fontSize: 14,
    fontFamily: Font.semiBold,
    flex: 1,
    includeFontPadding: false,
  },

  // CTA
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2B4E93",
    borderRadius: 14,
    paddingVertical: 15,
    width: "100%",
    shadowColor: "#2B4E93",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },

  // Resend
  resendBlock: {
    alignItems: "center",
    gap: 8,
  },
  resendLabel: {
    color: "#9CA3AF",
    fontSize: 13,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  resendBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  resendBtnDisabled: { opacity: 0.5 },
  resendBtnText: {
    color: "#111827",
    fontSize: 13,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  resentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resentText: {
    color: "#10B981",
    fontSize: 13,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },

  // Footer
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  backLinkText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },

  spamNote: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: Font.regular,
    textAlign: "center",
    maxWidth: 340,
    includeFontPadding: false,
  },
});
