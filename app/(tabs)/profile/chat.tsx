import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  reply_to_id: number | null;
  edited_at: string | null;
};

type ReactionRow = { message_id: number; user_id: string; emoji: string };

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥"];

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

function formatFullDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

// Avatar : photo de profil si disponible, sinon cercle colore avec initiales.
function ChatAvatar({
  profile,
  userId,
  style,
  textStyle,
}: {
  profile?: ProfileLite | null;
  userId: string;
  style: any;
  textStyle: any;
}) {
  const uri = profile?.avatar_url?.trim();
  if (uri) {
    return <Image source={{ uri }} style={style} contentFit="cover" transition={120} />;
  }
  return (
    <View style={[style, { backgroundColor: avatarColor(userId) }]}>
      <Text style={textStyle}>{getInitials(profile)}</Text>
    </View>
  );
}

export default function ProfileChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { friend: friendParam } = useLocalSearchParams<{ friend?: string }>();
  const [expandedMsgId, setExpandedMsgId] = useState<number | null>(null);

  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  const initialLoadDone = useRef(false);
  const messageIdsRef = useRef<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [friends, setFriends] = useState<ProfileLite[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [friendQuery, setFriendQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<Record<number, ReactionRow[]>>({});
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);

  const selectedFriend = useMemo(
    () => friends.find((f) => f.user_id === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  // Ouverture directe d'une conversation (ex: depuis une notification de message)
  useEffect(() => {
    if (friendParam) setSelectedFriendId(friendParam);
  }, [friendParam]);

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

  // Charge uniquement les reactions (sans toucher au spinner ni recharger les messages)
  const loadReactions = useCallback(async (ids: number[]) => {
    if (!ids.length) { setReactions({}); return; }
    const { data: reacts } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", ids);
    const map: Record<number, ReactionRow[]> = {};
    ((reacts as ReactionRow[] | null) ?? []).forEach((r) => {
      (map[r.message_id] = map[r.message_id] ?? []).push(r);
    });
    setReactions(map);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!userId || !selectedFriendId) { setMessages([]); setReactions({}); setLoading(false); return; }
    // Spinner plein ecran UNIQUEMENT au 1er chargement d'une conversation (sinon la liste
    // se demonterait/clignoterait a chaque action ou message recu).
    if (!initialLoadDone.current) setLoading(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, sender_id, recipient_id, body, created_at, reply_to_id, edited_at")
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${selectedFriendId}),and(sender_id.eq.${selectedFriendId},recipient_id.eq.${userId})`)
      .order("created_at", { ascending: true })
      .limit(120);
    const list = (data as ChatMessage[] | null) ?? [];
    if (!error) setMessages(list);
    initialLoadDone.current = true;
    setLoading(false);
    await loadReactions(list.map((m) => m.id));
  }, [selectedFriendId, userId, loadReactions]);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { initialLoadDone.current = false; }, [selectedFriendId]);
  useEffect(() => { loadMessages(); }, [loadMessages, selectedFriendId]);
  useEffect(() => { messageIdsRef.current = messages.map((m) => m.id); }, [messages]);

  // A l'ouverture d'une conversation (ou apres chargement), se placer sur le dernier message.
  useEffect(() => {
    if (loading || messages.length === 0) return;
    const t1 = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 60);
    const t2 = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading, messages, selectedFriendId]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => { loadMessages(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => { loadReactions(messageIdsRef.current); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMessages, loadReactions]);

  const canSend = useMemo(
    () => !!userId && !!selectedFriendId && input.trim().length > 0 && !sending,
    [input, selectedFriendId, sending, userId]
  );

  const handleSend = useCallback(async () => {
    if (!userId || !selectedFriendId || !canSend) return;
    const body = input.trim();
    if (!body) return;
    setSending(true);

    // Mode modification d'un message existant
    if (editingMsg) {
      const { error } = await supabase
        .from("chat_messages")
        .update({ body, edited_at: new Date().toISOString() })
        .eq("id", editingMsg.id);
      if (!error) {
        setInput("");
        setEditingMsg(null);
        await loadMessages();
      }
      setSending(false);
      return;
    }

    const payload: any = { sender_id: userId, recipient_id: selectedFriendId, body };
    if (replyingTo) payload.reply_to_id = replyingTo.id;
    const { error } = await supabase.from("chat_messages").insert(payload);
    if (!error) {
      setInput("");
      setReplyingTo(null);
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
  }, [canSend, editingMsg, input, loadMessages, replyingTo, selectedFriendId, userId]);

  // Ajoute / change / retire SA reaction sur un message
  const toggleReaction = useCallback(async (message: ChatMessage, emoji: string) => {
    if (!userId) return;
    setActionMsg(null);
    const mine = (reactions[message.id] ?? []).find((r) => r.user_id === userId);
    try {
      if (mine && mine.emoji === emoji) {
        await supabase.from("message_reactions").delete().eq("message_id", message.id).eq("user_id", userId);
      } else {
        await supabase
          .from("message_reactions")
          .upsert({ message_id: message.id, user_id: userId, emoji }, { onConflict: "message_id,user_id" });
      }
      await loadReactions(messages.map((m) => m.id));
    } catch { /* ignore */ }
  }, [reactions, userId, messages, loadReactions]);

  const handleDelete = useCallback((message: ChatMessage) => {
    setActionMsg(null);
    Alert.alert("Supprimer le message", "Ce message sera définitivement supprimé.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.from("chat_messages").delete().eq("id", message.id);
            await loadMessages();
          } catch { /* ignore */ }
        },
      },
    ]);
  }, [loadMessages]);

  const startReply = useCallback((message: ChatMessage) => {
    setActionMsg(null);
    // Si on etait en mode modification, on remet l'input a zero (sinon on garde le brouillon en cours).
    if (editingMsg) setInput("");
    setEditingMsg(null);
    setReplyingTo(message);
  }, [editingMsg]);

  const startEdit = useCallback((message: ChatMessage) => {
    setActionMsg(null);
    setReplyingTo(null);
    setEditingMsg(message);
    setInput(message.body);
  }, []);

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
          <ChatAvatar
            profile={selectedFriend}
            userId={selectedFriend.user_id}
            style={styles.avatarCircle}
            textStyle={styles.avatarText}
          />
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
              return (
                <Pressable style={styles.friendItem} onPress={() => setSelectedFriendId(item.user_id)}>
                  <ChatAvatar
                    profile={item}
                    userId={item.user_id}
                    style={[styles.friendAvatar, active ? styles.friendAvatarActive : null]}
                    textStyle={styles.friendAvatarText}
                  />
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
                  <ChatAvatar
                    profile={selectedFriend}
                    userId={item.sender_id}
                    style={styles.msgAvatar}
                    textStyle={styles.msgAvatarText}
                  />
                ) : null}
                <View style={styles.bubbleCol}>
                  <View
                    style={[
                      styles.bubbleHolder,
                      mine ? styles.bubbleHolderMine : styles.bubbleHolderOther,
                      (reactions[item.id]?.length ?? 0) > 0 ? styles.bubbleHolderReacted : null,
                    ]}
                  >
                    <Pressable
                      onPress={() => setExpandedMsgId((prev) => (prev === item.id ? null : item.id))}
                      onLongPress={() => setActionMsg(item)}
                      delayLongPress={250}
                      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
                    >
                      {item.reply_to_id ? (
                        <View style={[styles.quoteBox, mine ? styles.quoteBoxMine : null]}>
                          <Text style={[styles.quoteText, mine ? styles.quoteTextMine : null]} numberOfLines={1}>
                            {messages.find((m) => m.id === item.reply_to_id)?.body ?? "Message supprimé"}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[styles.body, mine ? styles.bodyMine : null]}>{item.body}</Text>
                    </Pressable>

                    {(reactions[item.id]?.length ?? 0) > 0 ? (
                      <View style={[styles.reactionBadge, mine ? styles.reactionBadgeMine : styles.reactionBadgeOther]}>
                        <Text style={styles.reactionBadgeEmoji}>
                          {Array.from(new Set((reactions[item.id] ?? []).map((r) => r.emoji))).join(" ")}
                        </Text>
                        {(reactions[item.id]?.length ?? 0) > 1 ? (
                          <Text style={styles.reactionBadgeCount}>{reactions[item.id]?.length}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.time, mine ? styles.timeMine : null]}>
                    {expandedMsgId === item.id
                      ? `${formatFullDate(item.created_at)} · ${formatHour(item.created_at)}`
                      : formatHour(item.created_at)}
                    {item.edited_at ? " · modifié" : ""}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── BANDEAU RÉPONSE / MODIFICATION ── */}
      {replyingTo || editingMsg ? (
        <View style={styles.replyBar}>
          <Ionicons name={editingMsg ? "create-outline" : "arrow-undo-outline"} size={16} color={Pastel.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBarLabel}>{editingMsg ? "Modification du message" : "Réponse"}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>{(editingMsg ?? replyingTo)?.body}</Text>
          </View>
          <Pressable
            onPress={() => { if (editingMsg) setInput(""); setEditingMsg(null); setReplyingTo(null); }}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={Pastel.textMuted} />
          </Pressable>
        </View>
      ) : null}

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
          <Ionicons name={editingMsg ? "checkmark" : "send"} size={16} color={canSend ? "#FFFFFF" : Pastel.textMuted} />
        </Pressable>
      </View>

      {/* ── MENU APPUI LONG SUR UN MESSAGE ── */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <Pressable
          style={[styles.menuOverlay, actionMsg?.sender_id === userId ? styles.menuOverlayMine : styles.menuOverlayOther]}
          onPress={() => setActionMsg(null)}
        >
          {actionMsg ? (
            <Pressable
              style={[styles.menuGroup, actionMsg.sender_id === userId ? styles.menuGroupMine : styles.menuGroupOther]}
              onPress={() => {}}
            >
              {/* Barre d'emojis — au-dessus du message */}
              <View style={styles.reactionBar}>
                {REACTION_EMOJIS.map((emoji) => (
                  <Pressable key={emoji} onPress={() => toggleReaction(actionMsg, emoji)} style={styles.reactionBarBtn} hitSlop={6}>
                    <Text style={styles.reactionBarEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Le message sélectionné — net, en place */}
              <View style={[styles.bubble, actionMsg.sender_id === userId ? styles.bubbleMine : styles.bubbleOther, styles.menuBubble]}>
                <Text style={[styles.body, actionMsg.sender_id === userId ? styles.bodyMine : null]} numberOfLines={8}>
                  {actionMsg.body}
                </Text>
              </View>

              {/* Menu d'actions — en-dessous */}
              <View style={styles.menuCard}>
                <Pressable style={styles.menuItem} onPress={() => startReply(actionMsg)}>
                  <Ionicons name="arrow-undo-outline" size={19} color={Pastel.text} />
                  <Text style={styles.menuItemText}>Répondre</Text>
                </Pressable>
                {actionMsg.sender_id === userId ? (
                  <>
                    <Pressable style={[styles.menuItem, styles.menuItemBorder]} onPress={() => startEdit(actionMsg)}>
                      <Ionicons name="create-outline" size={19} color={Pastel.text} />
                      <Text style={styles.menuItemText}>Modifier</Text>
                    </Pressable>
                    <Pressable style={[styles.menuItem, styles.menuItemBorder]} onPress={() => handleDelete(actionMsg)}>
                      <Ionicons name="trash-outline" size={19} color="#EF4444" />
                      <Text style={[styles.menuItemText, { color: "#EF4444" }]}>Supprimer</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
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

  // Citation (reponse a un message)
  quoteBox: { borderLeftWidth: 3, borderLeftColor: Pastel.teal, paddingLeft: 8, marginBottom: 5 },
  quoteBoxMine: { borderLeftColor: "rgba(255,255,255,0.7)" },
  quoteText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.regular, fontStyle: "italic" },
  quoteTextMine: { color: "rgba(255,255,255,0.85)" },

  // Reaction : petit badge colle au coin du message (plus de pastille separee)
  bubbleHolder: { position: "relative" },
  bubbleHolderMine: { alignSelf: "flex-end" },
  bubbleHolderOther: { alignSelf: "flex-start" },
  bubbleHolderReacted: { marginBottom: 10 },
  reactionBadge: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Pastel.surface,
    borderWidth: 0.5,
    borderColor: Pastel.border,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  reactionBadgeMine: { right: 4 },
  reactionBadgeOther: { left: 4 },
  reactionBadgeEmoji: { fontSize: 12, includeFontPadding: false },
  reactionBadgeCount: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.bold, includeFontPadding: false },

  // Bandeau reponse / modification (au-dessus du composer)
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Pastel.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replyBarLabel: { fontSize: 11, color: Pastel.primary, fontFamily: Font.bold, includeFontPadding: false },
  replyBarText: { fontSize: 13, color: Pastel.textMuted, fontFamily: Font.regular, includeFontPadding: false },

  // Menu appui long (style iMessage : emojis au-dessus, message net, actions en-dessous)
  menuOverlay: { flex: 1, backgroundColor: "rgba(15,18,30,0.45)", justifyContent: "center", paddingHorizontal: 18 },
  menuOverlayMine: { alignItems: "flex-end" },
  menuOverlayOther: { alignItems: "flex-start" },
  menuGroup: { gap: 9, maxWidth: "92%" },
  menuGroupMine: { alignItems: "flex-end" },
  menuGroupOther: { alignItems: "flex-start" },
  reactionBar: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: Pastel.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  reactionBarBtn: { paddingHorizontal: 1 },
  reactionBarEmoji: { fontSize: 26, includeFontPadding: false },
  menuBubble: { maxWidth: "80%" },
  menuCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 14,
    width: 200,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  menuItemBorder: { borderTopWidth: 0.5, borderTopColor: Pastel.border },
  menuItemText: { fontSize: 14, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
});
