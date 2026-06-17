import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import { getActivityEmoji } from "@/utils/activityEmoji";


type PreviewVenue = {
  id: string;
  name: string;
  coverUrl?: string | null;
  city?: string | null;
  address?: string | null;
  activities?: string[];
  venueType?: string | null;
  logoUrl?: string | null;
  distanceLabel?: string;
  openingLabel?: string;
  openingTone?: "open" | "closed" | "neutral";
  isDemo?: boolean;
  nextEvent?: { date: string; title: string } | null;
};

type Props = {
  venue: PreviewVenue;
  onPress: () => void;
  onClose?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

// getActivityEmoji est centralise dans "@/utils/activityEmoji" (importe en haut).

function formatEventDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function truncateEventLine(date: string, title: string, maxChars = 38): string {
  const prefix = `📅 ${date} · `;
  const remaining = maxChars - prefix.length;
  const truncated = title.length > remaining ? title.slice(0, remaining - 1) + "…" : title;
  return prefix + truncated;
}

export default function MapVenuePreviewCard({ venue, onPress, onClose, isFavorite, onToggleFavorite }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const small = screenWidth < 420;

  const activities = (venue.activities ?? []).filter(Boolean).slice(0, 3);
  const hasActivities = activities.length > 0;
  const hasContent = hasActivities || !!venue.nextEvent;

  // La pastille du logo adopte les proportions reelles du logo (carre/rectangle), largeur max 1,8x la hauteur
  const [logoAspect, setLogoAspect] = React.useState<number>(1);
  React.useEffect(() => {
    if (!venue.logoUrl) return;
    let active = true;
    Image.getSize(venue.logoUrl, (w, h) => { if (active && h > 0) setLogoAspect(w / h); }, () => {});
    return () => { active = false; };
  }, [venue.logoUrl]);
  const photoH = small ? 100 : 120;
  const LOGO_H = small ? 66 : 78;
  const logoW = Math.round(LOGO_H * Math.min(1.8, Math.max(0.6, logoAspect)));
  const logoTop = Math.round(photoH - LOGO_H * (2 / 3));

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* Photo */}
      <View style={[styles.photoWrap, small && styles.photoWrapSmall]}>
        {venue.coverUrl ? (
          <Image source={{ uri: venue.coverUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.photoFallbackLetter}>
              {(venue.name ?? "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Bouton fermer */}
        {onClose ? (
          <Pressable
            style={styles.closeBtn}
            onPress={(e) => { e.stopPropagation(); onClose(); }}
            hitSlop={10}
          >
            <Ionicons name="close" size={19} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {/* Bouton favori */}
        {onToggleFavorite ? (
          <Pressable
            style={styles.favoriteBtn}
            onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            hitSlop={10}
          >
            <Ionicons
              name={isFavorite ? "heart-sharp" : "heart-outline"}
              size={20}
              color={isFavorite ? "#EF4444" : "#FFFFFF"}
            />
          </Pressable>
        ) : null}

        {/* Badge type de lieu — bas droite */}
        {venue.venueType ? (
          <View style={styles.venueTypeBadge}>
            <Text style={styles.venueTypeBadgeText}>{venue.venueType}</Text>
          </View>
        ) : null}

        {/* Badge démo */}
        {venue.isDemo ? (
          <View style={styles.demoPill}>
            <Text style={styles.demoPillText}>Démo</Text>
          </View>
        ) : null}
      </View>

      {/* Logo — centré, chevauche le bas de la photo (2/3 dessus, 1/3 dessous) */}
      {venue.logoUrl ? (
        <View style={[styles.logoWrap, { top: logoTop }]} pointerEvents="none">
          <View style={[styles.logoAvatar, { width: logoW, height: LOGO_H }]}>
            <Image source={{ uri: venue.logoUrl }} style={styles.logoImg} resizeMode="cover" />
          </View>
        </View>
      ) : null}

      {/* Contenu */}
      <View style={[styles.body, small && styles.bodySmall, venue.logoUrl ? (small ? styles.bodyLogoSmall : styles.bodyLogo) : null]}>
        <Text numberOfLines={1} style={[styles.name, small && styles.nameSmall]}>{venue.name}</Text>

        {venue.openingLabel ? (
          <View style={[
            styles.statusPillBody,
            venue.openingTone === "open" ? styles.statusOpen :
            venue.openingTone === "closed" ? styles.statusClosed : styles.statusNeutral,
          ]}>
            <View style={[
              styles.statusDot,
              venue.openingTone === "open" ? styles.dotOpen :
              venue.openingTone === "closed" ? styles.dotClosed : styles.dotNeutral,
            ]} />
            <Text style={[
              styles.statusText,
              venue.openingTone === "open" ? styles.statusTextOpen :
              venue.openingTone === "closed" ? styles.statusTextClosed : styles.statusTextNeutral,
            ]}>{venue.openingLabel}</Text>
          </View>
        ) : null}

        {hasContent ? (
          <View style={styles.tagsSection}>
            {hasActivities ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll} contentContainerStyle={styles.tagsRow}>
                {activities.map((tag) => (
                  <View key={tag} style={styles.activityTag}>
                    <Text style={styles.activityTagText}>
                      {getActivityEmoji(tag)} {tag}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            {venue.nextEvent ? (
              <Text style={styles.nextEventText} numberOfLines={1} ellipsizeMode="tail">
                {`📅 ${formatEventDateShort(venue.nextEvent.date)} · ${venue.nextEvent.title}`}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Pressable style={styles.ctaBtn} onPress={onPress}>
          <Text style={styles.ctaBtnText}>Voir le lieu</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  /* Photo */
  photoWrap: {
    height: 120,
    backgroundColor: Pastel.surfaceAlt,
    position: "relative",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  photoWrapSmall: { height: 100 },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.primarySoft,
  },
  photoFallbackLetter: {
    fontSize: 52,
    fontFamily: Font.extraBold,
    color: Pastel.primary,
    opacity: 0.5,
    includeFontPadding: false,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Logo centré chevauchant le bas de la photo */
  logoWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 5 },
  logoAvatar: {
    borderRadius: 18,
    borderWidth: 3,
    borderColor: Pastel.surface,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  logoImg: { width: "100%", height: "100%" },

  /* Badge statut — dans le corps, centré sous le nom */
  statusPillBody: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusOpen: { backgroundColor: "#DCFCE7" },
  statusClosed: { backgroundColor: "#FEE2E2" },
  statusNeutral: { backgroundColor: Pastel.surfaceAlt },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotOpen: { backgroundColor: "#16A34A" },
  dotClosed: { backgroundColor: "#DC2626" },
  dotNeutral: { backgroundColor: Pastel.textMuted },
  statusText: { fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  statusTextOpen: { color: "#15803D" },
  statusTextClosed: { color: "#B91C1C" },
  statusTextNeutral: { color: Pastel.text },

  /* Badge type de lieu — bas droite */
  venueTypeBadge: {
    position: "absolute",
    bottom: 10,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.60)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  venueTypeBadgeText: {
    color: Pastel.text,
    fontSize: 13,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },

  /* Badge démo */
  demoPill: {
    position: "absolute",
    top: 10,
    left: 12,
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  demoPillText: {
    color: Pastel.text,
    fontSize: 13,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },

  /* Body */
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 10,
  },
  bodySmall: { paddingTop: 10, paddingBottom: 10, gap: 6 },
  bodyLogo: { paddingTop: 36 },
  bodyLogoSmall: { paddingTop: 30 },
  name: {
    color: Pastel.text,
    fontSize: 22,
    fontFamily: Font.display,
    lineHeight: 28,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
    includeFontPadding: false,
  },
  nameSmall: { fontSize: 17, lineHeight: 22 },

  /* Tags section */
  tagsSection: {
    gap: 6,
  },
  tagsScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 16,
  },
  activityTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Pastel.primarySoft,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  activityTagText: {
    color: Pastel.primary,
    fontSize: 13,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },

  nextEventText: {
    fontSize: 14,
    fontFamily: Font.semiBold,
    color: Pastel.textMuted,
    includeFontPadding: false,
  },

  /* CTA */
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Pastel.primary,
    borderRadius: 999,
    paddingVertical: 10,
    marginTop: 2,
  },
  ctaBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
});
