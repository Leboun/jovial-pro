import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { supabase } from "../../services/supabase";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

function normalizeHandle(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_\.]/g, "").slice(0, 30);
}

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstname, setFirstname] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = (() => {
    if (password.length === 0) return null;
    if (password.length < 12) return { label: "Trop court", color: "#EF4444", width: "25%" };
    if (password.length < 16) return { label: "Correct", color: "#F59E0B", width: "60%" };
    return { label: "Fort", color: "#10B981", width: "100%" };
  })();

  // Vérification disponibilité pseudo en temps réel
  useEffect(() => {
    const trimmed = handle.trim();
    if (trimmed.length < 3) { setHandleStatus("idle"); return; }
    setHandleStatus("checking");
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("handle", trimmed)
        .maybeSingle();
      setHandleStatus(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(timer);
  }, [handle]);

  const onSignup = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirstname = firstname.trim();
    const trimmedHandle = handle.trim();

    if (!trimmedFirstname) { Alert.alert("Prénom manquant", "Merci de renseigner ton prénom."); return; }
    if (trimmedHandle.length < 3) { Alert.alert("Pseudo trop court", "Ton pseudo doit faire au moins 3 caractères."); return; }
    if (handleStatus === "taken") { Alert.alert("Pseudo indisponible", "Ce pseudo est déjà pris, choisis-en un autre."); return; }
    if (!trimmedEmail || !password) { Alert.alert("Champs manquants", "Merci de renseigner email et mot de passe."); return; }
    if (password.length < 12) { Alert.alert("Mot de passe trop court", "Le mot de passe doit faire au moins 12 caractères."); return; }
    if (!trimmedEmail.includes("@")) { Alert.alert("Email invalide", "Vérifie le format de ton adresse email."); return; }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { role: "user" } },
      });
      if (error) { Alert.alert("Erreur", error.message); return; }

      const userId = data.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert({
          user_id: userId,
          firstname: trimmedFirstname,
          handle: trimmedHandle,
          is_public: true,
          is_private: isPrivate,
        });
      }

      router.replace("/premium" as any);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" hidden={false} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>

          {/* Headline */}
          <View style={styles.headlineBlock}>
            <Text style={styles.eyebrow}>INSCRIPTION</Text>
            <Text style={styles.headline}>Rejoins{"\n"}Jovial.</Text>
            <Text style={styles.subline}>Gratuit, sans engagement, sans pub.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>

            {/* Prénom */}
            <View style={styles.field}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                placeholder="Ton prénom"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
                autoComplete="given-name"
                value={firstname}
                onChangeText={setFirstname}
              />
              <View style={styles.inputLine} />
            </View>

            {/* Pseudo */}
            <View style={styles.field}>
              <Text style={styles.label}>Pseudo</Text>
              <View style={styles.handleRow}>
                <Text style={styles.handleAt}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="ton_pseudo"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={handle}
                  onChangeText={(v) => setHandle(normalizeHandle(v))}
                />
                {handleStatus === "checking" ? (
                  <Text style={styles.handleHint}>...</Text>
                ) : handleStatus === "available" ? (
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                ) : handleStatus === "taken" ? (
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                ) : null}
              </View>
              <View style={[styles.inputLine, handleStatus === "taken" ? { backgroundColor: "#EF4444" } : handleStatus === "available" ? { backgroundColor: "#10B981" } : null]} />
              {handleStatus === "taken" ? (
                <Text style={styles.handleError}>Ce pseudo est déjà pris.</Text>
              ) : handleStatus === "available" ? (
                <Text style={styles.handleOk}>Disponible !</Text>
              ) : (
                <Text style={styles.handleHintText}>Lettres, chiffres, _ et . uniquement.</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Adresse email</Text>
              <TextInput
                style={styles.input}
                placeholder="toi@exemple.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.inputLine} />
            </View>

            {/* Mot de passe */}
            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="rgba(255,255,255,0.4)"
                  />
                </Pressable>
              </View>
              <View style={styles.strengthTrack}>
                <View style={[
                  styles.strengthFill,
                  passwordStrength ? { width: passwordStrength.width as any, backgroundColor: passwordStrength.color } : null,
                ]} />
              </View>
              {passwordStrength ? (
                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Compte privé ou public */}
          <Pressable
            style={styles.privacyRow}
            onPress={() => setIsPrivate((v) => !v)}
          >
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyLabel}>{isPrivate ? "🔒 Compte privé" : "🌍 Compte public"}</Text>
              <Text style={styles.privacyDesc}>
                {isPrivate
                  ? "Les autres doivent te demander pour te suivre."
                  : "N'importe qui peut te suivre directement."}
              </Text>
            </View>
            <View style={[styles.toggle, isPrivate && styles.toggleOn]}>
              <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbOn]} />
            </View>
          </Pressable>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.btn, (loading || handleStatus === "taken") && styles.btnDisabled, pressed && { opacity: 0.88 }]}
            onPress={onSignup}
            disabled={loading || handleStatus === "taken"}
          >
            <Text style={styles.btnText}>{loading ? "Création..." : "Créer mon compte"}</Text>
          </Pressable>

          {/* Footer */}
          <View style={styles.footer}>
            <Link href="/login" style={styles.footerText}>
              Déjà un compte ?{" "}
              <Text style={styles.footerLink}>Se connecter</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Pastel.primary },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 36,
  },
  back: {
    alignSelf: "flex-start",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  headlineBlock: { gap: 8 },
  eyebrow: {
    color: Pastel.cream,
    fontSize: 11,
    fontFamily: Font.extraBold,
    letterSpacing: 2.5,
    includeFontPadding: false,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 50,
    fontFamily: Font.display,
    letterSpacing: 1,
    lineHeight: 56,
    includeFontPadding: false,
  },
  subline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  form: { gap: 28 },
  field: { gap: 8 },
  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: Font.extraBold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    includeFontPadding: false,
  },
  input: {
    color: "#FFFFFF",
    fontSize: 17,
    paddingVertical: 8,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  handleAt: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 17,
    fontFamily: Font.semiBold,
    includeFontPadding: false,
  },
  handleHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  handleHintText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  handleError: {
    color: "#EF4444",
    fontSize: 11,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  handleOk: {
    color: "#10B981",
    fontSize: 11,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  strengthTrack: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 999,
    width: "0%",
  },
  strengthLabel: {
    fontSize: 11,
    fontFamily: Font.bold,
    marginTop: 2,
    includeFontPadding: false,
  },
  btn: {
    backgroundColor: Pastel.teal,
    paddingVertical: 17,
    alignItems: "center",
    borderRadius: 14,
    shadowColor: Pastel.teal,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    color: "#FFFFFF",
    fontFamily: Font.extraBold,
    fontSize: 16,
    includeFontPadding: false,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  privacyInfo: { flex: 1, gap: 3 },
  privacyLabel: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  privacyDesc: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: Font.regular, includeFontPadding: false },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 3,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#10B981" },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignSelf: "flex-start",
  },
  toggleThumbOn: { backgroundColor: "#FFFFFF", alignSelf: "flex-end" },
  footer: { alignItems: "center" },
  footerText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    textAlign: "center",
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  footerLink: {
    color: "#FFFFFF",
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
});
