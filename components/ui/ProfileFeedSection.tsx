import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { Pastel } from "@/constants/pastel";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/services/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

type PostRow = {
  id: number;
  author_id: string | null;
  body: string | null;
  created_at: string;
};

type ProfileLite = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  avatar_url: string | null;
};

type CommentRow = {
  id: number;
  post_id: number;
  user_id: string;
  body: string;
  created_at: string;
  author?: ProfileLite | null;
};

type PollOptionUi = {
  id: number;
  label: string;
  votes: number;
  percent: number;
};

type PollUi = {
  id: number;
  question: string;
  options: PollOptionUi[];
  totalVotes: number;
  myOptionId: number | null;
  canVote: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function displayNameFromProfile(profile?: ProfileLite | null) {
  if (!profile) return "Utilisateur";
  const first = (profile.firstname ?? "").trim();
  if (first) return first;
  const last = (profile.lastname ?? "").trim();
  if (last) return last;
  const handle = (profile.handle ?? "").trim();
  if (handle) return `@${handle}`;
  return "Utilisateur";
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "hier";
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
}

// ─── LikeButton ──────────────────────────────────────────────────────────────

function LikeButton({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 18 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28 }),
    ]).start();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable style={styles.actionBtn} onPress={handlePress}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? "heart" : "heart-outline"} size={19} color={liked ? "#F43F5E" : Pastel.textMuted} />
      </Animated.View>
      <Text style={[styles.actionBtnText, liked ? { color: "#F43F5E" } : null]}>
        {count > 0 ? String(count) : "J'aime"}
      </Text>
    </Pressable>
  );
}

// ─── PollOptionRow ────────────────────────────────────────────────────────────

function PollOptionRow({
  option, selected, canVote, onVote,
}: {
  option: PollOptionUi;
  selected: boolean;
  canVote: boolean;
  onVote: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: option.percent, duration: 500, useNativeDriver: false }).start();
  }, [option.percent, anim]);

  const widthInterp = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <Pressable
      onPress={canVote ? onVote : undefined}
      disabled={!canVote}
      style={[styles.pollOption, selected ? styles.pollOptionSelected : null]}
    >
      <Animated.View style={[styles.pollFill, { width: widthInterp }, selected ? styles.pollFillSelected : null]} />
      <View style={styles.pollContent}>
        <Text style={[styles.pollOptionText, selected ? styles.pollOptionTextSelected : null]} numberOfLines={1}>
          {selected ? "✓ " : ""}{option.label}
        </Text>
        <Text style={[styles.pollPercent, selected ? styles.pollPercentSelected : null]}>{option.percent}%</Text>
      </View>
    </Pressable>
  );
}

// ─── CommentsModal ────────────────────────────────────────────────────────────

function CommentsModal({
  visible,
  post,
  userId,
  selfProfile,
  onClose,
}: {
  visible: boolean;
  post: PostRow | null;
  userId: string | null;
  selfProfile: ProfileLite | null;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    if (!post) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profile_post_comments")
        .select("id, post_id, author_id, body, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []).map((r: any) => ({
        id: Number(r.id),
        post_id: Number(r.post_id),
        user_id: String(r.author_id ?? ""),
        body: String(r.body ?? ""),
        created_at: String(r.created_at ?? ""),
      })) as CommentRow[];

      const authorIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      let profileMap: Record<string, ProfileLite> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, handle, firstname, lastname, avatar_url")
          .in("user_id", authorIds);
        (profiles ?? []).forEach((p: any) => {
          profileMap[String(p.user_id)] = p as ProfileLite;
        });
      }

      setComments(rows.map((r) => ({ ...r, author: profileMap[r.user_id] ?? null })));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [post]);

  useEffect(() => {
    if (visible && post) {
      setBody("");
      loadComments();
    }
  }, [visible, post, loadComments]);

  const handleSend = async () => {
    if (!userId || !post || !body.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("profile_post_comments")
        .insert({ post_id: post.id, author_id: userId, body: body.trim() });
      if (error) throw error;
      setBody("");
      await loadComments();
    } catch (err: any) {
      const msg = err?.message ?? err?.details ?? "Erreur inconnue";
      Alert.alert("Erreur commentaire", msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalSheet}
      >
        {/* Handle */}
        <View style={styles.modalHandle} />

        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Commentaires</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color={Pastel.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.commentList}
          contentContainerStyle={styles.commentListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <Text style={styles.commentMuted}>Chargement…</Text>
          ) : comments.length === 0 ? (
            <View style={styles.commentEmpty}>
              <Text style={styles.commentEmptyEmoji}>💬</Text>
              <Text style={styles.commentEmptyTitle}>Pas encore de commentaires</Text>
              <Text style={styles.commentEmptyDesc}>Sois le premier à réagir !</Text>
            </View>
          ) : (
            comments.map((c) => {
              const name = displayNameFromProfile(c.author);
              const initials = name.slice(0, 2).toUpperCase();
              return (
                <View key={c.id} style={styles.commentRow}>
                  {c.author?.avatar_url ? (
                    <Image source={{ uri: c.author.avatar_url }} style={styles.commentAvatar} />
                  ) : (
                    <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
                      <Text style={styles.commentAvatarText}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.commentBubble}>
                    <View style={styles.commentBubbleTop}>
                      <Text style={styles.commentAuthor}>{name}</Text>
                      <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentBody}>{c.body}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.commentInputRow}>
          {selfProfile?.avatar_url ? (
            <Image source={{ uri: selfProfile.avatar_url }} style={styles.commentInputAvatar} />
          ) : (
            <View style={[styles.commentInputAvatar, styles.commentAvatarFallback]}>
              <Text style={styles.commentAvatarText}>
                {displayNameFromProfile(selfProfile).slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Ajoute un commentaire…"
            placeholderTextColor={Pastel.textMuted}
            style={styles.commentInput}
            multiline
            maxLength={300}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !body.trim()}
            style={[styles.sendBtn, (!body.trim() || sending) ? styles.sendBtnDisabled : null]}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileFeedSection() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [selfProfile, setSelfProfile] = useState<ProfileLite | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [myLikes, setMyLikes] = useState<Record<number, boolean>>({});
  const [mySaves, setMySaves] = useState<Record<number, boolean>>({});
  const [mediaByPost, setMediaByPost] = useState<Record<number, string[]>>({});
  const [pollByPost, setPollByPost] = useState<Record<number, PollUi>>({});

  // Comments modal
  const [commentModalPost, setCommentModalPost] = useState<PostRow | null>(null);

  const loadFeed = useCallback(async () => {
    if (!userId) { setPosts([]); return; }
    setLoading(true);
    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("user_id, handle, firstname, lastname, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      setSelfProfile((me as ProfileLite) ?? null);

      const { data, error } = await supabase
        .from("profile_posts")
        .select("id, author_id, body, created_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      const rows = (data ?? []) as PostRow[];
      setPosts(rows);

      const postIds = rows.map((row) => row.id);
      const authorIds = Array.from(new Set(rows.map((row) => row.author_id).filter(Boolean) as string[]));

      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, handle, firstname, lastname, avatar_url")
          .in("user_id", authorIds);
        const map: Record<string, ProfileLite> = {};
        (profiles ?? []).forEach((row: any) => {
          const id = String(row?.user_id ?? "");
          if (!id) return;
          map[id] = { user_id: id, handle: row?.handle ?? null, firstname: row?.firstname ?? null, lastname: row?.lastname ?? null, avatar_url: row?.avatar_url ?? null };
        });
        setProfilesById(map);
      } else {
        setProfilesById({});
      }

      if (postIds.length > 0) {
        const [{ data: likes }, { data: comments }, { data: mediaRows }, { data: pollRows }, { data: saveRows }] =
          await Promise.all([
            supabase.from("profile_post_likes").select("post_id, user_id").in("post_id", postIds),
            supabase.from("profile_post_comments").select("id, post_id").in("post_id", postIds),
            supabase.from("profile_post_media").select("id, post_id, url").in("post_id", postIds).order("created_at", { ascending: true }),
            supabase.from("profile_post_polls").select("id, post_id, question").in("post_id", postIds),
            supabase.from("profile_post_saves").select("post_id").eq("user_id", userId ?? "").in("post_id", postIds),
          ]);

        const nextLikeCounts: Record<number, number> = {};
        const nextMyLikes: Record<number, boolean> = {};
        (likes ?? []).forEach((row: any) => {
          const postId = Number(row?.post_id ?? 0);
          if (!postId) return;
          nextLikeCounts[postId] = (nextLikeCounts[postId] ?? 0) + 1;
          if (row?.user_id === userId) nextMyLikes[postId] = true;
        });
        setLikeCounts(nextLikeCounts);
        setMyLikes(nextMyLikes);

        const nextCommentCounts: Record<number, number> = {};
        (comments ?? []).forEach((row: any) => {
          const postId = Number(row?.post_id ?? 0);
          if (!postId) return;
          nextCommentCounts[postId] = (nextCommentCounts[postId] ?? 0) + 1;
        });
        setCommentCounts(nextCommentCounts);

        const nextMediaByPost: Record<number, string[]> = {};
        (mediaRows ?? []).forEach((row: any) => {
          const postId = Number(row?.post_id ?? 0);
          const url = String(row?.url ?? "");
          if (!postId || !url) return;
          if (!nextMediaByPost[postId]) nextMediaByPost[postId] = [];
          nextMediaByPost[postId].push(url);
        });
        setMediaByPost(nextMediaByPost);

        const nextMySaves: Record<number, boolean> = {};
        (saveRows ?? []).forEach((row: any) => {
          const postId = Number(row?.post_id ?? 0);
          if (postId) nextMySaves[postId] = true;
        });
        setMySaves(nextMySaves);

        const polls = (pollRows ?? []) as Array<{ id: number; post_id: number; question: string }>;
        if (polls.length > 0) {
          const pollIds = polls.map((poll) => Number(poll.id));
          const { data: optionRows } = await supabase
            .from("profile_post_poll_options")
            .select("id, poll_id, label, position")
            .in("poll_id", pollIds)
            .order("position", { ascending: true });

          const { data: voteRows } = await supabase
            .from("profile_post_poll_votes")
            .select("poll_id, option_id, user_id")
            .in("poll_id", pollIds);

          const friendSet = new Set<string>();
          if (authorIds.length > 0) {
            const [{ data: followingRows }, { data: followerRows }] = await Promise.all([
              supabase.from("user_follows").select("following_id").eq("follower_id", userId).in("following_id", authorIds),
              supabase.from("user_follows").select("follower_id").eq("following_id", userId).in("follower_id", authorIds),
            ]);
            (followingRows ?? []).forEach((row: any) => friendSet.add(String(row?.following_id ?? "")));
            (followerRows ?? []).forEach((row: any) => friendSet.add(String(row?.follower_id ?? "")));
          }

          const votesByPollOption: Record<number, Record<number, number>> = {};
          const myVoteByPoll: Record<number, number> = {};
          (voteRows ?? []).forEach((row: any) => {
            const pollId = Number(row?.poll_id ?? 0);
            const optionId = Number(row?.option_id ?? 0);
            if (!pollId || !optionId) return;
            if (!votesByPollOption[pollId]) votesByPollOption[pollId] = {};
            votesByPollOption[pollId][optionId] = (votesByPollOption[pollId][optionId] ?? 0) + 1;
            if (row?.user_id === userId) myVoteByPoll[pollId] = optionId;
          });

          const optionsByPoll: Record<number, Array<{ id: number; label: string }>> = {};
          (optionRows ?? []).forEach((row: any) => {
            const pollId = Number(row?.poll_id ?? 0);
            const optionId = Number(row?.id ?? 0);
            const label = String(row?.label ?? "");
            if (!pollId || !optionId || !label) return;
            if (!optionsByPoll[pollId]) optionsByPoll[pollId] = [];
            optionsByPoll[pollId].push({ id: optionId, label });
          });

          const nextPollByPost: Record<number, PollUi> = {};
          polls.forEach((poll) => {
            const pollId = Number(poll.id);
            const postId = Number(poll.post_id);
            const sourcePost = rows.find((item) => item.id === postId);
            const authorId = sourcePost?.author_id ?? null;
            const canVote = !!authorId && (authorId === userId || friendSet.has(authorId));
            const options = optionsByPoll[pollId] ?? [];
            const totalVotes = options.reduce((sum, opt) => sum + (votesByPollOption[pollId]?.[opt.id] ?? 0), 0);
            nextPollByPost[postId] = {
              id: pollId,
              question: String(poll.question ?? ""),
              myOptionId: myVoteByPoll[pollId] ?? null,
              totalVotes,
              canVote,
              options: options.map((opt) => {
                const votes = votesByPollOption[pollId]?.[opt.id] ?? 0;
                const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                return { id: opt.id, label: opt.label, votes, percent };
              }),
            };
          });
          setPollByPost(nextPollByPost);
        } else {
          setPollByPost({});
        }
      } else {
        setLikeCounts({});
        setMyLikes({});
        setCommentCounts({});
        setMediaByPost({});
        setMySaves({});
        setPollByPost({});
      }
    } catch {
      Alert.alert("Erreur", "Impossible de charger le fil d'actualités.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { loadFeed(); }, [loadFeed]));

  const handleToggleLike = useCallback(async (postId: number) => {
    if (!userId) return;
    const liked = !!myLikes[postId];
    // Optimistic update
    if (liked) {
      setMyLikes((prev) => ({ ...prev, [postId]: false }));
      setLikeCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 1) - 1) }));
      const { error } = await supabase.from("profile_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      if (error) {
        // rollback
        setMyLikes((prev) => ({ ...prev, [postId]: true }));
        setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
        Alert.alert("Erreur like", error.message);
      }
    } else {
      setMyLikes((prev) => ({ ...prev, [postId]: true }));
      setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
      const { error } = await supabase.from("profile_post_likes").insert({ post_id: postId, user_id: userId });
      if (error && error.code !== "23505") {
        // rollback (ignore duplicate key = already liked)
        setMyLikes((prev) => ({ ...prev, [postId]: false }));
        setLikeCounts((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 1) - 1) }));
        Alert.alert("Erreur like", error.message);
      }
    }
  }, [myLikes, userId]);

  const handleToggleSave = useCallback(async (postId: number) => {
    if (!userId) return;
    const saved = !!mySaves[postId];
    if (saved) {
      const { error } = await supabase.from("profile_post_saves").delete().eq("post_id", postId).eq("user_id", userId);
      if (error) { Alert.alert("Erreur", "Impossible de retirer la sauvegarde."); return; }
      setMySaves((prev) => ({ ...prev, [postId]: false }));
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      const { error } = await supabase.from("profile_post_saves").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id" });
      if (error) { Alert.alert("Erreur", "Impossible de sauvegarder."); return; }
      setMySaves((prev) => ({ ...prev, [postId]: true }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [mySaves, userId]);

  const handleShare = useCallback(async (post: PostRow, author: ProfileLite | null) => {
    const authorName = displayNameFromProfile(author);
    const content = post.body?.trim() ?? "";
    const message = content
      ? `${authorName} sur Jovial :\n\n"${content}"`
      : `Publication de ${authorName} sur Jovial`;
    try {
      await Share.share({ message, title: "Partager depuis Jovial" });
    } catch {
      // user cancelled or error — silent
    }
  }, []);

  const handleVotePoll = useCallback(async (postId: number, optionId: number) => {
    if (!userId) return;
    const poll = pollByPost[postId];
    if (!poll) return;
    if (!poll.canVote) {
      Alert.alert("Sondage réservé", "Seuls les amis de l'auteur peuvent voter 👀");
      return;
    }
    try {
      const { error } = await supabase.from("profile_post_poll_votes").upsert(
        { poll_id: poll.id, option_id: optionId, user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: "poll_id,user_id" }
      );
      if (error) throw error;
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await loadFeed();
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer ce vote.");
    }
  }, [loadFeed, pollByPost, userId]);

  const postsWithMeta = useMemo(
    () => posts.map((post) => ({ post, author: post.author_id ? profilesById[post.author_id] ?? null : null })),
    [posts, profilesById]
  );

  const selfName = displayNameFromProfile(selfProfile);

  return (
    <View style={styles.container}>
      {/* Composer */}
      <Pressable style={styles.composer} onPress={() => router.push("/profile/feed-compose" as any)}>
        {selfProfile?.avatar_url ? (
          <Image source={{ uri: selfProfile.avatar_url }} style={styles.composerAvatar} />
        ) : (
          <View style={styles.composerAvatarFallback}>
            <Text style={styles.composerAvatarText}>{selfName.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.composerInput}>
          <Text style={styles.composerPlaceholder}>Quoi de neuf ? 🍻</Text>
        </View>
        <View style={styles.composerIcons}>
          <View style={styles.composerIconBtn}>
            <Ionicons name="image-outline" size={18} color={Pastel.primary} />
          </View>
          <View style={styles.composerIconBtn}>
            <Ionicons name="bar-chart-outline" size={18} color={Pastel.primary} />
          </View>
        </View>
      </Pressable>

      {/* States */}
      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyMuted}>Chargement du fil… ✨</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>Pas encore de publication</Text>
          <Text style={styles.emptyDesc}>Partage ta première sortie ou un endroit sympa à tes amis 🍻</Text>
          <Pressable style={styles.emptyCta} onPress={() => router.push("/profile/feed-compose" as any)}>
            <Text style={styles.emptyCtaText}>Créer ma première publication</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Posts */}
      <View style={styles.postList}>
        {postsWithMeta.map(({ post, author }) => {
          const media = mediaByPost[post.id] ?? [];
          const poll = pollByPost[post.id] ?? null;
          const liked = !!myLikes[post.id];
          const saved = !!mySaves[post.id];
          const likeCount = likeCounts[post.id] ?? 0;
          const commentCount = commentCounts[post.id] ?? 0;
          const authorName = displayNameFromProfile(author);
          const fallback = authorName.slice(0, 2).toUpperCase();

          return (
            <View key={post.id} style={styles.postCard}>
              {/* Header */}
              <View style={styles.postHeader}>
                <View style={styles.authorRow}>
                  {author?.avatar_url ? (
                    <Image source={{ uri: author.avatar_url }} style={styles.authorAvatar} />
                  ) : (
                    <View style={styles.authorAvatarFallback}>
                      <Text style={styles.authorAvatarText}>{fallback}</Text>
                    </View>
                  )}
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorName}>{authorName}</Text>
                    <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
                  </View>
                </View>
                <Pressable hitSlop={10}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={Pastel.textMuted} />
                </Pressable>
              </View>

              {/* Body */}
              {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}

              {/* Media */}
              {media.length === 1 ? (
                <Image source={{ uri: media[0] }} style={styles.mediaSingle} resizeMode="cover" />
              ) : media.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                  {media.map((url, i) => (
                    <Image key={`${url}-${i}`} source={{ uri: url }} style={styles.mediaItem} resizeMode="cover" />
                  ))}
                </ScrollView>
              ) : null}

              {/* Poll */}
              {poll ? (
                <View style={styles.pollCard}>
                  <View style={styles.pollHeader}>
                    <Ionicons name="bar-chart-outline" size={15} color="#7C3AED" />
                    <Text style={styles.pollQuestion}>{poll.question}</Text>
                  </View>
                  <View style={styles.pollOptions}>
                    {poll.options.map((option) => (
                      <PollOptionRow
                        key={option.id}
                        option={option}
                        selected={poll.myOptionId === option.id}
                        canVote={poll.canVote}
                        totalVotes={poll.totalVotes}
                        onVote={() => handleVotePoll(post.id, option.id)}
                      />
                    ))}
                  </View>
                  <Text style={styles.pollMeta}>
                    {poll.totalVotes === 0
                      ? "Sois le premier à voter 👀"
                      : poll.totalVotes === 1
                      ? "1 personne a voté 👀"
                      : `${poll.totalVotes} personnes ont voté`}
                    {!poll.canVote ? " · Réservé aux amis" : ""}
                  </Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.postActions}>
                <LikeButton liked={liked} count={likeCount} onPress={() => handleToggleLike(post.id)} />

                <Pressable style={styles.actionBtn} onPress={() => setCommentModalPost(post)}>
                  <Ionicons name="chatbubble-outline" size={18} color={Pastel.textMuted} />
                  <Text style={styles.actionBtnText}>
                    {commentCount > 0 ? String(commentCount) : "Commenter"}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, saved ? styles.actionBtnSaved : null]}
                  onPress={() => handleToggleSave(post.id)}
                >
                  <Ionicons
                    name={saved ? "bookmark" : "bookmark-outline"}
                    size={18}
                    color={saved ? "#F97316" : Pastel.textMuted}
                  />
                  <Text style={[styles.actionBtnText, saved ? { color: "#F97316" } : null]}>
                    {saved ? "Sauvegardé" : "Sauvegarder"}
                  </Text>
                </Pressable>

                <Pressable style={styles.actionBtnIcon} onPress={() => handleShare(post, author)}>
                  <Ionicons name="share-outline" size={18} color={Pastel.textMuted} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {/* Comments modal */}
      <CommentsModal
        visible={commentModalPost !== null}
        post={commentModalPost}
        userId={userId}
        selfProfile={selfProfile}
        onClose={() => {
          setCommentModalPost(null);
          loadFeed();
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: 14 },

  /* Composer */
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  composerAvatar: { width: 40, height: 40, borderRadius: 14 },
  composerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Pastel.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  composerAvatarText: { fontSize: 13, fontWeight: "700", color: Pastel.primary },
  composerInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  composerPlaceholder: { color: Pastel.textMuted, fontSize: 14 },
  composerIcons: { flexDirection: "row", gap: 6 },
  composerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Pastel.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Empty state */
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    gap: 8,
  },
  emptyMuted: { fontSize: 13, color: Pastel.textMuted },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: Pastel.text },
  emptyDesc: { fontSize: 13, color: Pastel.textMuted, textAlign: "center", lineHeight: 19 },
  emptyCta: {
    marginTop: 4,
    backgroundColor: Pastel.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyCtaText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  /* Posts */
  postList: { gap: 12 },

  postCard: {
    backgroundColor: Pastel.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },

  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorAvatar: { width: 42, height: 42, borderRadius: 14 },
  authorAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Pastel.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: { fontWeight: "800", fontSize: 13, color: Pastel.primary },
  authorInfo: { gap: 2 },
  authorName: { fontSize: 15, fontWeight: "700", color: Pastel.text },
  postTime: { fontSize: 12, color: "#9CA3AF" },

  postBody: {
    fontSize: 15,
    color: Pastel.text,
    lineHeight: 23,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  mediaSingle: { width: "100%", height: 220, backgroundColor: Pastel.surfaceAlt },
  mediaRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 10 },
  mediaItem: { width: 200, height: 150, borderRadius: 14, backgroundColor: Pastel.surfaceAlt },

  /* Poll */
  pollCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#FAF5FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    padding: 12,
    gap: 10,
  },
  pollHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  pollQuestion: { flex: 1, fontSize: 14, fontWeight: "700", color: "#5B21B6" },
  pollOptions: { gap: 7 },
  pollOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  pollOptionSelected: { borderColor: "#7C3AED" },
  pollFill: { position: "absolute", top: 0, left: 0, bottom: 0, backgroundColor: "#EDE9FE" },
  pollFillSelected: { backgroundColor: "#DDD6FE" },
  pollContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pollOptionText: { flex: 1, color: "#374151", fontSize: 13, fontWeight: "600" },
  pollOptionTextSelected: { color: "#5B21B6", fontWeight: "700" },
  pollPercent: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  pollPercentSelected: { color: "#7C3AED" },
  pollMeta: { fontSize: 12, color: "#8B5CF6" },

  /* Actions */
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
    gap: 6,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Pastel.surfaceAlt,
  },
  actionBtnSaved: { backgroundColor: "#FFF7ED" },
  actionBtnIcon: {
    marginLeft: "auto" as any,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Pastel.surfaceAlt,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: Pastel.textMuted },

  /* Comments modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: Pastel.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Pastel.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: Pastel.text },

  commentList: { maxHeight: 400 },
  commentListContent: { padding: 16, gap: 14 },
  commentMuted: { fontSize: 13, color: Pastel.textMuted },
  commentEmpty: { alignItems: "center", gap: 8, paddingVertical: 24 },
  commentEmptyEmoji: { fontSize: 32 },
  commentEmptyTitle: { fontSize: 15, fontWeight: "700", color: Pastel.text },
  commentEmptyDesc: { fontSize: 13, color: Pastel.textMuted },

  commentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  commentAvatar: { width: 36, height: 36, borderRadius: 12 },
  commentAvatarFallback: {
    backgroundColor: Pastel.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: { fontSize: 11, fontWeight: "700", color: Pastel.primary },
  commentBubble: {
    flex: 1,
    backgroundColor: Pastel.surfaceAlt,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    padding: 10,
    gap: 4,
  },
  commentBubbleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  commentAuthor: { fontSize: 13, fontWeight: "700", color: Pastel.text },
  commentTime: { fontSize: 11, color: Pastel.textMuted },
  commentBody: { fontSize: 14, color: Pastel.text, lineHeight: 20 },

  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
  },
  commentInputAvatar: { width: 36, height: 36, borderRadius: 12 },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Pastel.surfaceAlt,
    color: Pastel.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: Pastel.border },
});
