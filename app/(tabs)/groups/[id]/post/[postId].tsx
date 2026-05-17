import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ResizeMode, Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/providers/AuthProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import {
  createPostComment,
  likePostComment,
  unlikePostComment,
  listCommentLikes,
  listGroupPostMedia,
  listGroupPosts,
  listPostComments,
  listProfilesByUserIds,
} from "@/services/groups";

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  if (diff < 31536000) return `${Math.floor(diff / 604800)} sem`;
  return `${Math.floor(diff / 31536000)} an${Math.floor(diff / 31536000) > 1 ? "s" : ""}`;
}

type PostMedia = { id: number; url: string; media_type: "image" | "video" };
type ProfileSummary = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  avatar_url: string | null;
};

const AVATAR_COLORS = ["#DBEAFE", "#FCE7F3", "#D1FAE5", "#FEF3C7", "#EDE9FE", "#FFE4E6"];
function avatarColor(userId: string) {
  const n = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

const displayNameFromProfile = (profile?: ProfileSummary | null) => {
  if (!profile) return "Membre";
  const first = profile.firstname?.trim();
  const last = profile.lastname?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return profile.handle?.trim() || "Membre";
};

export default function GroupPostDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, postId, groupName } = useLocalSearchParams<{ id?: string; postId?: string; groupName?: string }>();
  const groupId = useMemo(() => (id ? Number(id) : null), [id]);
  const selectedPostId = useMemo(() => (postId ? Number(postId) : null), [postId]);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<{
    id: number; body: string | null; created_at: string;
    author_id: string | null; author_name?: string; author_avatar?: string | null;
    gif_url?: string | null;
    media: PostMedia[];
  } | null>(null);
  const [comments, setComments] = useState<{
    id: number; body: string; created_at: string;
    author_id: string | null; author_name?: string; author_avatar?: string | null;
  }[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<ProfileSummary | null>(null);
  const [commentLikeCounts, setCommentLikeCounts] = useState<Record<number, number>>({});
  const [myCommentLikes, setMyCommentLikes] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!groupId || !selectedPostId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [posts, mediaRows, commentRows] = await Promise.all([
          listGroupPosts(groupId),
          listGroupPostMedia([selectedPostId]),
          listPostComments(selectedPostId),
        ]);
        const found = posts.find((item) => item.id === selectedPostId);
        if (!found || cancelled) return;
        const allAuthorIds = Array.from(new Set([
          ...(found.author_id ? [found.author_id] : []),
          ...(userId ? [userId] : []),
          ...commentRows.map((row) => row.author_id).filter(Boolean) as string[],
        ]));
        const profiles = allAuthorIds.length > 0 ? await listProfilesByUserIds(allAuthorIds) : [];
        const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
        const authorProfile = found.author_id ? profileMap.get(found.author_id) : undefined;
        const media = mediaRows
          .filter((row) => row.post_id === selectedPostId)
          .map((row) => ({ id: row.id, url: row.url, media_type: row.media_type }));
        const mappedComments = commentRows.map((row) => {
          const profile = row.author_id ? profileMap.get(row.author_id) : null;
          return { id: row.id, body: row.body, created_at: row.created_at, author_id: row.author_id, author_name: displayNameFromProfile(profile), author_avatar: profile?.avatar_url ?? null };
        });
        const commentIds = commentRows.map((r) => r.id);
        const likeRows = commentIds.length > 0 ? await listCommentLikes(commentIds) : [];
        const likeCounts: Record<number, number> = {};
        const myLikes: Record<number, boolean> = {};
        likeRows.forEach((r) => {
          likeCounts[r.comment_id] = (likeCounts[r.comment_id] ?? 0) + 1;
          if (r.user_id === userId) myLikes[r.comment_id] = true;
        });
        if (!cancelled) {
          setPost({ id: found.id, body: found.body, created_at: found.created_at, author_id: found.author_id ?? null, author_name: displayNameFromProfile(authorProfile), author_avatar: authorProfile?.avatar_url ?? null, gif_url: found.gif_url ?? null, media });
          setComments(mappedComments);
          setCommentLikeCounts(likeCounts);
          setMyCommentLikes(myLikes);
          if (userId) setCurrentUserProfile(profileMap.get(userId) ?? null);
        }
      } catch {
        if (!cancelled) setPost(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [groupId, selectedPostId, userId]);

  const handlePublishComment = async () => {
    if (!selectedPostId) return;
    if (!userId) {
      Alert.alert("Connexion requise", "Connecte-toi pour commenter.");
      router.push("/(auth)/login");
      return;
    }
    const draft = commentDraft.trim();
    if (!draft) { Alert.alert("Texte requis", "Écris un commentaire."); return; }
    const tempId = -Date.now();
    setCommenting(true);
    const myName = displayNameFromProfile(currentUserProfile);
    const myAvatar = currentUserProfile?.avatar_url ?? null;
    setComments((prev) => [...prev, { id: tempId, body: draft, created_at: new Date().toISOString(), author_id: userId, author_name: myName, author_avatar: myAvatar }]);
    setCommentDraft("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const created = await createPostComment(selectedPostId, userId, draft);
      if (created) {
        setComments((prev) => prev.map((c) => c.id === tempId ? { id: created.id, body: created.body, created_at: created.created_at, author_id: userId, author_name: myName, author_avatar: myAvatar } : c));
      }
    } catch (err) {
      console.error("Comment error:", err);
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentDraft(draft);
      Alert.alert("Erreur", "Impossible de commenter.");
    } finally {
      setCommenting(false);
    }
  };

  const handleToggleCommentLike = async (commentId: number) => {
    if (!userId) return;
    const liked = !!myCommentLikes[commentId];
    setMyCommentLikes((prev) => ({ ...prev, [commentId]: !liked }));
    setCommentLikeCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] ?? 0) + (liked ? -1 : 1)) }));
    try {
      if (liked) await unlikePostComment(commentId, userId);
      else await likePostComment(commentId, userId);
    } catch {
      setMyCommentLikes((prev) => ({ ...prev, [commentId]: liked }));
      setCommentLikeCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] ?? 0) + (liked ? 1 : -1)) }));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Pastel.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Publication introuvable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={Pastel.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{groupName ?? "Publication"}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Post */}
          <View style={styles.postCard}>
            <Pressable
              style={styles.authorRow}
              onPress={() => post.author_id && router.push(`/profile/${post.author_id}`)}
            >
              {post.author_avatar ? (
                <Image source={post.author_avatar} style={styles.authorAvatar} />
              ) : (
                <View style={[styles.authorFallback, { backgroundColor: post.author_id ? avatarColor(post.author_id) : "#F3F4F6" }]}>
                  <Text style={styles.authorFallbackText}>{(post.author_name ?? "M")[0]}</Text>
                </View>
              )}
              <View>
                <Text style={styles.authorName}>{post.author_name ?? "Membre"}</Text>
                <Text style={styles.postMeta}>{new Date(post.created_at).toLocaleDateString("fr-FR")}</Text>
              </View>
            </Pressable>
            {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
            {post.gif_url ? (
              <Image source={{ uri: post.gif_url }} style={styles.postGif} contentFit="cover" />
            ) : null}
            {post.media.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                {post.media.map((media) => (
                  <View key={media.id} style={styles.mediaCard}>
                    {media.media_type === "image" ? (
                      <Image source={{ uri: media.url }} style={styles.mediaImage} contentFit="cover" />
                    ) : (
                      <Video source={{ uri: media.url }} style={styles.mediaVideo} useNativeControls resizeMode={ResizeMode.COVER} />
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Commentaires */}
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>Commentaires</Text>
            {comments.length === 0 ? (
              <Text style={styles.emptyText}>Aucun commentaire.</Text>
            ) : (
              <View style={styles.commentList}>
                {comments.map((comment) => {
                  const liked = !!myCommentLikes[comment.id];
                  const likeCount = commentLikeCounts[comment.id] ?? 0;
                  return (
                    <View key={comment.id} style={styles.commentCard}>
                      <Pressable
                        style={styles.commentHeader}
                        onPress={() => comment.author_id && router.push(`/profile/${comment.author_id}`)}
                      >
                        {comment.author_avatar ? (
                          <Image source={comment.author_avatar} style={styles.commentAvatar} />
                        ) : (
                          <View style={[styles.commentAvatarFallback, { backgroundColor: comment.author_id ? avatarColor(comment.author_id) : "#F3F4F6" }]}>
                            <Text style={styles.commentAvatarText}>{(comment.author_name ?? "M")[0]}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commentAuthor}>{comment.author_name ?? "Membre"}</Text>
                          <Text style={styles.commentMeta}>{timeAgo(comment.created_at)}</Text>
                        </View>
                        <Pressable style={styles.commentLikeBtn} onPress={() => handleToggleCommentLike(comment.id)} hitSlop={8}>
                          <Ionicons name={liked ? "heart" : "heart-outline"} size={15} color={liked ? "#EF4444" : "#9CA3AF"} />
                          {likeCount > 0 ? <Text style={[styles.commentLikeCount, liked ? styles.commentLikeCountActive : null]}>{likeCount}</Text> : null}
                        </Pressable>
                      </Pressable>
                      <Text style={styles.commentBody}>{comment.body}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Composer */}
        <View style={[styles.composer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
          <TextInput
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder="Écrire un commentaire..."
            placeholderTextColor={Pastel.textMuted}
            style={styles.composerInput}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, commenting || !commentDraft.trim() ? styles.sendBtnDisabled : null]}
            onPress={handlePublishComment}
            disabled={commenting || !commentDraft.trim()}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
            <Text style={styles.sendBtnText}>{commenting ? "Envoi..." : "Envoyer"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.surface },
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: Font.bold, color: Pastel.text, textAlign: "center", includeFontPadding: false },
  body: { flex: 1 },
  content: { paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: Pastel.textMuted, fontSize: 13, includeFontPadding: false },

  postCard: { backgroundColor: Pastel.surface, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 12 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorAvatar: { width: 44, height: 44, borderRadius: 22 },
  authorFallback: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Pastel.surfaceAlt },
  authorFallbackText: { fontSize: 15, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  authorName: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  postMeta: { fontSize: 11, color: Pastel.textMuted, marginTop: 2, includeFontPadding: false },
  postBody: { fontSize: 15, color: Pastel.text, lineHeight: 23, includeFontPadding: false },
  postGif: { width: "100%", height: 220, borderRadius: 14 },
  mediaRow: { gap: 10, paddingVertical: 4 },
  mediaCard: { width: 200, height: 130, borderRadius: 14, overflow: "hidden", backgroundColor: Pastel.surfaceAlt },
  mediaImage: { width: "100%", height: "100%" },
  mediaVideo: { width: "100%", height: "100%" },

  divider: { height: 1, backgroundColor: Pastel.border, marginHorizontal: 16 },

  commentsSection: { paddingHorizontal: 16, paddingTop: 20, gap: 0 },
  sectionTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, marginBottom: 16, includeFontPadding: false },
  commentList: { gap: 0 },
  commentCard: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Pastel.border },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentAvatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: Pastel.surfaceAlt },
  commentAvatarText: { fontSize: 13, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  commentAuthor: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  commentBody: { fontSize: 14, color: Pastel.text, lineHeight: 20, paddingLeft: 46, marginTop: 6, includeFontPadding: false },
  commentMeta: { fontSize: 11, color: Pastel.textMuted, marginTop: 1, includeFontPadding: false },
  commentLikeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  commentLikeCount: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  commentLikeCountActive: { color: "#EF4444" },

  composer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  composerInput: {
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: Pastel.text,
    backgroundColor: Pastel.background,
    minHeight: 48,
    fontSize: 14,
    includeFontPadding: false,
  },
  sendBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: Pastel.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: "#FFFFFF", fontFamily: Font.bold, fontSize: 14, includeFontPadding: false },
});
