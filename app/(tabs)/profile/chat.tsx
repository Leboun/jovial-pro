import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/services/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const LAST_CHAT_READ_KEY = "last_chat_read_at";

type ChatMessage = {
  id: number;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
};

type ProfileLite = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  avatar_url?: string | null;
};

function getDisplayName(profile?: ProfileLite | null) {
  if (!profile) return "Membre";
  const first = (profile.firstname ?? "").trim();
  if (first) return first;
  const last = (profile.lastname ?? "").trim();
  if (last) return last;
  const handle = (profile.handle ?? "").trim();
  if (handle) return `@${handle}`;
  return "Membre";
}

function getInitials(profile?: ProfileLite | null) {
  const name = getDisplayName(profile);
  return name.slice(0, 2).toUpperCase();
}

function formatHour(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function matchesSearch(profile: ProfileLite, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [profile.firstname ?? "", profile.lastname ?? "", profile.handle ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

const AVATAR_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];
function avatarColor(userId: string) {
  const n = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function ProfileChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [friends, setFriends] = useState<ProfileLite[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [friendQuery, setFriendQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const selectedFriend = useMemo(
    () => friends.find((f) => f.user_id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  const filteredFriends = useMemo(
    () => friends.filter((f) => matchesSearch(f, friendQuery)),
    [friendQuery, friends]
  );

  const loadFriends = useCallback(async () => {
    if (!userId) { setFriends([]); setSelectedFriendId(null); return; }

    const [{ data: followingRows }, { data: followersRows }] = await Promise.all([
      supabase.from("user_follows").select("following_id").eq("follower_id", userId),
      supabase.from("user_follows").select("follower_id").eq("following_id", userId),
    ]);

    const ids = Array.from(new Set([
      ...((followingRows ?? []).map((r: any) => String(r.following_id ?? ""))),
      ...((followersRows ?? []).map((r: any) => String(r.follower_id ?? ""))),
    ])).filter(Boolean);

    if (ids.length === 0) { setFriends([]); setSelectedFriendId(null); return; }

    const { data } = await supabase
      .from("profiles")
      .select("user_id, handle, firstname, lastname, avatar_url")
      .in("user_id", ids);

    const next = ((data as ProfileLite[] | null) ?? []).filter((r) => !!r?.user_id);
    setFriends(next);
    setSelectedFriendId((prev) => {
      if (prev && next.some((f) => f.user_id === prev)) return prev;
      return next[0]?.user_id ?? null;
    });
  }, [userId]);

  const loadMessages = useCallback(async () => {
    if (!userId || !selectedFriendId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${selectedFriendId}),and(sender_id.eq.${selectedFriendId},recipient_id.eq.${userId})`)
      .order("created_at", { ascending: true })
      .limit(120);
    if (!error) setMessages((data as ChatMessage[] | null) ?? []);
    setLoading(false);
  }, [selectedFriendId, userId]);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { loadMessages(); }, [loadMessages, selectedFriendId]);

  // Mark all messages as read when the chat screen is open
  useEffect(() => {
    AsyncStorage.setItem(LAST_CHAT_READ_KEY, new Date().toISOString()).catch(() => {});
    const interval = setInterval(() => {
      AsyncStorage.setItem(LAST_CHAT_READ_KEY, new Date().toISOString()).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("chat_messages_updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => { loadMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages]);

  const canSend = useMemo(
    () => !!userId && !!selectedFriendId && input.trim().length > 0 && !sending,
    [input, selectedFriendId, sending, userId]
  );

  const handleSend = useCallback(async () => {
    if (!userId || !selectedFriendId || !canSend) return;
    const body = input.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({ sender_id: userId, recipient_id: selectedFriendId, body });
    if (!error) {
      setInput("");
      await loadMessages();
      listRef.current?.scrollToEnd({ animated: true });
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
      if (supabaseUrl) {
        fetch(`${supabaseUrl}/functions/v1/notify-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseAnonKey}` },
          body: JSON.stringify({ sender_id: userId, receiver_id: selectedFriendId, message_preview: body }),
        }).catch(() => {});
      }
    }
    setSending(false);
  }, [canSend, input, loadMessages, selectedFriendId, userId]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {selectedFriend ? getDisplayName(selectedFriend) : "Discussions"}
          </Text>
          {selectedFriend ? (
            <Text style={styles.subtitle}>conversation privée</Text>
          ) : (
            <Text style={styles.subtitle}>Choisis un ami pour discuter</Text>
          )}
        </View>
        {selectedFriend ? (
          <View style={[styles.avatarCircle, { backgroundColor: avatarColor(selectedFriend.user_id) }]}>
            <Text style={styles.avatarText}>{getInitials(selectedFriend)}</Text>
          </View>
        ) : null}
      </View>

      {/* ── FRIEND SELECTOR ── */}
      {friends.length > 0 || friendQuery.length > 0 ? (
        <View style={styles.selectorWrap}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color={Pastel.textMuted} />
            <TextInput
              value={friendQuery}
              onChangeText={setFriendQuery}
              placeholder="Rechercher un ami"
              placeholderTextColor={Pastel.textMuted}
              style={styles.searchInput}
            />
          </View>
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.user_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendsRow}
            renderItem={({ item }) => {
              const active = item.user_id === selectedFriendId;
              const color = avatarColor(item.user_id);
              return (
                <Pressable style={styles.friendItem} onPress={() => setSelectedFriendId(item.user_id)}>
                  <View style={[styles.friendAvatar, { backgroundColor: color }, active ? styles.friendAvatarActive : null]}>
                    <Text style={styles.friendAvatarText}>{getInitials(item)}</Text>
                  </View>
                  <Text style={[styles.friendName, active ? styles.friendNameActive : null]} numberOfLines={1}>
                    {getDisplayName(item)}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyFriends}>Aucun ami. Ajoute des amis depuis ton profil.</Text>
            }
          />
        </View>
      ) : null}

      {/* ── MESSAGES ── */}
      {!selectedFriendId ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={48} color={Pastel.border} />
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptyText}>Ajoute des amis depuis ton profil pour discuter.</Text>
        </View>
      ) : loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Pastel.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Aucun message pour l'instant. Dis bonjour 👋</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === userId;
            return (
              <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : null]}>
                {!mine ? (
                  <View style={[styles.msgAvatar, { backgroundColor: avatarColor(item.sender_id) }]}>
                    <Text style={styles.msgAvatarText}>{getInitials(selectedFriend)}</Text>
                  </View>
                ) : null}
                <View style={styles.bubbleCol}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.body, mine ? styles.bodyMine : null]}>{item.body}</Text>
                  </View>
                  <Text style={[styles.time, mine ? styles.timeMine : null]}>{formatHour(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── COMPOSER ── */}
      <View style={[styles.composer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Écrire un message…"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          multiline
          maxLength={500}
          editable={!!selectedFriendId}
        />
        <Pressable
          style={[styles.sendBtn, !canSend ? styles.sendBtnDisabled : null]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Ionicons name="send" size={16} color={canSend ? "#FFFFFF" : Pastel.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  title: { fontSize: 17, fontFamily: Font.bold, color: Pastel.text },
  subtitle: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 13 },

  selectorWrap: {
    backgroundColor: Pastel.surface,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
    gap: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Pastel.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: { flex: 1, color: Pastel.text, fontSize: 14, fontFamily: Font.regular },
  friendsRow: { gap: 16, paddingHorizontal: 16, paddingBottom: 4 },
  friendItem: { alignItems: "center", gap: 4, width: 56 },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
  },
  friendAvatarActive: { opacity: 1, borderWidth: 2, borderColor: Pastel.primary },
  friendAvatarText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 15 },
  friendName: { fontSize: 11, color: Pastel.textMuted, textAlign: "center", fontFamily: Font.regular },
  friendNameActive: { color: Pastel.text, fontFamily: Font.bold },
  emptyFriends: { fontSize: 13, color: Pastel.textMuted, paddingHorizontal: 16, paddingVertical: 8, fontFamily: Font.regular },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text },
  emptyText: { fontSize: 14, color: Pastel.textMuted, textAlign: "center", lineHeight: 20, fontFamily: Font.regular },

  listContent: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, alignSelf: "flex-start", maxWidth: "82%" },
  bubbleWrapMine: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  msgAvatarText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 10 },
  bubbleCol: { gap: 3 },
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 18 },
  bubbleMine: { backgroundColor: Pastel.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Pastel.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Pastel.border },
  body: { color: Pastel.text, fontSize: 14, lineHeight: 20, fontFamily: Font.regular },
  bodyMine: { color: "#FFFFFF" },
  time: { fontSize: 11, color: Pastel.textMuted, marginLeft: 4, fontFamily: Font.regular },
  timeMine: { textAlign: "right", marginRight: 4 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: Pastel.surface,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: Pastel.text,
    fontSize: 14,
    fontFamily: Font.regular,
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.primary,
  },
  sendBtnDisabled: { backgroundColor: Pastel.surfaceAlt },
});
