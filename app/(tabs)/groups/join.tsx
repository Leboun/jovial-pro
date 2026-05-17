import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { requestJoinGroup } from "@/services/groups";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const extractToken = (input: string): string => {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? trimmed;
  } catch {
    return trimmed;
  }
};

export default function GroupJoinViaLinkScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ id: number; name: string; description: string | null; visibility: string } | null>(null);
  const [joined, setJoined] = useState(false);

  const handleResolve = async () => {
    const token = extractToken(link);
    if (!token) return;
    setLoading(true);
    setError(null);
    setResolved(null);
    setJoined(false);
    try {
      const { data, error: err } = await supabase
        .from("community_group_invite_links")
        .select("group_id, revoked_at, community_groups(id, name, description, visibility)")
        .eq("token", token)
        .maybeSingle();

      if (err) throw err;
      if (!data) {
        setError("Ce lien d'invitation est invalide ou a expiré.");
        return;
      }
      if (data.revoked_at) {
        setError("Ce lien d'invitation a été révoqué.");
        return;
      }
      const group = data.community_groups as { id: number; name: string; description: string | null; visibility: string } | null;
      if (!group) {
        setError("Club introuvable.");
        return;
      }
      setResolved(group);
    } catch {
      setError("Une erreur est survenue. Vérifie ton lien et réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!resolved || !userId) return;
    setLoading(true);
    setError(null);
    try {
      // Check if already a member
      const { data: existing } = await supabase
        .from("community_group_members")
        .select("status")
        .eq("group_id", resolved.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const statusMsg: Record<string, string> = {
          approved: "Tu es déjà membre de ce club.",
          pending: "Ta demande est déjà en attente d'approbation.",
          banned: "Tu ne peux pas rejoindre ce club.",
        };
        setError(statusMsg[existing.status as string] ?? "Tu es déjà associé à ce club.");
        return;
      }

      await requestJoinGroup(resolved.id, userId);
      setJoined(true);
    } catch {
      setError("Impossible de rejoindre ce club. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>

        <Text style={styles.title}>Rejoindre via un lien</Text>
        <Text style={styles.subtitle}>
          Colle ici le lien d'invitation partagé par un membre ou un administrateur du club.
        </Text>

        {!joined ? (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={link}
                onChangeText={(v) => { setLink(v); setResolved(null); setError(null); }}
                placeholder="Colle ton lien d'invitation ici"
                placeholderTextColor={Pastel.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {resolved ? (
              <View style={styles.resolvedCard}>
                <View style={styles.resolvedHeader}>
                  <View style={styles.resolvedIcon}>
                    <Ionicons name="people" size={22} color="#6366F1" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.resolvedName}>{resolved.name}</Text>
                    {resolved.description ? (
                      <Text style={styles.resolvedDesc} numberOfLines={2}>{resolved.description}</Text>
                    ) : null}
                    <View style={styles.visibilityRow}>
                      <Ionicons
                        name={resolved.visibility === "public" ? "globe-outline" : "lock-closed-outline"}
                        size={12}
                        color={Pastel.textMuted}
                      />
                      <Text style={styles.visibilityText}>
                        {resolved.visibility === "public" ? "Club public" : "Club privé"}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  style={[styles.joinBtn, loading ? styles.joinBtnDisabled : null]}
                  onPress={handleJoin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.joinBtnText}>
                      {resolved.visibility === "public" ? "Rejoindre le club" : "Demander à rejoindre"}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.resolveBtn, (!link.trim() || loading) ? styles.resolveBtnDisabled : null]}
                onPress={handleResolve}
                disabled={!link.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.resolveBtnText}>Vérifier le lien</Text>
                )}
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.successBlock}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>
              {resolved?.visibility === "public" ? "Tu as rejoint le club !" : "Demande envoyée !"}
            </Text>
            <Text style={styles.successText}>
              {resolved?.visibility === "public"
                ? `Bienvenue dans "${resolved?.name}".`
                : `Ta demande pour rejoindre "${resolved?.name}" a été envoyée. Un admin doit l'accepter.`}
            </Text>
            <Pressable
              style={styles.goBtn}
              onPress={() => resolved && router.replace(`/groups/${resolved.id}` as any)}
            >
              <Text style={styles.goBtnText}>Voir le club</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },
  container: { flex: 1, padding: 20, gap: 20 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  title: { fontSize: 28, fontFamily: Font.display, color: Pastel.text, letterSpacing: 0.5, includeFontPadding: false },
  subtitle: { fontSize: 14, color: Pastel.textMuted, lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },
  inputRow: { gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Pastel.text,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: Font.semiBold, flex: 1, includeFontPadding: false },
  resolvedCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 16,
    gap: 14,
    shadowColor: Pastel.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  resolvedHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  resolvedIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  resolvedName: { fontSize: 16, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  resolvedDesc: { fontSize: 13, color: Pastel.textMuted, lineHeight: 18, fontFamily: Font.regular, includeFontPadding: false },
  visibilityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  visibilityText: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  joinBtn: {
    backgroundColor: Pastel.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 14, includeFontPadding: false },
  resolveBtn: {
    backgroundColor: Pastel.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  resolveBtnDisabled: { opacity: 0.4 },
  resolveBtnText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 14, includeFontPadding: false },
  successBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 16 },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 24, fontFamily: Font.display, color: Pastel.text, textAlign: "center", letterSpacing: 0.5, includeFontPadding: false },
  successText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, fontFamily: Font.regular, includeFontPadding: false },
  goBtn: {
    marginTop: 8,
    backgroundColor: Pastel.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  goBtnText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 14, includeFontPadding: false },
});
