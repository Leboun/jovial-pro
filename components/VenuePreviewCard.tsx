import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Font } from "@/constants/typography";
import { Pastel } from "@/constants/pastel";

type Props = {
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  rightLabel?: string; // ex: "1,3 km"
  onPress: () => void;
};

function isLikelyHttpUrl(s?: string | null) {
  if (!s) return false;
  return /^https?:\/\//i.test(s.trim());
}

export default function VenuePreviewCard({
  title,
  subtitle,
  coverUrl,
  rightLabel,
  onPress,
}: Props) {
  const showImage = isLikelyHttpUrl(coverUrl);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.thumbWrap}>
          {showImage ? (
            <Image source={{ uri: coverUrl!.trim() }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {rightLabel ? <Text style={styles.right}>{rightLabel}</Text> : null}
          </View>

          {subtitle ? (
            <Text numberOfLines={2} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Pastel.surface,
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.98 },

  row: { flexDirection: "row", alignItems: "center" },

  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
    marginRight: 12,
    backgroundColor: Pastel.surfaceAlt,
  },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { backgroundColor: "#F2F2F7" },

  content: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 16, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  right: { fontSize: 13, fontFamily: Font.bold, color: Pastel.textMuted, includeFontPadding: false },
  subtitle: { marginTop: 4, fontSize: 13, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
});
