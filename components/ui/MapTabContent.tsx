import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const WEB_FILTERS = [
  "Tout",
  "Flechettes",
  "Palet breton",
  "Jeux de societe",
  "Baby foot",
  "Billard",
];

export default function MapTabContent() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>CARTE</Text>
        <Text style={styles.title}>Version web simplifiee</Text>
        <Text style={styles.subtitle}>
          La carte interactive utilise un module natif iPhone/Android. Sur le web, on garde un
          point d'entree propre pour ne pas bloquer `Explore` ni `Jovial Pro`.
        </Text>
      </View>

      <View style={styles.filtersCard}>
        <Text style={styles.sectionTitle}>Filtres prevus sur mobile</Text>
        <View style={styles.filterRow}>
          {WEB_FILTERS.map((filter) => (
            <View key={filter} style={styles.filterChip}>
              <Text style={styles.filterText}>{filter}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.placeholderCard}>
        <View style={styles.placeholderMap}>
          <Ionicons name="map-outline" size={44} color={Pastel.primary} />
          <Text style={styles.placeholderTitle}>Carte disponible sur mobile</Text>
          <Text style={styles.placeholderText}>
            Pour tester la carte native, utilise iPhone, Android ou un emulateur. Le web reste
            disponible pour `Explore`, les fiches et le back-office `Jovial Pro`.
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/(tabs)/explore")}>
          <Text style={styles.primaryButtonText}>Aller sur Explore</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/establishment/offers")}>
          <Text style={styles.secondaryButtonText}>Ouvrir Jovial Pro</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Pastel.background,
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 22,
    gap: 8,
  },
  eyebrow: {
    color: Pastel.primary,
    fontSize: 11,
    fontFamily: Font.extraBold,
    letterSpacing: 1.4,
  },
  title: {
    color: Pastel.text,
    fontSize: 28,
    fontFamily: Font.extraBold,
  },
  subtitle: {
    color: Pastel.textMuted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 700,
  },
  filtersCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: Pastel.text,
    fontSize: 18,
    fontFamily: Font.extraBold,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterText: {
    color: Pastel.text,
    fontSize: 12,
    fontFamily: Font.bold,
  },
  placeholderCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 18,
  },
  placeholderMap: {
    minHeight: 280,
    borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  placeholderTitle: {
    color: Pastel.text,
    fontSize: 22,
    fontFamily: Font.extraBold,
    textAlign: "center",
  },
  placeholderText: {
    color: Pastel.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 560,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Pastel.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Font.extraBold,
  },
  secondaryButton: {
    backgroundColor: Pastel.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Pastel.border,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: Pastel.text,
    fontSize: 14,
    fontFamily: Font.bold,
  },
});
