import React from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../services/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const openLink = (label: string, url: string) => {
    Linking.openURL(url).catch(() => Alert.alert("Erreur", `Impossible d'ouvrir ${label}.`));
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Supprimer mon compte",
      "Cette action est définitive et irréversible. Toutes tes données, favoris et historique seront effacés immédiatement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Dernière confirmation",
              "Es-tu sûr ? Ton compte sera supprimé immédiatement et tu seras déconnecté.",
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Oui, supprimer",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const { data: { session: currentSession } } = await supabase.auth.getSession();
                      if (!currentSession) { Alert.alert("Erreur", "Session expirée, reconnecte-toi."); return; }
                      const { error } = await supabase.functions.invoke("delete-account");
                      if (error) { Alert.alert("Erreur", "Impossible de supprimer le compte. Contacte contact@jovial.app."); return; }
                      await supabase.auth.signOut();
                      router.replace("/welcome");
                    } catch {
                      Alert.alert("Erreur", "Une erreur est survenue. Contacte contact@jovial.app.");
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      "Exporter mes données",
      "Tu peux demander une copie de tes données personnelles. Nous t'enverrons un email avec le fichier sous 30 jours.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Envoyer la demande",
          onPress: () => {
            const email = session?.user?.email ?? "";
            const subject = encodeURIComponent("Demande d'export de données RGPD");
            const body = encodeURIComponent(`Bonjour,\n\nJe souhaite recevoir une copie de mes données personnelles pour le compte : ${email}\n\nMerci.`);
            Linking.openURL(`mailto:contact@jovial.app?subject=${subject}&body=${body}`);
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Se déconnecter",
      "Tu vas être déconnecté de Jovial.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/welcome");
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Compte */}
        <Text style={styles.sectionTitle}>Mon compte</Text>
        <View style={styles.sectionBlock}>
          <SettingsRow
            icon="person-outline"
            iconBg="#F3F4F6"
            iconColor="#111827"
            label="Modifier mon profil"
            onPress={() => router.back()}
          />
          <SettingsRow
            icon="log-out-outline"
            iconBg="#FEF2F2"
            iconColor="#EF4444"
            label="Se déconnecter"
            onPress={handleLogout}
            labelColor="#EF4444"
            last
          />
        </View>

        {/* Confidentialité & RGPD */}
        <Text style={styles.sectionTitle}>Confidentialité & RGPD</Text>
        <View style={styles.rgpdBlock}>
          <Ionicons name="shield-checkmark" size={18} color="#8B5CF6" />
          <Text style={styles.rgpdText}>
            Tes données sont hébergées en Europe et protégées conformément au RGPD.
          </Text>
        </View>
        <View style={styles.sectionBlock}>
          <SettingsRow
            icon="download-outline"
            iconBg="#F5F3FF"
            iconColor="#8B5CF6"
            label="Exporter mes données"
            onPress={handleExportData}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            iconBg="#F5F3FF"
            iconColor="#8B5CF6"
            label="Politique de confidentialité"
            onPress={() => openLink("Politique de confidentialité", "https://jovial.app/confidentialite")}
          />
          <SettingsRow
            icon="document-text-outline"
            iconBg="#F3F4F6"
            iconColor="#9CA3AF"
            label="Conditions d'utilisation"
            onPress={() => openLink("CGU", "https://jovial.app/cgu")}
          />
          <SettingsRow
            icon="newspaper-outline"
            iconBg="#F3F4F6"
            iconColor="#9CA3AF"
            label="Mentions légales"
            onPress={() => openLink("Mentions légales", "https://jovial.app/mentions-legales")}
            last
          />
        </View>

        {/* Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.sectionBlock}>
          <SettingsRow
            icon="mail-outline"
            iconBg="#F0FDF4"
            iconColor="#10B981"
            label="Contacter le support"
            onPress={() => Linking.openURL("mailto:contact@jovial.app")}
          />
          <SettingsRow
            icon="bug-outline"
            iconBg="#FFF7ED"
            iconColor="#F97316"
            label="Signaler un problème"
            onPress={() => {
              const subject = encodeURIComponent("Signalement d'un problème");
              Linking.openURL(`mailto:contact@jovial.app?subject=${subject}`);
            }}
            last
          />
        </View>

        {/* Zone dangereuse */}
        <Text style={[styles.sectionTitle, { color: "#991B1B" }]}>Zone de danger</Text>
        <View style={styles.dangerBlock}>
          <Text style={styles.dangerDesc}>
            La suppression de ton compte est irréversible. Toutes tes données, favoris et événements seront définitivement effacés.
          </Text>
          <Pressable style={styles.dangerBtn} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.dangerBtnText}>Supprimer mon compte</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>Jovial v1.0 · Fait avec ❤️ en France</Text>
      </ScrollView>
    </View>
  );
}

function SettingsRow({
  icon,
  iconBg,
  iconColor,
  label,
  onPress,
  labelColor,
  last,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  onPress: () => void;
  labelColor?: string;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed ? { opacity: 0.75 } : null]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Pastel.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  title: { fontSize: 17, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },

  content: { paddingBottom: 48 },

  sectionTitle: {
    fontSize: 12,
    fontFamily: Font.bold,
    color: Pastel.textMuted,
    marginTop: 24,
    marginBottom: 4,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    includeFontPadding: false,
  },

  sectionBlock: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
  },

  rgpdBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F5F3FF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  rgpdText: { flex: 1, fontSize: 12, color: "#5B21B6", lineHeight: 18, includeFontPadding: false },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },

  dangerBlock: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
    padding: 16,
    gap: 12,
  },
  dangerDesc: { fontSize: 13, color: Pastel.textMuted, lineHeight: 20, includeFontPadding: false },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  dangerBtnText: { color: "#EF4444", fontFamily: Font.bold, fontSize: 14, includeFontPadding: false },

  versionText: { textAlign: "center", fontSize: 11, color: Pastel.textMuted, paddingTop: 24, paddingBottom: 8, includeFontPadding: false },
});
