import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ESTABLISHMENT_PREVIEW_ENABLED } from "@/constants/establishmentPreview";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Ancienne route « créer mon établissement » : le parcours passe désormais par les offres puis Ma fiche.
 */
export default function EstablishmentCreateRedirectScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    router.replace(ESTABLISHMENT_PREVIEW_ENABLED ? "/establishment/dashboard" : "/establishment/offers");
  }, [router, userId]);

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Connexion requise</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.primaryButtonText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color={"#111827"} />
      <Text style={styles.hint}>
        {ESTABLISHMENT_PREVIEW_ENABLED
          ? "Redirection vers le dashboard..."
          : "Redirection vers le choix d'offre..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F8F9FA",
    padding: 20,
  },
  title: { color: "#111827", fontSize: 22, fontWeight: "700" },
  hint: { color: "#9CA3AF", fontSize: 14, textAlign: "center" },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
