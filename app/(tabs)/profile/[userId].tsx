import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useIsPremium } from "@/hooks/useIsPremium";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

type Profile = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
};

type FavoriteVenue = {
  id: number;
  name: string;
  city: string | null;
  cover_url: string | null;
};

type UpcomingEvent = {
  id: number;
  title: string;
  starts_at: string;
  cover_url: string | null;
  venue_name: string;
};

function getDisplayName(p: Profile | null) {
  if (!p) return "Membre";
  const first = (p.firstname ?? "").trim();
  const last = (p.lastname ?? "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  if (p.handle) return `@${p.handle}`;
  return "Membre";
}

function getInitials(p: Profile | null) {
  const name = getDisplayName(p);
  return name.replace("@", "").slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];
function avatarColor(userId: string) {
  const n = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function PublicProfileScreen() {
  const { userId: targetId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const { isPremium } = useIsPremium();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const myId = session?.user?.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [favorites, setFavorites] = useState<FavoriteVenue[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);

    const [
      { data: profileData },
      { data: followingMe },
      { data: followersData },
      { data: followingData },
      { data: favRows },
      { data: rsvpRows },
    ] = await Promise.all([
      supabase.from("profiles").select("user_id, handle, firstname, lastname, bio, avatar_url, city").eq("user_id", targetId).maybeSingle(),
      myId ? supabase.from("user_follows").select("follower_id").eq("follower_id", myId).eq("following_id", targetId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", targetId),
      supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", targetId),
      supabase.from("venue_favorites").select("venue_id").eq("user_id", targetId).order("created_at", { ascending: false }).limit(6),
      supabase.from("rsvps").select("id, status, events ( id, title, starts_at, cover_url, venues ( name ) )").eq("user_id", targetId).in("status", ["interested", "going"]),
    ]);

    setProfile((profileData as Profile) ?? null);
    setIsFollowing(!!followingMe);
    setFollowersCount((followersData as any)?.count ?? 0);
    setFollowingCount((followingData as any)?.count ?? 0);

    // Favorites
    const venueIds = (favRows ?? []).map((r: any) => r.venue_id).filter(Boolean);
    if (venueIds.length > 0) {
      const { data: venuesData } = await supabase.from("venues").select("id, name, city, cover_url").in("id", venueIds);
      const byId = new Map((venuesData ?? []).map((v: any) => [v.id, v]));
      setFavorites(venueIds.map((id: number) => byId.get(id)).filter(Boolean) as FavoriteVenue[]);
    }

    // Upcoming events
    const now = new Date().toISOString();
    const clean = ((rsvpRows as any[]) ?? [])
      .map((row: any) => {
        const ev = row?.events;
        if (!ev?.id || !ev?.starts_at) return null;
        if (new Date(ev.starts_at).getTime() < Date.now()) return null;
        return {
          id: Number(ev.id),
          title: String(ev.title ?? ""),
          starts_at: String(ev.starts_at),
          cover_url: ev.cover_url ?? null,
          venue_name: String(ev?.venues?.name ?? ""),
        } as UpcomingEvent;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    setUpcoming(clean as UpcomingEvent[]);

    setLoading(false);
  }, [targetId, myId]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFollow = async () => {
    if (!myId || !targetId || toggling) return;
    setToggling(true);
    if (isFollowing) {
      await supabase.from("user_follows").delete().eq("follower_id", myId).eq("following_id", targetId);
      setIsFollowing(false);
      setFollowersCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("user_follows").insert({ follower_id: myId, following_id: targetId });
      setIsFollowing(true);
      setFollowersCount((n) => n + 1);
    }
    setToggling(false);
  };

  const handleChat = () => {
    router.push("/profile/chat" as any);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Pastel.primary} />
      </View>
    );
  }

  const isSelf = myId === targetId;
  const firstName = (profile?.firstname ?? "").trim() || getDisplayName(profile);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>

        {/* Avatar */}
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: avatarColor(targetId ?? "") }]}>
            <Text style={styles.avatarInitials}>{getInitials(profile)}</Text>
          </View>
        )}

        <Text style={styles.name}>{getDisplayName(profile)}</Text>
        {profile?.handle ? <Text style={styles.handle}>@{profile.handle}</Text> : null}
        {profile?.city ? (
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={12} color={Pastel.textMuted} />
            <Text style={styles.cityText}>{profile.city}</Text>
          </View>
        ) : null}
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>Amis</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{upcoming.length}</Text>
            <Text style={styles.statLabel}>Événements</Text>
          </View>
        </View>

        {/* Actions */}
        {!isSelf ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.followBtn, isFollowing ? styles.followBtnActive : null]}
              onPress={handleToggleFollow}
              disabled={toggling}
            >
              <Ionicons
                name={isFollowing ? "person-remove-outline" : "person-add-outline"}
                size={15}
                color={isFollowing ? Pastel.text : "#FFFFFF"}
              />
              <Text style={[styles.followBtnText, isFollowing ? styles.followBtnTextActive : null]}>
                {isFollowing ? "Suivi" : "Suivre"}
              </Text>
            </Pressable>
            <Pressable style={styles.chatBtn} onPress={handleChat}>
              <Ionicons name="chatbubble-outline" size={15} color={Pastel.text} />
              <Text style={styles.chatBtnText}>Message</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* ── FAVORIS ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="heart-outline" size={16} color={Pastel.text} />
          <Text style={styles.sectionTitle}>Lieux favoris de {firstName}</Text>
          {isPremium ? null : <View style={styles.lockBadge}><Ionicons name="lock-closed" size={11} color={Pastel.orange} /></View>}
        </View>

        {isPremium ? (
          favorites.length === 0 ? (
            <Text style={styles.emptyHint}>Aucun favori pour l'instant.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {favorites.map((venue) => (
                <Pressable key={venue.id} style={styles.venueCard} onPress={() => router.push(`/venue/${venue.id}` as any)}>
                  {venue.cover_url ? (
                    <Image source={{ uri: venue.cover_url }} style={styles.venueCardImg} />
                  ) : (
                    <View style={[styles.venueCardImg, styles.venueCardImgFallback]}>
                      <Ionicons name="business-outline" size={20} color={Pastel.textMuted} />
                    </View>
                  )}
                  <Text style={styles.venueCardName} numberOfLines={1}>{venue.name}</Text>
                  {venue.city ? <Text style={styles.venueCardCity} numberOfLines={1}>{venue.city}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          )
        ) : (
          <Pressable style={styles.premiumGate} onPress={() => router.push("/premium" as any)}>
            <View style={styles.premiumGateBlur}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.venueCardPlaceholder} />
              ))}
            </View>
            <View style={styles.premiumGateOverlay}>
              <Text style={styles.premiumGateBadge}>✦ JOVIAL+</Text>
              <Text style={styles.premiumGateTitle}>Fonctionnalité Jovial+</Text>
              <Text style={styles.premiumGateSub}>Voir les lieux favoris de tes amis</Text>
              <View style={styles.premiumGateBtn}>
                <Text style={styles.premiumGateBtnText}>Débloquer →</Text>
              </View>
            </View>
          </Pressable>
        )}
      </View>

      {/* ── AGENDA ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={16} color={Pastel.text} />
          <Text style={styles.sectionTitle}>Agenda de {firstName}</Text>
          {isPremium ? null : <View style={styles.lockBadge}><Ionicons name="lock-closed" size={11} color={Pastel.orange} /></View>}
        </View>

        {isPremium ? (
          upcoming.length === 0 ? (
            <Text style={styles.emptyHint}>Aucun événement à venir.</Text>
          ) : (
            <View style={styles.eventList}>
              {upcoming.map((ev) => (
                <Pressable key={ev.id} style={styles.eventRow} onPress={() => router.push(`/event/${ev.id}` as any)}>
                  {ev.cover_url ? (
                    <Image source={{ uri: ev.cover_url }} style={styles.eventImg} />
                  ) : (
                    <View style={[styles.eventImg, styles.eventImgFallback]}>
                      <Ionicons name="calendar-outline" size={16} color={Pastel.textMuted} />
                    </View>
                  )}
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={styles.eventMeta}>{formatDate(ev.starts_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ""}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Pastel.textMuted} />
                </Pressable>
              ))}
            </View>
          )
        ) : (
          <Pressable style={styles.premiumGate} onPress={() => router.push("/premium" as any)}>
            <View style={styles.premiumGateBlur}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.eventRowPlaceholder} />
              ))}
            </View>
            <View style={styles.premiumGateOverlay}>
              <Text style={styles.premiumGateBadge}>✦ JOVIAL+</Text>
              <Text style={styles.premiumGateTitle}>Fonctionnalité Jovial+</Text>
              <Text style={styles.premiumGateSub}>Voir les événements auxquels assistent tes amis</Text>
              <View style={styles.premiumGateBtn}>
                <Text style={styles.premiumGateBtnText}>Débloquer →</Text>
              </View>
            </View>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },
  content: { paddingBottom: 48 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Pastel.background },

  hero: {
    backgroundColor: Pastel.surface,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  backBtn: {
    alignSelf: "flex-start",
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
    marginBottom: 8,
  },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitials: { color: "#FFFFFF", fontSize: 30, fontFamily: Font.extraBold, includeFontPadding: false },
  name: { fontSize: 22, fontFamily: Font.extraBold, color: Pastel.text, textAlign: "center", marginTop: 4, includeFontPadding: false },
  handle: { fontSize: 13, color: Pastel.textMuted, includeFontPadding: false },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  cityText: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  bio: { fontSize: 13, color: Pastel.textMuted, textAlign: "center", lineHeight: 19, marginTop: 2, includeFontPadding: false },

  statsRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 16,
    marginTop: 8,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  statDivider: { width: 1, backgroundColor: Pastel.border },
  statValue: { fontSize: 17, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  statLabel: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },

  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  followBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
    backgroundColor: Pastel.primary,
  },
  followBtnActive: { backgroundColor: Pastel.surfaceAlt, borderWidth: 1, borderColor: Pastel.border },
  followBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 13, includeFontPadding: false },
  followBtnTextActive: { color: Pastel.text },
  chatBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surface,
  },
  chatBtnText: { color: Pastel.text, fontFamily: Font.bold, fontSize: 13, includeFontPadding: false },

  section: {
    backgroundColor: Pastel.surface,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
    gap: 12,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitle: { flex: 1, fontSize: 15, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  lockBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#FEF3C7",
    alignItems: "center", justifyContent: "center",
  },
  emptyHint: { fontSize: 13, color: Pastel.textMuted, includeFontPadding: false },

  hScroll: { gap: 10, paddingBottom: 4 },
  venueCard: { width: 120, gap: 5 },
  venueCardImg: { width: 120, height: 80, borderRadius: 12 },
  venueCardImgFallback: { backgroundColor: Pastel.surfaceAlt, alignItems: "center", justifyContent: "center" },
  venueCardName: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  venueCardCity: { fontSize: 11, color: Pastel.textMuted, includeFontPadding: false },

  eventList: { gap: 0 },
  eventRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Pastel.border,
  },
  eventImg: { width: 48, height: 48, borderRadius: 10 },
  eventImgFallback: { backgroundColor: Pastel.surfaceAlt, alignItems: "center", justifyContent: "center" },
  eventInfo: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  eventMeta: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },

  premiumGate: { borderRadius: 14, position: "relative" },
  premiumGateBlur: { flexDirection: "row", gap: 10, opacity: 0.15, paddingBottom: 4 },
  venueCardPlaceholder: { width: 120, height: 100, borderRadius: 12, backgroundColor: Pastel.primary },
  eventRowPlaceholder: {
    height: 56, borderRadius: 10, backgroundColor: Pastel.primary,
    marginBottom: 8,
  },
  premiumGateOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  premiumGateBadge: { color: Pastel.orange, fontSize: 10, fontFamily: Font.extraBold, letterSpacing: 1.5, includeFontPadding: false },
  premiumGateTitle: { color: Pastel.text, fontSize: 14, fontFamily: Font.extraBold, includeFontPadding: false },
  premiumGateSub: { color: Pastel.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 20, includeFontPadding: false },
  premiumGateBtn: {
    marginTop: 6,
    backgroundColor: Pastel.primary,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
  },
  premiumGateBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
});
