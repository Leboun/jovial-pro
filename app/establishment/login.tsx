import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { getProfileRole } from "@/services/profiles";
import { playLogoTransition } from "@/services/transition";
import { Font } from "@/constants/typography";

export default function EstablishmentLoginScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const manualLoginDone = useRef(false); // bloque définitivement la nav auto après login manuel
  const [resetting, setResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetRedirectTo = Linking.createURL("auth/callback");
  const nextPath =
    typeof next === "string" && next.startsWith("/establishment/")
      ? next
      : "/establishment/dashboard";

  const ensurePartnerAccess = async (userId: string) => {
    try {
      const role = await getProfileRole(userId);
      if (role === "user") {
        await supabase.auth.signOut();
        setError("E-mail ou mot de passe incorrect.");
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  useEffect(() => {
    if (loading || !session || manualLoginDone.current) return;
    let cancelled = false;
    const run = async () => {
      setCheckingRole(true);
      try {
        const role = await getProfileRole(session.user.id);
        if (role === "establishment" || role === null) {
          if (!cancelled) router.replace(nextPath as any);
        } else {
          await supabase.auth.signOut();
        }
      } catch {
        if (!cancelled) router.replace(nextPath as any);
      } finally {
        if (!cancelled) setCheckingRole(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [loading, nextPath, session, router]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Renseignez votre e-mail et votre mot de passe.");
      return;
    }
    setError(null);
    setSubmitting(true);
    manualLoginDone.current = true; // AVANT signInWithPassword — bloque la navigation automatique
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setSubmitting(false);

    if (authError) {
      manualLoginDone.current = false; // Réactiver si échec
      setError("E-mail ou mot de passe incorrect.");
      return;
    }

    const userId = data.session?.user?.id ?? null;
    if (!userId) { setError("Session introuvable."); return; }

    setCheckingRole(true);
    const ok = await ensurePartnerAccess(userId);
    setCheckingRole(false);
    if (ok) {
      manualLoginDone.current = true; // Bloquer le useEffect session
      // Transition "sting" du logo par-dessus l'app, puis navigation vers le dashboard.
      const played = playLogoTransition(nextPath);
      if (!played) router.replace(nextPath as any); // fallback si overlay absent
    }
  };

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Renseignez votre e-mail pour réinitialiser le mot de passe.");
      return;
    }
    setResetting(true);
    setResetSent(false);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: resetRedirectTo,
    });
    setResetting(false);
    if (resetError) {
      setError("Impossible d'envoyer l'e-mail. Vérifiez l'adresse.");
      return;
    }
    setResetSent(true);
    setError(null);
  };

  if (loading || checkingRole) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#111827"} size="large" />
        <Text style={styles.loadingText}>Vérification en cours…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.push("/establishment/offers")}>
            <Ionicons name="arrow-back" size={16} color={"#9CA3AF"} />
            <Text style={styles.backBtnText}>Accueil</Text>
          </Pressable>

          <Image
            source={require("../../assets/images/logo_jovial.png")}
            style={styles.brandLogoTop}
            resizeMode="contain"
          />

          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Bon retour parmi nous</Text>
            <Image
              source={require("../../assets/images/logo_mascotte.png")}
              style={styles.logoMascotte}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.pageDesc}>
            Ravis de vous revoir ! Connectez-vous pour piloter votre établissement sur Jovial.
          </Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {resetSent ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={15} color={"#10B981"} />
              <Text style={styles.successText}>
                E-mail de réinitialisation envoyé. Vérifiez votre boîte mail.
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Adresse e-mail</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={17} color={"#9CA3AF"} />
              <TextInput
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null); }}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder=""
                placeholderTextColor={"#9CA3AF"}
              />
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Mot de passe</Text>
              <Pressable onPress={handleResetPassword} disabled={resetting} hitSlop={8}>
                <Text style={styles.forgotLink}>
                  {resetting ? "Envoi…" : "Mot de passe oublié ?"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={17} color={"#9CA3AF"} />
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setError(null); }}
                style={styles.input}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor={"#9CA3AF"}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={17}
                  color={"#9CA3AF"}
                />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Se connecter</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={() =>
              Linking.openURL(
                "mailto:hello@getjovial.fr?subject=Adresse%20e-mail%20oubli%C3%A9e&body=Bonjour%2C%20je%20ne%20retrouve%20plus%20l%27adresse%20e-mail%20de%20mon%20compte%20Jovial%20Pro.%20Nom%20de%20l%27%C3%A9tablissement%20%3A%20%0AVille%20%3A%20"
              ).catch(() => {})
            }
            hitSlop={8}
          >
            <Text style={styles.forgotEmailLink}>E-mail oublié ? Contactez-nous</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Pas encore partenaire ?</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable style={styles.offersBtn} onPress={() => router.push("/establishment/offers")}>
            <Ionicons name="sparkles-outline" size={16} color={"#111827"} />
            <Text style={styles.offersBtnText}>Découvrir les offres Jovial Pro</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8faff" },
  content: { flexGrow: 1, padding: 24, paddingBottom: 48, justifyContent: "center", gap: 24, maxWidth: 480, alignSelf: "center", width: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8faff", gap: 12 },
  loadingText: { color: "#9CA3AF", fontSize: 13, includeFontPadding: false },
  header: { gap: 14 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  backBtnText: { color: "#9CA3AF", fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandLogoTop: { width: 230, height: 86, alignSelf: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logoMascotte: { width: 60, height: 60 },
  logoText: { color: "#FFFFFF", fontSize: 22, fontFamily: Font.extraBold, letterSpacing: -0.5, includeFontPadding: false },
  brandName: { color: "#111827", fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  brandSub: { color: "#9CA3AF", fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  pageTitle: { color: "#111827", fontSize: 30, fontFamily: Font.extraBold, letterSpacing: -0.8, includeFontPadding: false },
  pageDesc: { color: "#9CA3AF", fontSize: 14, lineHeight: 21, includeFontPadding: false },
  card: { backgroundColor: "#FFFFFF", borderRadius: 26, borderWidth: 1, borderColor: "#E5E7EB", padding: 24, gap: 16, shadowColor: "#0B0B12", shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  errorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  successBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#A7F3D0" },
  successText: { color: "#059669", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  field: { gap: 6 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: { color: "#9CA3AF", fontSize: 11, fontFamily: Font.extraBold, textTransform: "uppercase", letterSpacing: 0.6, includeFontPadding: false },
  forgotLink: { color: "#2B4E93", fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, paddingHorizontal: 14, gap: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: "#111827", includeFontPadding: false },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#2B4E93", borderRadius: 14, paddingVertical: 16, marginTop: 4, shadowColor: "#2B4E93", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 16, includeFontPadding: false },
  footer: { gap: 16, alignItems: "center" },
  forgotEmailLink: { color: "#9CA3AF", fontSize: 13, fontFamily: Font.semiBold, textDecorationLine: "underline", includeFontPadding: false },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%" },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { color: "#9CA3AF", fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  offersBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 13, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" },
  offersBtnText: { color: "#111827", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },

  splash: { flex: 1, backgroundColor: "#f8faff", alignItems: "center", justifyContent: "center" },
  splashLogoImg: { width: 380, height: 200 },
});
