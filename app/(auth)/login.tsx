import { useState } from "react";
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
import { getProfileRole } from "../../services/profiles";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const onLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert("Champs manquants", "Merci de renseigner email et mot de passe.");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) { Alert.alert("Connexion impossible", "Email ou mot de passe incorrect."); return; }
      const userId = data.session?.user?.id ?? null;
      if (userId) {
        try {
          const role = await getProfileRole(userId);
          if (role === "establishment") { router.replace("/establishment/dashboard"); return; }
        } catch {}
      }
      router.replace("/(tabs)/map");
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { Alert.alert("Email manquant", "Renseigne ton email pour réinitialiser le mot de passe."); return; }
    try {
      setResetting(true);
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo: "jovial://auth/reset-password" });
      if (error) { Alert.alert("Erreur", error.message); return; }
      Alert.alert("Email envoyé", "Vérifie ta boite mail pour réinitialiser ton mot de passe.");
    } finally {
      setResetting(false);
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
            <Text style={styles.eyebrow}>CONNEXION</Text>
            <Text style={styles.headline}>Bon retour 👋</Text>
            <Text style={styles.subline}>Retrouve tes lieux favoris et événements à venir.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
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

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
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
              <View style={styles.inputLine} />
            </View>

            <Pressable onPress={onResetPassword} disabled={resetting} style={styles.forgotWrap}>
              <Text style={styles.forgotText}>{resetting ? "Envoi..." : "Mot de passe oublié ?"}</Text>
            </Pressable>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.btn, loading && styles.btnDisabled, pressed && { opacity: 0.88 }]}
            onPress={onLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? "Connexion..." : "Se connecter"}</Text>
          </Pressable>

          {/* Footer */}
          <View style={styles.footer}>
            <Link href="/signup" style={styles.footerText}>
              Pas encore de compte ?{" "}
              <Text style={styles.footerLink}>S'inscrire</Text>
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
  headlineBlock: {
    gap: 8,
  },
  eyebrow: {
    color: Pastel.cream,
    fontSize: 11,
    fontFamily: Font.extraBold,
    letterSpacing: 2.5,
    includeFontPadding: false,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 44,
    fontFamily: Font.display,
    letterSpacing: 1,
    lineHeight: 50,
    includeFontPadding: false,
  },
  subline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  form: {
    gap: 28,
  },
  field: {
    gap: 8,
  },
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
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  forgotWrap: { alignSelf: "flex-end" },
  forgotText: {
    color: Pastel.cream,
    fontSize: 13,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  btn: {
    backgroundColor: Pastel.orange,
    paddingVertical: 17,
    alignItems: "center",
    borderRadius: 14,
    shadowColor: Pastel.orange,
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
  footer: {
    alignItems: "center",
  },
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
