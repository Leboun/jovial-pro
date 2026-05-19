
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../../services/supabase";
import { useAuth } from "../../../providers/AuthProvider";
import { getProfileCache, setProfileCache } from "@/services/profileCache";
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

type UserSearchResult = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  avatar_url: string | null;
  city: string | null;
  is_private: boolean | null;
};

type FavoriteVenue = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  cover_url: string | null;
};

type RsvpEvent = {
  id: number;
  status: "interested" | "going";
  event: {
    id: number;
    title: string;
    starts_at: string;
    cover_url: string | null;
  };
};

type UserReservation = {
  id: number;
  starts_at: string;
  ends_at: string | null;
  status: string | null;
  payment_status: string | null;
  game_name: string | null;
  venue_name: string | null;
  venue_id: number | null;
};

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

function initialsFrom(profile: Profile | null, email?: string | null) {
  const handle = profile?.handle?.trim();
  if (handle) return handle.slice(0, 2).toUpperCase();
  const first = profile?.firstname?.trim() ?? "";
  const last = profile?.lastname?.trim() ?? "";
  const letters = `${first.slice(0, 1)}${last.slice(0, 1)}`.trim();
  if (letters) return letters.toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "ME";
}

function displayNameFromParts(
  firstname?: string | null,
  lastname?: string | null,
  handle?: string | null
) {
  const first = (firstname ?? "").trim();
  if (first) return first;
  const last = (lastname ?? "").trim();
  if (last) return last;
  const h = (handle ?? "").trim();
  if (h) return h;
  return "Utilisateur";
}

function completionScore(profile: Profile | null) {
  if (!profile) return 0;
  const fields = [
    profile.avatar_url,
    profile.handle,
    profile.bio,
    profile.city,
    profile.firstname,
    profile.lastname,
  ];
  const filled = fields.filter((x) => !!String(x ?? "").trim()).length;
  return Math.round((filled / fields.length) * 100);
}

const SUGGESTION_COOLDOWN_DAYS = 30;
const SUGGESTION_EMAIL = "contact@jovial.app";
const AVATAR_BUCKET = "avatars";

export default function ProfileScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const unreadChannelRef = useRef<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [profileForm, setProfileForm] = useState({
    handle: "",
    firstname: "",
    lastname: "",
    bio: "",
    city: "",
    avatar_url: "",
  });
  const [favorites, setFavorites] = useState<FavoriteVenue[]>([]);
  const [rsvps, setRsvps] = useState<RsvpEvent[]>([]);
  const [userReservations, setUserReservations] = useState<UserReservation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [profileLoading, setProfileLoading] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [rsvpsLoading, setRsvpsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? "";
  const { isPremium } = useIsPremium();

  const refreshUnread = useCallback(async () => {
    if (!userId) { setUnreadMessages(0); return; }
    const lastRead = await AsyncStorage.getItem("last_chat_read_at").catch(() => null);
    let query = supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId);
    if (lastRead) query = query.gt("created_at", lastRead);
    const { count: c } = await query;
    setUnreadMessages(c ?? 0);
  }, [userId]);

  useEffect(() => {
    refreshUnread();
    const channel = supabase
      .channel(`profile-chat-badge-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${userId}` }, refreshUnread)
      .subscribe();
    unreadChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [userId, refreshUnread]);

  const syncProfileForm = useCallback((data: Profile | null) => {
    setProfileForm({
      handle: data?.handle ?? "",
      firstname: data?.firstname ?? "",
      lastname: data?.lastname ?? "",
      bio: data?.bio ?? "",
      city: data?.city ?? "",
      avatar_url: data?.avatar_url ?? "",
    });
  }, []);

  useEffect(() => {
    const cached = getProfileCache(userId);
    if (!cached) return;
    setProfile(cached.profile);
    syncProfileForm(cached.profile);
    setFavorites(cached.favorites);
    setRsvps(cached.rsvps);
    setProfileLoading(false);
    setFavoritesLoading(false);
    setRsvpsLoading(false);
  }, [userId, syncProfileForm]);

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

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const cached = getProfileCache(userId);
    if (!cached?.profile) setProfileLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, handle, firstname, lastname, bio, avatar_url, city")
      .eq("user_id", userId)
      .maybeSingle();
    const nextProfile = (data as Profile) ?? null;
    const currentKey = JSON.stringify(getProfileCache(userId)?.profile ?? {});
    const nextKey = JSON.stringify(nextProfile ?? {});
    if (currentKey !== nextKey) {
      setProfile(nextProfile);
      syncProfileForm(nextProfile);
    }
    const cachedNext = getProfileCache(userId);
    setProfileCache(userId, {
      profile: nextProfile,
      favorites: cachedNext?.favorites ?? [],
      rsvps: cachedNext?.rsvps ?? [],
    });
    setProfileLoading(false);
  }, [syncProfileForm, userId]);

  const loadFavorites = useCallback(async () => {
    if (!userId) { setFavorites([]); return; }
    const cached = getProfileCache(userId);
    if (!cached?.favorites?.length) setFavoritesLoading(true);
    const { data: favoriteRows, error: favoritesError } = await supabase
      .from("venue_favorites")
      .select("venue_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (favoritesError) { setFavoritesLoading(false); return; }
    const venueIds = (favoriteRows?.map((row: { venue_id: number }) => row.venue_id) ?? []) as number[];
    if (venueIds.length === 0) { setFavorites([]); setFavoritesLoading(false); return; }
    const { data: venuesData, error: venuesError } = await supabase
      .from("venues")
      .select("id, name, city, address, cover_url")
      .in("id", venueIds);
    if (venuesError) { setFavoritesLoading(false); return; }
    const venuesById = new Map<number, FavoriteVenue>();
    (venuesData ?? []).forEach((venue: FavoriteVenue | null) => {
      if (venue?.id) venuesById.set(venue.id, venue as FavoriteVenue);
    });
    const ordered = venueIds.map((id: number) => venuesById.get(id) ?? null).filter((venue): venue is FavoriteVenue => Boolean(venue));
    const currentKey = JSON.stringify(getProfileCache(userId)?.favorites ?? []);
    const nextKey = JSON.stringify(ordered);
    if (currentKey !== nextKey) setFavorites(ordered);
    const cachedNext = getProfileCache(userId);
    setProfileCache(userId, {
      profile: cachedNext?.profile ?? null,
      favorites: ordered,
      rsvps: cachedNext?.rsvps ?? [],
    });
    setFavoritesLoading(false);
  }, [userId]);

  const loadRsvps = useCallback(async () => {
    if (!userId) { setRsvps([]); return; }
    const cached = getProfileCache(userId);
    if (!cached?.rsvps?.length) setRsvpsLoading(true);
    const { data } = await supabase
      .from("rsvps")
      .select("id, status, events ( id, title, starts_at, cover_url )")
      .eq("user_id", userId);
    const clean =
      (data as any[] | null)
        ?.map((row) => {
          const event = row?.events;
          if (!event?.id || !event?.starts_at) return null;
          return {
            id: Number(row?.id),
            status: row?.status as "interested" | "going",
            event: {
              id: Number(event.id),
              title: String(event.title ?? ""),
              starts_at: String(event.starts_at),
              cover_url: event.cover_url ?? null,
            },
          } as RsvpEvent;
        })
        .filter((item): item is RsvpEvent => Boolean(item)) ?? [];
    const upcoming = clean
      .filter((item) => new Date(item.event.starts_at).getTime() >= Date.now())
      .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
    const nextRsvps = upcoming as RsvpEvent[];
    const currentKey = JSON.stringify(getProfileCache(userId)?.rsvps ?? []);
    const nextKey = JSON.stringify(nextRsvps);
    if (currentKey !== nextKey) setRsvps(nextRsvps);
    const cachedNext = getProfileCache(userId);
    setProfileCache(userId, {
      profile: cachedNext?.profile ?? null,
      favorites: cachedNext?.favorites ?? [],
      rsvps: nextRsvps,
    });
    setRsvpsLoading(false);
  }, [userId]);

  const loadReservations = useCallback(async () => {
    if (!userId) { setUserReservations([]); return; }
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("reservations")
      .select("id, starts_at, ends_at, status, payment_status, game_id, venue_id, games(name), venues(name)")
      .eq("user_id", userId)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(10);
    const clean = ((data as any[]) ?? []).map((row) => ({
      id: Number(row.id),
      starts_at: String(row.starts_at),
      ends_at: row.ends_at ? String(row.ends_at) : null,
      status: row.status ?? null,
      payment_status: row.payment_status ?? null,
      game_name: String(row?.games?.name ?? "").trim() || null,
      venue_name: String(row?.venues?.name ?? "").trim() || null,
      venue_id: row.venue_id ? Number(row.venue_id) : null,
    }));
    setUserReservations(clean);
  }, [userId]);

  const loadFriends = useCallback(async () => {
    if (!userId) { setFollowersCount(0); setFollowingCount(0); setFollowingIds([]); setPendingIds([]); setPendingRequestsCount(0); return; }
    const [{ data: followingRows }, { data: followersRows }, { data: pendingOutRows }, { data: pendingInRows }] =
      await Promise.all([
        supabase.from("user_follows").select("following_id").eq("follower_id", userId).eq("status", "accepted"),
        supabase.from("user_follows").select("follower_id").eq("following_id", userId).eq("status", "accepted"),
        supabase.from("user_follows").select("following_id").eq("follower_id", userId).eq("status", "pending"),
        supabase.from("user_follows").select("follower_id").eq("following_id", userId).eq("status", "pending"),
      ]);
    const followingRaw = (followingRows ?? []).map((row: any) => String(row.following_id ?? "")).filter(Boolean);
    const followersRaw = (followersRows ?? []).map((row: any) => String(row.follower_id ?? "")).filter(Boolean);
    const pendingOutRaw = (pendingOutRows ?? []).map((row: any) => String(row.following_id ?? "")).filter(Boolean);
    setFollowingCount(followingRaw.length);
    setFollowersCount(followersRaw.length);
    setFollowingIds(followingRaw);
    setPendingIds(pendingOutRaw);
    setPendingRequestsCount((pendingInRows ?? []).length);
  }, [userId]);

  useEffect(() => {
    loadProfile();
    loadFavorites();
    loadRsvps();
    loadFriends();
    loadReservations();
  }, [loadProfile, loadFavorites, loadRsvps, loadFriends, loadReservations]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadFavorites();
      loadRsvps();
      loadFriends();
      loadReservations();
    }, [loadProfile, loadFavorites, loadRsvps, loadFriends, loadReservations])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadFavorites(), loadRsvps(), loadFriends(), loadReservations()]);
    setRefreshing(false);
  }, [loadProfile, loadFavorites, loadRsvps, loadFriends, loadReservations]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const term = `%${trimmed}%`;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, handle, firstname, lastname, avatar_url, city, is_private")
        .or(`handle.ilike.${term},firstname.ilike.${term},lastname.ilike.${term}`)
        .eq("is_public", true)
        .neq("user_id", userId ?? "");
      if (cancelled) return;
      setSearchResults((data as UserSearchResult[] | null) ?? []);
      setSearchLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, userId]);

  const profileView = editingProfile ? null : profile;
  const displayName = useMemo(() => {
    const first = profile?.firstname?.trim() ?? "";
    const last = profile?.lastname?.trim() ?? "";
    const handle = profile?.handle?.trim() ?? "";
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (handle) return `@${handle}`;
    return email?.split("@")[0] ?? "Moi";
  }, [email, profile]);

  const cityLabel = profile?.city?.trim() ?? "";
  const score = useMemo(() => completionScore(profile), [profile]);
  const scoreLabel = `${score}%`;

  const trustBadge = useMemo(() => {
    if (score >= 80) return { label: "Vérifié", icon: "checkmark-circle", color: "#10B981", bg: Pastel.successSoft };
    if (score >= 40) return { label: "Actif", icon: "ellipse", color: "#3B82F6", bg: "#DBEAFE" };
    return { label: "Nouveau", icon: "star", color: "#F59E0B", bg: "#FEF3C7" };
  }, [score]);

  const favoritesCount = favorites.length;
  const upcomingEvents = useMemo(
    () => rsvps.filter((r) => new Date(r.event.starts_at).getTime() >= Date.now()),
    [rsvps]
  );
  const upcomingCount = upcomingEvents.length;

  const handlePickAvatar = useCallback(
    async (source: "library" | "camera") => {
      if (!userId) return;
      let uri: string | null = null;
      try {
        if (source === "library") {
          const ImagePicker = await import("expo-image-picker");
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (result.canceled) return;
          uri = result.assets[0]?.uri ?? null;
        } else {
          const ImagePicker = await import("expo-image-picker");
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission refusée", "Autorise l'accès à la caméra dans les réglages de ton téléphone.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (result.canceled) return;
          uri = result.assets[0]?.uri ?? null;
        }
        if (!uri) return;

        const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
        const contentType = ext === "png" ? "image/png" : "image/jpeg";
        const path = `${userId}/avatar.${ext}`;

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.access_token) throw new Error("Not authenticated");

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
        const formData = new FormData();
        formData.append("file", { uri, name: `avatar.${ext}`, type: contentType } as any);

        const uploadRes = await fetch(
          `${supabaseUrl}/storage/v1/object/${AVATAR_BUCKET}/${path}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${currentSession.access_token}`,
              "x-upsert": "true",
            },
            body: formData,
          }
        );
        if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);

        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${path}?t=${Date.now()}`;
        setProfileForm((prev) => ({ ...prev, avatar_url: publicUrl }));

        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("user_id", userId);
        if (error) throw error;

        setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev);
        setAvatarLoadFailed(false);
      } catch {
        Alert.alert("Erreur", "Impossible de mettre à jour la photo.");
      }
    },
    [userId]
  );

  const handleAddPhoto = useCallback(() => {
    if (editingProfile) {
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ["Annuler", "Album photo", "Selfie"], cancelButtonIndex: 0 },
          (index) => {
            if (index === 1) handlePickAvatar("library");
            if (index === 2) handlePickAvatar("camera");
          }
        );
        return;
      }
      Alert.alert("Ajouter une photo", "Choisis une option", [
        { text: "Annuler", style: "cancel" },
        { text: "Album", onPress: () => handlePickAvatar("library") },
        { text: "Selfie", onPress: () => handlePickAvatar("camera") },
      ]);
    }
  }, [editingProfile, handlePickAvatar]);

  const handleOpenFavorites = useCallback(() => {
    if (favorites.length === 0) { Alert.alert("Favoris", "Tu n'as pas encore de lieu favori."); return; }
    router.push("/profile/favorites" as any);
  }, [favorites, router]);

  const handleOpenUpcoming = useCallback(() => {
    if (upcomingEvents.length === 0) { Alert.alert("Événements", "Aucun événement à venir pour le moment."); return; }
    router.push("/profile/upcoming" as any);
  }, [router, upcomingEvents.length]);

  const handleOpenReservations = useCallback(() => {
    if (userReservations.length === 0) { Alert.alert("Réservations", "Tu n'as pas de réservation à venir pour le moment."); return; }
    router.push("/profile/reservations" as any);
  }, [router, userReservations.length]);

  const handleToggleFollow = useCallback(
    async (targetUserId: string, targetIsPrivate?: boolean) => {
      if (!userId || !targetUserId || targetUserId === userId) return;
      const alreadyFollowing = followingIds.includes(targetUserId);
      const alreadyPending = pendingIds.includes(targetUserId);

      if (alreadyFollowing || alreadyPending) {
        await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", targetUserId);
      } else {
        const status = targetIsPrivate ? "pending" : "accepted";
        await supabase.from("user_follows").insert({ follower_id: userId, following_id: targetUserId, status });
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
        if (supabaseUrl) {
          fetch(`${supabaseUrl}/functions/v1/notify-follow`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseAnonKey}` },
            body: JSON.stringify({ follower_id: userId, following_id: targetUserId, status }),
          }).catch(() => {});
        }
        if (targetIsPrivate) {
          Alert.alert("Demande envoyée", "Ta demande de suivi a été envoyée. Tu seras notifié si elle est acceptée.");
        }
      }
      loadFriends();
    },
    [followingIds, pendingIds, loadFriends, userId]
  );

  const handleOpenChat = useCallback(() => {
    AsyncStorage.setItem("last_chat_read_at", new Date().toISOString()).catch(() => {});
    setUnreadMessages(0);
    router.push("/profile/chat" as any);
  }, [router]);

  const handleOpenFollowers = useCallback(() => {
    router.push("/profile/followers" as any);
  }, [router]);

  const handleOpenFriends = useCallback(() => {
    router.push("/profile/friends" as any);
  }, [router]);

  const handleCancelEdit = useCallback(() => {
    syncProfileForm(profile);
    setEditingProfile(false);
  }, [profile, syncProfileForm]);

  const handleSaveProfile = useCallback(async () => {
    if (!userId) return;
    setSavingProfile(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          handle: profileForm.handle.trim() || null,
          firstname: profileForm.firstname.trim() || null,
          lastname: profileForm.lastname.trim() || null,
          bio: profileForm.bio.trim() || null,
          city: profileForm.city.trim() || null,
          avatar_url: profileForm.avatar_url.trim() || null,
        })
        .eq("user_id", userId)
        .select("user_id, handle, firstname, lastname, bio, avatar_url, city")
        .maybeSingle();
      if (error) throw error;
      const nextProfile = (data as Profile) ?? null;
      setProfile(nextProfile);
      syncProfileForm(nextProfile);
      if (userId) {
        const cachedNext = getProfileCache(userId);
        setProfileCache(userId, {
          profile: nextProfile,
          favorites: cachedNext?.favorites ?? favorites,
          rsvps: cachedNext?.rsvps ?? rsvps,
        });
      }
      setEditingProfile(false);
      Alert.alert("Profil", "Modifications enregistrées.");
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour ton profil.");
    } finally {
      setSavingProfile(false);
    }
  }, [profileForm, syncProfileForm, userId]);

  const handleSuggestVenue = useCallback(async () => {
    const key = `suggest_last_${userId}`;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const last = new Date(raw);
        const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < SUGGESTION_COOLDOWN_DAYS) {
          const remaining = Math.ceil(SUGGESTION_COOLDOWN_DAYS - diffDays);
          Alert.alert("Proposition récente", `Tu pourras proposer un nouveau lieu dans ${remaining} jour${remaining > 1 ? "s" : ""}.`);
          return;
        }
      }
    } catch {}
    const subject = encodeURIComponent("Proposition de lieu — Jovial");
    const body = encodeURIComponent("Bonjour,\n\nJe souhaite proposer le lieu suivant :\n\nNom :\nAdresse :\nPourquoi ce lieu ?\n\nMerci !");
    const url = `mailto:${SUGGESTION_EMAIL}?subject=${subject}&body=${body}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) { Alert.alert("Impossible", "Aucune application mail disponible."); return; }
    await Linking.openURL(url);
    try { await AsyncStorage.setItem(key, new Date().toISOString()); } catch {}
  }, [userId]);

  const openLegalLink = useCallback((label: string, url: string) => {
    Linking.openURL(url).catch(() => Alert.alert("Erreur", `Impossible d'ouvrir ${label}.`));
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Pastel.primary} />}
    >
      {/* ── HERO ── */}
      <View style={[styles.heroSection, { paddingTop: insets.top + 16 }]}>
        <View style={[styles.topRightBtns, { top: insets.top + 10 }]}>
          <Pressable style={styles.topIconBtn} onPress={() => router.push("/profile/notification-settings" as any)} hitSlop={10}>
            <Ionicons name="notifications-outline" size={24} color={Pastel.text} />
          </Pressable>
          <Pressable style={styles.topIconBtn} onPress={handleOpenChat} hitSlop={10}>
            <Ionicons name="chatbubbles-outline" size={24} color={Pastel.text} />
            {unreadMessages > 0 ? (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{unreadMessages > 99 ? "99+" : unreadMessages}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <Pressable style={styles.avatarWrap} onPress={() => setEditingProfile(true)}>
          {profile?.avatar_url && !avatarLoadFailed ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatarImg}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initialsFrom(profile, email)}</Text>
            </View>
          )}
          <View style={styles.avatarCameraBtn}>
            <Ionicons name="camera" size={13} color="#FFFFFF" />
          </View>
        </Pressable>

        <Text style={styles.heroName}>{displayName}</Text>

        <View style={styles.heroMetaRow}>
          <View style={[styles.trustBadge, { backgroundColor: trustBadge.bg }]}>
            <Ionicons name={trustBadge.icon as any} size={11} color={trustBadge.color} />
            <Text style={[styles.trustBadgeText, { color: trustBadge.color }]}>{trustBadge.label}</Text>
          </View>
          {cityLabel ? (
            <View style={styles.cityRow}>
              <Ionicons name="location-outline" size={12} color={Pastel.textMuted} />
              <Text style={styles.cityText}>{cityLabel}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.heroBio}>
          {profile?.bio?.trim() || "Ajoute une bio pour te présenter 👋"}
        </Text>

        {/* Actions */}
        <View style={styles.heroActions}>
          <Pressable style={styles.heroPrimaryBtn} onPress={() => setEditingProfile(true)}>
            <Ionicons name="create-outline" size={15} color="#FFFFFF" />
            <Text style={styles.heroPrimaryBtnText}>Modifier le profil</Text>
          </Pressable>
        </View>
      </View>

      {/* ── STATS ── */}
      <View style={styles.statsRow}>
        <Pressable style={styles.statItem} onPress={handleOpenFriends}>
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>Amis</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.statItem} onPress={handleOpenFavorites}>
          <Text style={styles.statValue}>{favoritesCount}</Text>
          <Text style={styles.statLabel}>Favoris</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.statItem} onPress={handleOpenReservations}>
          <Text style={styles.statValue}>{userReservations.length}</Text>
          <Text style={styles.statLabel}>Réservations</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.statItem} onPress={handleOpenUpcoming}>
          <Text style={styles.statValue}>{upcomingCount}</Text>
          <Text style={styles.statLabel}>Événements</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.statItem} onPress={handleOpenFollowers}>
          <Text style={styles.statValue}>{followersCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </Pressable>
      </View>

      {/* ── COMPLETION (seulement si profil incomplet) ── */}
      {score < 80 ? (
        <View style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionLabel}>Profil complété</Text>
            <Text style={styles.completionScore}>{scoreLabel}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${score}%` as any }]} />
          </View>
          <Text style={styles.completionHint}>
            {score < 40
              ? "Ajoute ta photo, ville et bio pour booster ton profil."
              : "Tu y es presque ! Complète les derniers champs."}
          </Text>
        </View>
      ) : null}

      {/* ── EDIT FORM ── */}
      {editingProfile ? (
        <View style={styles.editCard}>
          <Text style={styles.editCardTitle}>Modifier mon profil</Text>
          <View style={styles.editRow}>
            <TextInput
              value={profileForm.firstname}
              onChangeText={(value) => setProfileForm((prev) => ({ ...prev, firstname: value }))}
              placeholder="Prénom"
              placeholderTextColor={Pastel.textMuted}
              style={[styles.editInput, { flex: 1 }]}
            />
            <TextInput
              value={profileForm.lastname}
              onChangeText={(value) => setProfileForm((prev) => ({ ...prev, lastname: value }))}
              placeholder="Nom"
              placeholderTextColor={Pastel.textMuted}
              style={[styles.editInput, { flex: 1 }]}
            />
          </View>
          <TextInput
            value={profileForm.handle}
            onChangeText={(value) => setProfileForm((prev) => ({ ...prev, handle: value }))}
            placeholder="Pseudo (@jovialien)"
            placeholderTextColor={"#9CA3AF"}
            style={styles.editInput}
            autoCapitalize="none"
          />
          <TextInput
            value={profileForm.city}
            onChangeText={(value) => setProfileForm((prev) => ({ ...prev, city: value }))}
            placeholder="Ville"
            placeholderTextColor={"#9CA3AF"}
            style={styles.editInput}
          />
          <TextInput
            value={profileForm.bio}
            onChangeText={(value) => setProfileForm((prev) => ({ ...prev, bio: value }))}
            placeholder="Bio — présente-toi en quelques mots…"
            placeholderTextColor={"#9CA3AF"}
            style={[styles.editInput, { minHeight: 70, textAlignVertical: "top" }]}
            multiline
            maxLength={200}
          />
          <Pressable style={styles.photoPickerRow} onPress={() => {
            if (Platform.OS === "ios") {
              ActionSheetIOS.showActionSheetWithOptions(
                { options: ["Annuler", "Album photo", "Selfie"], cancelButtonIndex: 0 },
                (index) => {
                  if (index === 1) handlePickAvatar("library");
                  if (index === 2) handlePickAvatar("camera");
                }
              );
            } else {
              Alert.alert("Photo de profil", "Choisis une option", [
                { text: "Annuler", style: "cancel" },
                { text: "Album", onPress: () => handlePickAvatar("library") },
                { text: "Selfie", onPress: () => handlePickAvatar("camera") },
              ]);
            }
          }}>
            <View style={styles.photoPickerIcon}>
              <Ionicons name="camera-outline" size={18} color={Pastel.text} />
            </View>
            <Text style={styles.photoPickerText}>Changer la photo de profil</Text>
            <Ionicons name="chevron-forward" size={16} color={Pastel.textMuted} />
          </Pressable>
          <View style={styles.editActions}>
            <Pressable style={styles.editCancel} onPress={handleCancelEdit} disabled={savingProfile}>
              <Text style={styles.editCancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.editSave} onPress={handleSaveProfile} disabled={savingProfile}>
              <Text style={styles.editSaveText}>{savingProfile ? "Sauvegarde…" : "Enregistrer"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── TROUVER DES AMIS ── */}
      <View style={styles.friendsCard}>
        {pendingRequestsCount > 0 ? (
          <Pressable style={styles.pendingRequestsBanner} onPress={() => router.push("/profile/follow-requests" as any)}>
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
            <Text style={styles.pendingRequestsText}>
              {pendingRequestsCount} demande{pendingRequestsCount > 1 ? "s" : ""} de suivi en attente
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <Text style={styles.sectionTitle}>Trouver des amis</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={"#9CA3AF"} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher par prénom, nom ou pseudo"
            placeholderTextColor={"#9CA3AF"}
            selectionColor={Pastel.primary}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={Pastel.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {searchQuery.trim().length >= 2 ? (
          searchLoading ? (
            <Text style={styles.searchHint}>Recherche…</Text>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchEmpty}>
              <Ionicons name="people-outline" size={20} color={Pastel.textMuted} />
              <Text style={styles.searchHint}>Aucun utilisateur trouvé.</Text>
            </View>
          ) : (
            <View style={styles.searchList}>
              {searchResults.slice(0, 8).map((item) => (
                <Pressable
                  key={item.user_id}
                  style={({ pressed }) => [styles.searchRow, pressed ? { opacity: 0.85 } : null]}
                  onPress={() => router.push(`/profile/${item.user_id}` as any)}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.searchAvatar} />
                  ) : (
                    <View style={[styles.searchAvatar, styles.searchAvatarFallback]}>
                      <Text style={styles.searchAvatarText}>
                        {displayNameFromParts(item.firstname, item.lastname, item.handle).slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.searchInfo}>
                    <Text style={styles.searchName}>
                      {displayNameFromParts(item.firstname, item.lastname, item.handle)}
                    </Text>
                    <Text style={styles.searchMeta}>{item.city ?? "Ville non renseignée"}</Text>
                  </View>
                  {item.user_id !== userId ? (
                    <Pressable
                      style={[
                        styles.followBtn,
                        followingIds.includes(item.user_id) ? styles.followBtnActive :
                        pendingIds.includes(item.user_id) ? styles.followBtnPending : null
                      ]}
                      onPress={() => handleToggleFollow(item.user_id, item.is_private ?? false)}
                    >
                      <Text style={[
                        styles.followBtnText,
                        followingIds.includes(item.user_id) ? styles.followBtnTextActive :
                        pendingIds.includes(item.user_id) ? styles.followBtnTextPending : null
                      ]}>
                        {followingIds.includes(item.user_id) ? "✓ Suivi" :
                         pendingIds.includes(item.user_id) ? "⏳ Demandé" :
                         item.is_private ? "🔒 Demander" : "+ Suivre"}
                      </Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )
        ) : null}
      </View>

      {/* ── JOVIAL+ BANNER ── */}
      {!isPremium ? (
        <Pressable style={styles.premiumBanner} onPress={() => router.push("/premium" as any)}>
          <View style={styles.premiumBannerLeft}>
            <Text style={styles.premiumBannerBadge}>✦ JOVIAL+</Text>
            <Text style={styles.premiumBannerTitle}>Passe au niveau supérieur</Text>
            <Text style={styles.premiumBannerSub}>Favoris illimités, agenda des amis, offres exclusives…</Text>
          </View>
          <View style={styles.premiumBannerArrow}>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : (
        <Pressable style={styles.premiumBannerActive} onPress={() => router.push("/premium" as any)}>
          <Ionicons name="checkmark-circle" size={18} color={Pastel.orange} />
          <Text style={styles.premiumBannerActiveText}>Abonné Jovial+ ✦</Text>
          <Ionicons name="chevron-forward" size={14} color={Pastel.orange} style={{ marginLeft: "auto" }} />
        </Pressable>
      )}

      {/* ── PARAMÈTRES & COMPTE ── */}
      <View style={styles.settingsCard}>
        <Text style={styles.sectionTitle}>Compte & Paramètres</Text>

        <Pressable style={styles.settingsRow} onPress={() => router.push("/profile/settings" as any)}>
          <View style={[styles.settingsIcon, { backgroundColor: Pastel.primarySoft }]}>
            <Ionicons name="settings-outline" size={18} color="#3B82F6" />
          </View>
          <Text style={styles.settingsRowText}>Paramètres</Text>
          <Ionicons name="chevron-forward" size={16} color={Pastel.textMuted} />
        </Pressable>

        <Pressable style={styles.settingsRow} onPress={() => openLegalLink("Politique de confidentialité", "https://jovial.app/confidentialite")}>
          <View style={[styles.settingsIcon, { backgroundColor: "#F5F3FF" }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#8B5CF6" />
          </View>
          <Text style={styles.settingsRowText}>Confidentialité & RGPD</Text>
          <Ionicons name="chevron-forward" size={16} color={Pastel.textMuted} />
        </Pressable>

        <Pressable style={styles.settingsRow} onPress={() => openLegalLink("Mentions légales", "https://jovial.app/mentions-legales")}>
          <View style={[styles.settingsIcon, { backgroundColor: Pastel.surfaceAlt }]}>
            <Ionicons name="document-text-outline" size={18} color={Pastel.textMuted} />
          </View>
          <Text style={styles.settingsRowText}>Mentions légales</Text>
          <Ionicons name="chevron-forward" size={16} color={Pastel.textMuted} />
        </Pressable>

        <Pressable style={styles.settingsRow} onPress={handleSuggestVenue}>
          <View style={[styles.settingsIcon, { backgroundColor: "#FFF7ED" }]}>
            <Ionicons name="storefront-outline" size={18} color={Pastel.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsRowText}>Proposer un établissement</Text>
            <Text style={{ fontSize: 11, color: Pastel.textMuted, fontFamily: Font.regular }}>Gagne 3 mois Premium offerts 🎁</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Pastel.textMuted} />
        </Pressable>

        <Pressable style={[styles.settingsRow, styles.logoutRow]} onPress={handleLogout}>
          <View style={[styles.settingsIcon, { backgroundColor: "#FEF2F2" }]}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </View>
          <Text style={[styles.settingsRowText, { color: Pastel.danger }]}>Se déconnecter</Text>
        </Pressable>
      </View>

      {/* ── RGPD note ── */}
      <View style={styles.rgpdNote}>
        <Ionicons name="lock-closed-outline" size={13} color={Pastel.textMuted} />
        <Text style={styles.rgpdText}>
          Tes données sont protégées conformément au RGPD. Pour exporter ou supprimer ton compte, contacte-nous à{" "}
          <Text style={styles.rgpdLink} onPress={() => Linking.openURL("mailto:contact@jovial.app")}>
            contact@jovial.app
          </Text>
          .
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Pastel.background },
  loadingText: { color: Pastel.textMuted, fontSize: 14, fontFamily: Font.regular, includeFontPadding: false },

  container: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 60,
    gap: 0,
    backgroundColor: Pastel.background,
  },

  topRightBtns: {
    position: "absolute",
    right: 12,
    flexDirection: "row",
    gap: 4,
  },
  topIconBtn: {
    padding: 8,
  },
  chatBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Pastel.background,
  },
  chatBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
    lineHeight: 13,
  },

  /* ── HERO ── */
  heroSection: {
    backgroundColor: Pastel.surface,
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "visible",
    alignSelf: "center",
    position: "relative",
    marginBottom: 4,
  },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.primarySoft,
  },
  avatarInitials: { fontSize: 34, fontFamily: Font.extraBold, color: Pastel.primary, includeFontPadding: false },
  avatarCameraBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  heroName: { fontSize: 26, fontFamily: Font.display, color: Pastel.text, textAlign: "center", letterSpacing: 1, includeFontPadding: false },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  cityText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  trustBadgeText: { fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  heroBio: {
    fontSize: 13,
    color: Pastel.textMuted,
    textAlign: "center",
    lineHeight: 19,
    fontFamily: Font.regular,
    marginTop: 2,
    marginBottom: 4,
    includeFontPadding: false,
  },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Pastel.orange,
  },
  heroPrimaryBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 13, includeFontPadding: false },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── STATS ── */
  statsRow: {
    flexDirection: "row",
    backgroundColor: Pastel.surface,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    gap: 2,
  },
  statDivider: { width: 1, backgroundColor: Pastel.border, marginVertical: 12 },
  statValue: { fontSize: 22, fontFamily: Font.display, color: Pastel.primary, letterSpacing: 0.5, includeFontPadding: false },
  statLabel: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },

  /* ── COMPLETION ── */
  completionCard: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  completionHeader: { flexDirection: "row", justifyContent: "space-between" },
  completionLabel: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  completionScore: { fontSize: 12, fontFamily: Font.bold, color: Pastel.primary, includeFontPadding: false },
  progressTrack: { height: 5, borderRadius: 999, backgroundColor: Pastel.surfaceAlt },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: Pastel.orange },
  completionHint: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },

  /* ── EDIT FORM ── */
  editCard: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 10,
  },
  editCardTitle: { fontSize: 15, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  editRow: { flexDirection: "row", gap: 10 },
  editInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: Pastel.surfaceAlt,
    color: Pastel.text,
    fontSize: 14,
    fontFamily: Font.regular,
    includeFontPadding: false,
  },
  photoPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
  },
  photoPickerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerText: { flex: 1, fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  editActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  editCancel: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  editCancelText: { color: Pastel.text, fontFamily: Font.semiBold, fontSize: 14, includeFontPadding: false },
  editSave: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: Pastel.primary,
  },
  editSaveText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 14, includeFontPadding: false },

  friendsCard: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  searchInput: { flex: 1, color: Pastel.text, fontSize: 14, fontFamily: Font.regular, includeFontPadding: false },
  searchHint: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  searchEmpty: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  searchList: { gap: 0 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  searchAvatar: { width: 44, height: 44, borderRadius: 22 },
  searchAvatarFallback: { backgroundColor: Pastel.primarySoft, alignItems: "center", justifyContent: "center" },
  searchAvatarText: { color: Pastel.primary, fontFamily: Font.extraBold, fontSize: 13, includeFontPadding: false },
  searchInfo: { flex: 1, gap: 2 },
  searchName: { color: Pastel.text, fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  searchMeta: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.regular, includeFontPadding: false },
  pendingRequestsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Pastel.primary,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pendingRequestsText: { flex: 1, color: "#FFFFFF", fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.primary,
    backgroundColor: Pastel.primary,
  },
  followBtnActive: { backgroundColor: Pastel.surfaceAlt, borderColor: Pastel.border },
  followBtnPending: { backgroundColor: "#FFF7ED", borderColor: "#F97316" },
  followBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  followBtnTextActive: { color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  followBtnTextPending: { color: "#F97316", fontFamily: Font.regular, includeFontPadding: false },

  premiumBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Pastel.primary,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  premiumBannerLeft: { flex: 1, gap: 4 },
  premiumBannerBadge: {
    color: Pastel.cream,
    fontSize: 10,
    fontFamily: Font.extraBold,
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
  premiumBannerTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: Font.extraBold, includeFontPadding: false },
  premiumBannerSub: { color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 17, fontFamily: Font.regular, includeFontPadding: false },
  premiumBannerArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumBannerActive: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Pastel.cream,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  premiumBannerActiveText: { color: Pastel.accentText, fontSize: 13, fontFamily: Font.bold, includeFontPadding: false },

  settingsCard: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
    paddingHorizontal: 16,
    paddingTop: 4,
    marginBottom: 12,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  logoutRow: { borderBottomWidth: 0 },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsRowText: { flex: 1, fontSize: 14, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },

  reservationsCard: {
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Pastel.border,
    paddingHorizontal: 16,
    paddingTop: 4,
    marginBottom: 12,
  },
  reservationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  reservationInfo: { flex: 1, gap: 2 },
  reservationActivity: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  reservationVenue: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },
  reservationDate: { fontSize: 12, color: Pastel.textMuted, marginTop: 2, fontFamily: Font.regular, includeFontPadding: false },
  reservationRight: { alignItems: "flex-end", gap: 6 },
  reservationStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reservationStatusText: { fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  reservationCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  reservationCancelText: { fontSize: 11, fontFamily: Font.bold, color: Pastel.danger, includeFontPadding: false },

  rgpdNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  rgpdText: { flex: 1, fontSize: 11, color: Pastel.textMuted, lineHeight: 16, fontFamily: Font.regular, includeFontPadding: false },
  rgpdLink: { color: Pastel.primary, fontFamily: Font.semiBold, includeFontPadding: false },
});
