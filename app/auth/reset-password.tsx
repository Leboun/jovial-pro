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
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/services/supabase";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase envoie access_token et refresh_token dans le fragment URL
  // Expo Router les expose en query params sur deep link
  useEffect(() => {
    const accessToken = params.access_token as string | undefined;
    const refreshToken = params.refresh_token as string | undefined;

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            Alert.alert("Lien expiré", "Ce lien de réinitialisation n'est plus valide. Demande-en un nouveau.", [
              { text: "OK", onPress: () => router.replace("/(auth)/login") },
            ]);
          } else {
            setSessionReady(true);
          }
        });
    } else {
      // Pas de token — lien invalide ou direct access
      Alert.alert("Lien invalide", "Ce lien de réinitialisation n'est pas valide.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    }
  }, []);

  const onSubmit = async () => {
    if (password.length < 12) {
      Alert.alert("Mot de passe trop court", "Le mot de passe doit faire au moins 12 caractères.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Mots de passe différents", "Les deux mots de passe ne correspondent pas.");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert("Erreur", "Impossible de mettre à jour le mot de passe. " + error.message);
        return;
      }
      Alert.alert("Mot de passe mis à jour", "Tu peux maintenant te connecter avec ton nouveau mot de passe.", [
        { text: "Se connecter", onPress: () => router.replace("/(tabs)/map") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionReady) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator color="#FFFFFF" size="large" />
        <Text style={styles.loadingText}>Vérification du lien...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headlineBlock}>
            <Text style={styles.eyebrow}>NOUVEAU MOT DE PASSE</Text>
            <Text style={styles.headline}>Réinitialisation 🔐</Text>
            <Text style={styles.subline}>Choisis un nouveau mot de passe d'au moins 12 caractères.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••••••"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoComplete="new-password"
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

            <View style={styles.field}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="rgba(255,255,255,0.25)"
                secureTextEntry={!showPassword}
                value={confirm}
                onChangeText={setConfirm}
                autoComplete="new-password"
              />
              <View style={styles.inputLine} />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.btn, loading && styles.btnDisabled, pressed && { opacity: 0.88 }]}
            onPress={onSubmit}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? "Mise à jour..." : "Mettre à jour"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Pastel.primary },
  center: {
    flex: 1,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 36,
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
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
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
});
