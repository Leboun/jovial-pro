import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

import { JOVIAL_PRO_OFFERS, JovialProOfferKey } from "@/constants/jovialPro";
import { supabase } from "@/services/supabase";
import { Font } from "@/constants/typography";

export default function EstablishmentSignupScreen() {
  const router = useRouter();
  const { offer, interval, next } = useLocalSearchParams<{
    offer?: string;
    interval?: string;
    next?: string;
  }>();

  const [establishmentName, setEstablishmentName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<JovialProOfferKey>("rayonnement");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emailRedirectTo = Linking.createURL("auth/callback");
  const defaultNextPath = "/establishment/dashboard";
  const nextPath =
    typeof next === "string" && next.startsWith("/establishment/")
      ? next
      : defaultNextPath;

  const offerFromNext = (() => {
    const match = nextPath.match(/\/establishment\/subscription\/([^?]+)/);
    const value = match?.[1];
    if (value === "visibilite" || value === "rayonnement" || value === "pro") return value;
    return null;
  })();

  useEffect(() => {
    if (offer === "visibilite" || offer === "rayonnement" || offer === "pro") {
      setSelectedOffer(offer);
      return;
    }
    if (offerFromNext) {
      setSelectedOffer(offerFromNext);
    }
  }, [offer, offerFromNext]);

  const selectedOfferData = useMemo(
    () => JOVIAL_PRO_OFFERS.find((o) => o.key === selectedOffer) ?? JOVIAL_PRO_OFFERS[1],
    [selectedOffer]
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!establishmentName.trim()) e.name = "Nom requis";
    if (!city.trim()) e.city = "Ville requise";
    if (!email.trim() || !email.includes("@")) e.email = "Adresse e-mail invalide";
    if (password.length < 8) e.password = "Minimum 8 caractères";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            role: "establishment",
            requested_offer: selectedOffer,
            establishment_name: establishmentName.trim(),
            establishment_city: city.trim(),
          },
          emailRedirectTo,
        },
      });

      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("confirmation email") || msg.includes("sending")) {
          setErrors({ global: "Impossible d'envoyer l'e-mail de confirmation. Réessayez dans quelques minutes ou contactez le support." });
        } else if (msg.includes("already registered") || msg.includes("already been registered")) {
          setErrors({ global: "Un compte existe déjà avec cet e-mail. Connectez-vous directement." });
        } else if (msg.includes("password")) {
          setErrors({ global: "Mot de passe trop faible. Utilisez au moins 8 caractères." });
        } else {
          setErrors({ global: "Une erreur est survenue. Vérifiez vos informations et réessayez." });
        }
        return;
      }

      router.replace({
        pathname: "/establishment/confirm-email",
        params: { email: email.trim().toLowerCase() },
      });
    } finally {
      setLoading(false);
    }
  };

  const intervalLabel = interval === "month" ? "mois" : "an";

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
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={"#9CA3AF"} />
            <Text style={styles.backBtnText}>Retour</Text>
          </Pressable>

          <View style={styles.logoRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>J</Text>
            </View>
            <View>
              <Text style={styles.brandName}>Jovial Pro</Text>
              <Text style={styles.brandSub}>Création de compte</Text>
            </View>
          </View>

          <Text style={styles.pageTitle}>Votre espace partenaire</Text>
          <Text style={styles.pageDesc}>
            Dernière étape avant l'activation. Confirmez votre e-mail pour débloquer l'accès.
          </Text>
        </View>

        {/* Offer recap */}
        <View style={styles.offerRecap}>
          <View style={styles.offerRecapLeft}>
            <Text style={styles.offerRecapEyebrow}>Offre sélectionnée</Text>
            <Text style={styles.offerRecapName}>{selectedOfferData.name}</Text>
            <Text style={styles.offerRecapPrice}>
              {interval === "month"
                ? `${selectedOfferData.monthlyPrice}€/mois`
                : `${selectedOfferData.annualPrice}€/an`}
            </Text>
          </View>
          <Pressable
            style={styles.changeOfferBtn}
            onPress={() => router.push("/establishment/offers")}
          >
            <Text style={styles.changeOfferBtnText}>Modifier</Text>
          </Pressable>
        </View>

        {/* Error global */}
        {errors.global ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorBannerText}>{errors.global}</Text>
          </View>
        ) : null}

        {/* Form section 1: Établissement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Votre établissement</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom de l'établissement</Text>
            <View style={[styles.inputWrap, errors.name ? styles.inputError : null]}>
              <Ionicons name="business-outline" size={17} color={"#9CA3AF"} />
              <TextInput
                style={styles.input}
                placeholder="ex : Le Comptoir des Jeux"
                placeholderTextColor={"#9CA3AF"}
                value={establishmentName}
                onChangeText={(v) => {
                  setEstablishmentName(v);
                  setErrors((e) => ({ ...e, name: "" }));
                }}
                maxLength={80}
              />
            </View>
            {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Ville</Text>
            <View style={[styles.inputWrap, errors.city ? styles.inputError : null]}>
              <Ionicons name="location-outline" size={17} color={"#9CA3AF"} />
              <TextInput
                style={styles.input}
                placeholder="ex : Rennes"
                placeholderTextColor={"#9CA3AF"}
                value={city}
                onChangeText={(v) => {
                  setCity(v);
                  setErrors((e) => ({ ...e, city: "" }));
                }}
                maxLength={60}
              />
            </View>
            {errors.city ? <Text style={styles.fieldError}>{errors.city}</Text> : null}
          </View>
        </View>

        {/* Form section 2: Accès */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Votre accès</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Adresse e-mail</Text>
            <View style={[styles.inputWrap, errors.email ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={17} color={"#9CA3AF"} />
              <TextInput
                style={styles.input}
                placeholder="contact@monbar.fr"
                placeholderTextColor={"#9CA3AF"}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setErrors((e) => ({ ...e, email: "" }));
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
            {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mot de passe</Text>
            <View style={[styles.inputWrap, errors.password ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={17} color={"#9CA3AF"} />
              <TextInput
                style={styles.input}
                placeholder="Minimum 8 caractères"
                placeholderTextColor={"#9CA3AF"}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setErrors((e) => ({ ...e, password: "" }));
                }}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={17}
                  color={"#9CA3AF"}
                />
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
          </View>
        </View>

        {/* Legal note */}
        <Text style={styles.legalNote}>
          En créant votre compte, vous acceptez les Conditions Générales d'Utilisation de Jovial Pro.
          Le paiement intervient uniquement à l'étape suivante, après confirmation de l'e-mail.
        </Text>

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={onSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Créer mon compte</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </>
          )}
        </Pressable>

        {/* Login link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginRowText}>Déjà un compte ?</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/establishment/login",
                params: { next: nextPath },
              })
            }
          >
            <Text style={styles.loginRowLink}>Se connecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F8F9FA" },
  content: {
    padding: 24,
    paddingBottom: 52,
    gap: 24,
    maxWidth: 560,
    alignSelf: "center",
    width: "100%",
  },

  // Header
  header: { gap: 14, paddingTop: 8 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  backBtnText: { color: "#9CA3AF", fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  logoText: { color: "#FFFFFF", fontSize: 22, fontFamily: Font.extraBold, letterSpacing: -0.5, includeFontPadding: false },
  brandName: { color: "#111827", fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  brandSub: { color: "#9CA3AF", fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  pageTitle: { color: "#111827", fontSize: 30, fontFamily: Font.extraBold, letterSpacing: -0.8, includeFontPadding: false },
  pageDesc: { color: "#9CA3AF", fontSize: 14, lineHeight: 21, includeFontPadding: false },

  // Offer recap
  offerRecap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  offerRecapLeft: { gap: 2 },
  offerRecapEyebrow: { color: "#111827", fontSize: 11, fontFamily: Font.extraBold, letterSpacing: 0.8, includeFontPadding: false },
  offerRecapName: { color: "#111827", fontSize: 17, fontFamily: Font.extraBold, includeFontPadding: false },
  offerRecapPrice: { color: "#111827", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  changeOfferBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  changeOfferBtnText: { color: "#111827", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },

  // Error banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorBannerText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },

  // Sections
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 14,
  },
  sectionTitle: { color: "#111827", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },

  // Fields
  field: { gap: 6 },
  fieldLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontFamily: Font.extraBold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 13,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: "#FCA5A5", backgroundColor: "#FFF5F5" },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: "#111827",
    includeFontPadding: false,
  },
  fieldError: { color: "#DC2626", fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },

  // Offer picker
  offerList: { gap: 10 },
  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
    padding: 14,
  },
  offerCardActive: {
    borderColor: "#111827",
    backgroundColor: "#F3F4F6",
  },
  offerCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  offerRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  offerRadioActive: { borderColor: "#111827" },
  offerRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111827",
  },
  offerCardText: { gap: 2, flex: 1 },
  offerCardName: { color: "#111827", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  offerCardNameActive: { color: "#111827" },
  offerCardPrice: { color: "#9CA3AF", fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },
  offerRecBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  offerRecBadgeText: { color: "#111827", fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },

  // Legal
  legalNote: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    includeFontPadding: false,
  },

  // Submit
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: "#111827",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: Font.extraBold, includeFontPadding: false },

  // Login row
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  loginRowText: { color: "#9CA3AF", fontSize: 13, includeFontPadding: false },
  loginRowLink: { color: "#111827", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
});
