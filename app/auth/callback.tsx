import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

import { supabase } from "@/services/supabase";
import { getProfileRole } from "@/services/profiles";

type Status = "loading" | "error" | "success";

const parseParams = (url: string) => {
  const params: Record<string, string> = {};
  const addParams = (value: string | undefined) => {
    if (!value) return;
    value.split("&").forEach((part) => {
      const [key, raw] = part.split("=");
      if (!key) return;
      params[decodeURIComponent(key)] = decodeURIComponent(raw ?? "");
    });
  };

  const [beforeHash, hash] = url.split("#");
  const query = beforeHash.split("?")[1];
  addParams(query);
  addParams(hash);
  return params;
};

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Vérification en cours...");

  useEffect(() => {
    let cancelled = false;

    const handleUrl = async (url: string) => {
      try {
        const params = parseParams(url);
        if (params.error || params.error_description) {
          throw new Error(params.error_description ?? params.error);
        }

        if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
        } else if (params.access_token && params.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (error) throw error;
        } else {
          throw new Error("Lien incomplet.");
        }

        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id ?? null;
        if (!userId) {
          throw new Error("Session introuvable.");
        }

        const role = await getProfileRole(userId);
        if (!cancelled) {
          setStatus("success");
          setMessage("Compte confirmé. Redirection...");
          router.replace(role === "establishment" ? "/establishment/dashboard" : "/(tabs)/map");
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus("error");
          setMessage("Lien invalide ou expiré. Merci de réessayer.");
        }
      }
    };

    const init = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleUrl(initialUrl);
      } else {
        setStatus("error");
        setMessage("Aucun lien reçu.");
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      {status === "loading" ? <ActivityIndicator color={"#111827"} /> : null}
      <Text style={styles.text}>{message}</Text>
      {status === "error" ? (
        <Pressable style={styles.button} onPress={() => router.replace("/login")}>
          <Text style={styles.buttonText}>Retour à la connexion</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  text: { color: "#111827", textAlign: "center" },
  button: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  buttonText: { color: "#F8FAFC", fontWeight: "700" },
});
