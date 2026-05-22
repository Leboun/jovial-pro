import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/services/supabase";
import { getGroupCache, setGroupCache } from "@/services/groupCache";
import {
  createGroupPost,
  deleteGroupPost,
  getGroupById,
  getGroupMembership,
  likeGroupPost,
  listGroupPostMedia,
  listGroupPosts,
  listGroupEventCategories,
  listGroupTopicTags,
  listGroupMembers,
  listPostCommentCounts,
  listPostLikes,
  listProfilesByUserIds,
  requestJoinGroup,
  setGroupPostPinned,
  unlikeGroupPost,
  updateGroupMemberStatus,
  updateGroup,
  uploadGroupImage,
  uploadGroupMedia,
} from "@/services/groups";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";

const likeIcon = require("../../../assets/images/like.png");
const commentIcon = require("../../../assets/images/comment.png");

type GroupPollOptionUi = {
  id: number;
  label: string;
  votes: number;
  percent: number;
};

type GroupPollUi = {
  id: number;
  question: string;
  options: GroupPollOptionUi[];
  totalVotes: number;
  myOptionId: number | null;
};

type GroupPostUi = {
  id: number;
  body: string | null;
  created_at: string;
  author_id: string | null;
  author_name?: string;
  author_avatar?: string | null;
  author_role?: string | null;
  is_important?: boolean;
  is_pinned?: boolean;
  location_label?: string | null;
  gif_url?: string | null;
  media: { id: number; url: string; media_type: "image" | "video" }[];
};

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id, charterAccepted, joinAfter } = useLocalSearchParams<{
    id?: string;
    charterAccepted?: string;
    joinAfter?: string;
  }>();
  const groupId = useMemo(() => (id ? Number(id) : null), [id]);
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [focusKey, setFocusKey] = useState(0);
  const [group, setGroup] = useState<{
    name: string;
    description?: string | null;
    visibility?: "public" | "private";
    post_permission?: "members" | "admins";
    cover_image_url?: string | null;
    avatar_image_url?: string | null;
  } | null>(null);
  const [posts, setPosts] = useState<GroupPostUi[]>([]);
  const [membership, setMembership] = useState<{ status: string; role: string } | null>(null);
  const isJoinable = membership?.status !== "approved" && membership?.status !== "pending";
  const [pendingMembers, setPendingMembers] = useState<{ user_id: string }[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<
    Record<string, { name: string; avatar_url: string | null }>
  >({});
  const [handlingMember, setHandlingMember] = useState<Record<string, boolean>>({});
  const [postBody, setPostBody] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<
    { uri: string; type: "image" | "video"; mimeType?: string }[]
  >([]);
  const [postImportant, setPostImportant] = useState(false);
  const [mentionOptions, setMentionOptions] = useState<
    { user_id: string; label: string; handle: string | null }[]
  >([]);
  const [members, setMembers] = useState<
    { user_id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [memberCount, setMemberCount] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [joining, setJoining] = useState(false);
  const [updatingImage, setUpdatingImage] = useState<"cover" | "avatar" | null>(null);
  const [didAutoJoin, setDidAutoJoin] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [myLikes, setMyLikes] = useState<Record<number, boolean>>({});
  const [pollsByPost, setPollsByPost] = useState<Record<number, GroupPollUi>>({});
  const [tagGames, setTagGames] = useState<string[]>([]);
  const [tagCategories, setTagCategories] = useState<string[]>([]);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [actionPost, setActionPost] = useState<
    | {
        id: number;
        body: string | null;
        author_id: string | null;
        is_pinned?: boolean;
      }
    | null
  >(null);
  const groupRef = useRef<typeof group>(null);
  const postsCountRef = useRef(0);
  const postIdsRef = useRef<number[]>([]);
  const postFingerprintRef = useRef<string | null>(null);
  const groupUpdatedAtRef = useRef<string | null>(null);
  const canPinPost =
    membership?.status === "approved" &&
    (membership.role === "admin" || membership.role === "founder");

  const orderPosts = <T extends { id: number; created_at: string; is_pinned?: boolean }>(
    items: T[]
  ) =>
    [...items].sort((a, b) => {
      const pinDelta = Number(!!b.is_pinned) - Number(!!a.is_pinned);
      if (pinDelta !== 0) return pinDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const renderWithMentions = (value: string) => {
    const parts = value.split(/(@[a-zA-Z0-9_.-]{2,30})/g);
    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <Text key={`m-${index}`} style={styles.mention}>
            {part}
          </Text>
        );
      }
      return <Text key={`t-${index}`}>{part}</Text>;
    });
  };
  const memberLabel = memberCount === 1 ? "membre" : "membres";
  const canEditPost = !!(actionPost && userId && actionPost.author_id === userId);
  const SectionDivider = () => (
    <View style={styles.sectionDivider}>
      <View style={styles.sectionDividerLine} />
    </View>
  );
  useEffect(() => {
    groupRef.current = group;
  }, [group]);

  useEffect(() => {
    postsCountRef.current = posts.length;
  }, [posts.length]);

  useEffect(() => {
    postIdsRef.current = posts.map((post) => post.id);
  }, [posts]);
  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;
      setFocusKey((k) => k + 1);
      let cancelled = false;
      const cached = getGroupCache(groupId);
      if (cached) {
        setGroup((prev) => ({
          name: cached.name ?? prev?.name ?? (groupId ? `Groupe ${groupId}` : "Groupe"),
          description: cached.description ?? prev?.description ?? null,
          visibility: cached.visibility ?? prev?.visibility,
          post_permission: cached.post_permission ?? prev?.post_permission,
          cover_image_url: cached.cover_image_url ?? prev?.cover_image_url,
          avatar_image_url: cached.avatar_image_url ?? prev?.avatar_image_url,
        }));
      }
      const hasInitial = !!groupRef.current || postsCountRef.current > 0;
      const load = async () => {
        if (!hasInitial) setLoading(true);
        try {
          const [groupData, postData, topicTags, eventTags] = await Promise.all([
            getGroupById(groupId),
            listGroupPosts(groupId),
            listGroupTopicTags([groupId]),
            listGroupEventCategories([groupId]),
          ]);
          if (!cancelled) {
            if (groupData) {
              const groupChanged =
                !groupRef.current ||
                !groupUpdatedAtRef.current ||
                groupUpdatedAtRef.current !== groupData.updated_at;
              if (groupChanged) {
                setGroup({
                  name: groupData.name,
                  description: groupData.description,
                  visibility: groupData.visibility,
                  post_permission: groupData.post_permission,
                  cover_image_url: groupData.cover_image_url,
                  avatar_image_url: groupData.avatar_image_url,
                });
              }
              groupUpdatedAtRef.current = groupData.updated_at ?? null;
              setGroupCache({
                id: groupId,
                name: groupData.name,
                description: groupData.description,
                visibility: groupData.visibility,
                post_permission: groupData.post_permission,
                cover_image_url: groupData.cover_image_url,
                avatar_image_url: groupData.avatar_image_url,
                serverUpdatedAt: groupData.updated_at ?? null,
              });
            }
            const games = topicTags
              .filter((row) => row.group_id === groupId)
              .sort((a, b) => a.rank - b.rank)
              .map((row) => String(row?.community_group_topics?.label ?? "").trim())
              .filter(Boolean);
            const categories = eventTags
              .filter((row) => row.group_id === groupId)
              .sort((a, b) => a.rank - b.rank)
              .map((row) => String(row?.event_categories?.name ?? "").trim())
              .filter(Boolean);
            setTagGames(games);
            setTagCategories(categories);
            const basePosts: GroupPostUi[] = postData.map((post) => ({
              id: post.id,
              body: post.body,
              created_at: post.created_at,
              author_id: post.author_id ?? null,
              is_important: post.is_important ?? false,
              is_pinned: post.is_pinned ?? false,
              location_label: post.location_label ?? null,
              gif_url: post.gif_url ?? null,
              media: [],
            }));
            const orderedBasePosts = orderPosts(basePosts);
            const basePostIds = orderedBasePosts.map((post) => post.id);
            const nextFingerprint = orderedBasePosts
              .map((post) => `${post.id}:${post.created_at}`)
              .join("|");
            const shouldUpdatePosts =
              !hasInitial ||
              postFingerprintRef.current !== nextFingerprint ||
              basePostIds.length !== postIdsRef.current.length ||
              basePostIds.some((id, index) => id !== postIdsRef.current[index]);
            if (shouldUpdatePosts) {
              setPosts(orderedBasePosts);
              postFingerprintRef.current = nextFingerprint;
              if (basePostIds.length > 0) {
                const mediaRows = await listGroupPostMedia(basePostIds);
                if (!cancelled) {
                  const mediaMap: Record<
                    number,
                    { id: number; url: string; media_type: "image" | "video" }[]
                  > = {};
                  mediaRows.forEach((row) => {
                    if (!mediaMap[row.post_id]) mediaMap[row.post_id] = [];
                    mediaMap[row.post_id].push({
                      id: row.id,
                      url: row.url,
                      media_type: row.media_type,
                    });
                  });
                  setPosts((prev) =>
                    prev.map((post) => ({
                      ...post,
                      media: mediaMap[post.id] ?? [],
                    }))
                  );
                }
              }
            }

            const authorIds = Array.from(new Set(basePosts.map((post) => post.author_id))).filter(
              (value): value is string => Boolean(value)
            );
            if (authorIds.length > 0) {
              try {
                const [profiles, approvedMembers] = await Promise.all([
                  listProfilesByUserIds(authorIds),
                  listGroupMembers(groupId, "approved"),
                ]);
                if (!cancelled) {
                  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
                  const roleMap = new Map(approvedMembers.map((m) => [m.user_id, m.role]));
                  setPosts((prev) =>
                    prev.map((post) => {
                      const profile = post.author_id ? profileMap.get(post.author_id) : null;
                      const role = post.author_id ? roleMap.get(post.author_id) : null;
                      const name = profile
                        ? (profile.firstname || profile.lastname || profile.handle || "Membre")
                        : "Membre";
                      return {
                        ...post,
                        author_name: name,
                        author_avatar: profile?.avatar_url ?? null,
                        author_role: role ?? null,
                      };
                    })
                  );
                }
              } catch {
                // ignore profile enrichment failures
              }
            }
          }
        } catch (err) {
          if (!cancelled) {
            console.error("failed to load group", err);
            Alert.alert("Erreur", "Impossible de charger le groupe.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [groupId])
  );

  useEffect(() => {
    if (!groupId || !userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const member = await getGroupMembership(groupId, userId);
        if (!cancelled) {
          setMembership(member ? { status: member.status, role: member.role } : null);
        }
        if (!cancelled && member?.status === "approved" && ["admin", "founder"].includes(member.role)) {
          const pending = await listGroupMembers(groupId, "pending");
          const pendingIds = pending.map((row) => row.user_id);
          let profiles: { user_id: string; firstname: string | null; lastname: string | null; handle: string | null; avatar_url: string | null }[] = [];
          try {
            profiles = pendingIds.length > 0 ? await listProfilesByUserIds(pendingIds) : [];
          } catch {
            profiles = [];
          }
          if (!cancelled) {
            setPendingMembers(pending.map((row) => ({ user_id: row.user_id })));
            const map: Record<string, { name: string; avatar_url: string | null }> = {};
            profiles.forEach((profile) => {
              const name =
                profile.firstname?.trim() ||
                profile.lastname?.trim() ||
                profile.handle?.trim() ||
                "Utilisateur";
              map[profile.user_id] = {
                name,
                avatar_url: profile.avatar_url ?? null,
              };
            });
            setPendingProfiles(map);
          }
        }
      } catch {
        if (!cancelled) setMembership(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, userId]);

  useEffect(() => {
    if (!groupId || !userId || didAutoJoin) return;
    if (membership?.status === "approved" || membership?.status === "pending") return;
    if (charterAccepted === "1" && joinAfter === "1") {
      setDidAutoJoin(true);
      handleJoin();
    }
  }, [groupId, userId, charterAccepted, joinAfter, membership, didAutoJoin]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    const loadMentions = async () => {
      try {
        const approvedMembers = await listGroupMembers(groupId, "approved");
        const ids = approvedMembers.map((row) => row.user_id);
        const profiles = ids.length > 0 ? await listProfilesByUserIds(ids) : [];
        if (cancelled) return;
        setMemberCount(approvedMembers.length);
        const options = profiles.map((p) => ({
          user_id: p.user_id,
          label:
            p.firstname?.trim() ||
            p.lastname?.trim() ||
            p.handle?.trim() ||
            "Membre",
          handle: p.handle,
        }));
        setMentionOptions(options);
        const list = profiles.map((p) => ({
          user_id: p.user_id,
          name:
            p.firstname?.trim() ||
            p.lastname?.trim() ||
            p.handle?.trim() ||
            "Membre",
          avatar_url: p.avatar_url ?? null,
        }));
        setMembers(list);
      } catch {
        if (!cancelled) setMentionOptions([]);
      }
    };
    loadMentions();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    if (posts.length === 0) {
      setLikeCounts({});
      setCommentCounts({});
      setMyLikes({});
      setPollsByPost({});
      return;
    }
    void focusKey;
    const postIds = posts.map((post) => post.id);
    let cancelled = false;
    const load = async () => {
      try {
        const [likes, comments, pollRows] = await Promise.all([
          listPostLikes(postIds),
          listPostCommentCounts(postIds),
          supabase
            .from("community_group_post_polls")
            .select("id, post_id, question")
            .in("post_id", postIds),
        ]);
        if (cancelled) return;
        const likeCountMap: Record<number, number> = {};
        const commentCountMap: Record<number, number> = {};
        const myLikeMap: Record<number, boolean> = {};

        likes.forEach((row: { post_id: number; user_id: string | null }) => {
          likeCountMap[row.post_id] = (likeCountMap[row.post_id] ?? 0) + 1;
          if (userId && row.user_id === userId) myLikeMap[row.post_id] = true;
        });
        comments.forEach((row: { post_id: number }) => {
          commentCountMap[row.post_id] = (commentCountMap[row.post_id] ?? 0) + 1;
        });

        setLikeCounts(likeCountMap);
        setCommentCounts(commentCountMap);
        setMyLikes(myLikeMap);

        const polls = (pollRows.data ?? []) as Array<{
          id: number;
          post_id: number;
          question: string;
        }>;
        if (polls.length > 0) {
          const pollIds = polls.map((poll) => Number(poll.id));
          const { data: optionRows } = await supabase
            .from("community_group_post_poll_options")
            .select("id, poll_id, label, position")
            .in("poll_id", pollIds)
            .order("position", { ascending: true });
          const { data: voteRows } = await supabase
            .from("community_group_post_poll_votes")
            .select("poll_id, option_id, user_id")
            .in("poll_id", pollIds);
          if (cancelled) return;

          const optionsByPoll: Record<number, Array<{ id: number; label: string }>> = {};
          (optionRows ?? []).forEach((row: any) => {
            const pollId = Number(row?.poll_id ?? 0);
            const optionId = Number(row?.id ?? 0);
            const label = String(row?.label ?? "");
            if (!pollId || !optionId || !label) return;
            if (!optionsByPoll[pollId]) optionsByPoll[pollId] = [];
            optionsByPoll[pollId].push({ id: optionId, label });
          });

          const voteCountByPollOption: Record<number, Record<number, number>> = {};
          const myVoteByPoll: Record<number, number> = {};
          (voteRows ?? []).forEach((row: any) => {
            const pollId = Number(row?.poll_id ?? 0);
            const optionId = Number(row?.option_id ?? 0);
            if (!pollId || !optionId) return;
            if (!voteCountByPollOption[pollId]) voteCountByPollOption[pollId] = {};
            voteCountByPollOption[pollId][optionId] =
              (voteCountByPollOption[pollId][optionId] ?? 0) + 1;
            if (userId && row?.user_id === userId) myVoteByPoll[pollId] = optionId;
          });

          const nextPollsByPost: Record<number, GroupPollUi> = {};
          polls.forEach((poll) => {
            const options = optionsByPoll[poll.id] ?? [];
            const totalVotes = options.reduce(
              (sum, option) => sum + (voteCountByPollOption[poll.id]?.[option.id] ?? 0),
              0
            );
            nextPollsByPost[poll.post_id] = {
              id: poll.id,
              question: poll.question,
              myOptionId: myVoteByPoll[poll.id] ?? null,
              totalVotes,
              options: options.map((option) => {
                const votes = voteCountByPollOption[poll.id]?.[option.id] ?? 0;
                const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                return { id: option.id, label: option.label, votes, percent };
              }),
            };
          });
          setPollsByPost(nextPollsByPost);
        } else {
          setPollsByPost({});
        }
      } catch {
        // ignore stats load errors
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [posts, userId, focusKey]);

  const handleJoin = async () => {
    if (!groupId) return;
    if (charterAccepted !== "1") {
      router.push({
        pathname: "/groups/charter",
        params: { returnTo: `/groups/${groupId}`, joinAfter: "1" },
      });
      return;
    }
    if (!userId) {
      Alert.alert("Connexion requise", "Connecte-toi pour rejoindre un groupe.");
      router.push("/(auth)/login");
      return;
    }
    setJoining(true);
    try {
      await requestJoinGroup(groupId, userId);
      Alert.alert("Demande envoyée", "Un admin validera ta demande.");
    } catch (err) {
      Alert.alert("Erreur", "Impossible d'envoyer la demande.");
    } finally {
      setJoining(false);
    }
  };

  const isAdmin =
    membership?.status === "approved" &&
    membership?.role &&
    ["admin", "founder"].includes(membership.role);
  const canPost =
    membership?.status === "approved" && (group?.post_permission !== "admins" || isAdmin);
  const currentMemberAvatar = useMemo(() => {
    if (!userId) return null;
    return members.find((member) => member.user_id === userId)?.avatar_url ?? null;
  }, [members, userId]);
  const primaryActivity = tagGames[0] ?? null;

  const handlePickGroupImage = async (kind: "cover" | "avatar") => {
    if (!groupId || !isAdmin) return;
    try {
      const picker = await import("expo-image-picker");
      const libraryPerm = await picker.requestMediaLibraryPermissionsAsync();
      if (!libraryPerm.granted) {
        Alert.alert("Autorisation requise", "Autorise l'accès à tes photos.");
        return;
      }
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: picker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setUpdatingImage(kind);
      const asset = result.assets[0];
      let mimeType = asset.mimeType ?? "image/jpeg";
      let uri = asset.uri;
      if (uri.startsWith("ph://") && asset.assetId) {
        try {
          const media = await import("expo-media-library");
          const info = await media.getAssetInfoAsync(asset.assetId);
          if (info.localUri) uri = info.localUri;
        } catch {
          // ignore media library resolution errors
        }
      }
      const manipulator = await import("expo-image-manipulator");
      const processed = await manipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.9, format: manipulator.SaveFormat.JPEG, base64: true }
      );
      const base64 = processed.base64 ?? null;
      mimeType = "image/jpeg";
      if (!base64 || base64.length < 1000) {
        throw new Error("Impossible de lire l'image sélectionnée.");
      }
      const publicUrl = await uploadGroupImage({
        groupId,
        uri: processed.uri,
        kind,
        mimeType,
      });
      const patch =
        kind === "cover" ? { cover_image_url: publicUrl } : { avatar_image_url: publicUrl };
      const updated = await updateGroup(groupId, patch);
      if (updated) {
        setGroup((prev) => (prev ? { ...prev, ...patch } : prev));
      }
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Impossible de mettre à jour l'image.";
      Alert.alert("Erreur", message);
    } finally {
      setUpdatingImage(null);
    }
  };

    const handleEditDescription = async () => {
      if (!groupId || !isAdmin) return;
      if (Platform.OS === "ios") {
        Alert.prompt(
          "Description",
          "Modifier la description du club",
          async (value) => {
            if (!value?.trim()) return;
            try {
              const updated = await updateGroup(groupId, { description: value.trim() });
              if (updated) {
                setGroup((prev) => (prev ? { ...prev, description: updated.description } : prev));
              }
            } catch {
              Alert.alert("Erreur", "Impossible de mettre à jour la description.");
            }
          }
        );
        return;
      }
      Alert.alert("Modifier la description", "Cette action sera disponible bientôt.");
    };

    const handleInvite = () => {
    Alert.alert(
      "Inviter",
      "L'invitation dans l'app arrive bientôt. Pour l'instant, partage le groupe."
    );
  };

  const handleShare = async () => {
    if (!group) return;
    try {
      // Fetch or create an invite link token for this group
      let token: string | null = null;
      const { data: existing } = await supabase
        .from("community_group_invite_links")
        .select("token")
        .eq("group_id", groupId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.token) {
        token = existing.token;
      } else {
        const newToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const { data: created } = await supabase
          .from("community_group_invite_links")
          .insert({ group_id: groupId, token: newToken, created_by: userId })
          .select("token")
          .maybeSingle();
        token = created?.token ?? null;
      }

      const link = token ? `https://getjovial.fr/join/${token}` : null;
      await Share.share({
        message: link
          ? `Rejoins le club "${group.name}" sur Jovial !\n${link}`
          : `Rejoins le club "${group.name}" sur Jovial.`,
        url: link ?? undefined,
      });
    } catch {
      // ignore share errors
    }
  };

  const EVENT_RADIUS_KM = 150;
  const handleViewEvents = () => {
    Alert.alert("Événements", `Les événements à moins de ${EVENT_RADIUS_KM} km arrivent bientôt.`);
  };

  const handleMemberDecision = async (targetUserId: string, nextStatus: "approved" | "rejected") => {
    if (!groupId || !userId) return;
    setHandlingMember((prev) => ({ ...prev, [targetUserId]: true }));
    try {
      await updateGroupMemberStatus({
        groupId,
        userId: targetUserId,
        status: nextStatus,
        approvedBy: userId,
      });
      setPendingMembers((prev) => prev.filter((member) => member.user_id !== targetUserId));
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour la demande.");
    } finally {
      setHandlingMember((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleToggleLike = async (postId: number) => {
    if (!userId) {
      Alert.alert("Connexion requise", "Connecte-toi pour liker.");
      router.push("/(auth)/login");
      return;
    }
    const alreadyLiked = myLikes[postId];
    const nextLiked = !alreadyLiked;
    setMyLikes((prev) => ({ ...prev, [postId]: nextLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 0) + (nextLiked ? 1 : -1)),
    }));
    try {
      if (alreadyLiked) {
        await unlikeGroupPost(postId, userId);
      } else {
        await likeGroupPost(postId, userId);
      }
    } catch {
      setMyLikes((prev) => ({ ...prev, [postId]: alreadyLiked }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) + (alreadyLiked ? 1 : -1)),
      }));
      Alert.alert("Erreur", "Impossible de mettre à jour le like.");
    }
  };

  const handleOpenPostActions = (post: {
    id: number;
    body: string | null;
    author_id: string | null;
    is_pinned?: boolean;
  }) => {
    setActionPost(post);
  };

  const handleVotePoll = async (postId: number, optionId: number) => {
    if (!userId) {
      Alert.alert("Connexion requise", "Connecte-toi pour voter.");
      router.push("/(auth)/login");
      return;
    }
    const poll = pollsByPost[postId];
    if (!poll) return;
    try {
      const { error } = await supabase.from("community_group_post_poll_votes").upsert(
        {
          poll_id: poll.id,
          option_id: optionId,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "poll_id,user_id" }
      );
      if (error) throw error;
      const next = { ...pollsByPost };
      const prevOptionId = poll.myOptionId;
      const updatedOptions = poll.options.map((option) => {
        let votes = option.votes;
        if (prevOptionId && option.id === prevOptionId) votes = Math.max(0, votes - 1);
        if (option.id === optionId) votes += 1;
        return { ...option, votes };
      });
      const totalVotes = updatedOptions.reduce((sum, option) => sum + option.votes, 0);
      next[postId] = {
        ...poll,
        myOptionId: optionId,
        totalVotes,
        options: updatedOptions.map((option) => ({
          ...option,
          percent: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0,
        })),
      };
      setPollsByPost(next);
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer ton vote.");
    }
  };

  const handleEditPost = () => {
    if (!actionPost || !groupId) return;
    const nameParam = encodeURIComponent(group?.name ?? "Publication");
    const bodyParam = encodeURIComponent(actionPost.body ?? "");
    router.push(
      `/groups/${groupId}/compose?postId=${actionPost.id}&groupName=${nameParam}&body=${bodyParam}`
    );
    setActionPost(null);
  };

  const handleDeletePost = () => {
    if (!actionPost) return;
    Alert.alert("Supprimer la publication", "Tu es sûr de vouloir supprimer cette publication ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteGroupPost(actionPost.id);
            setPosts((prev) => prev.filter((post) => post.id !== actionPost.id));
            setLikeCounts((prev) => {
              const next = { ...prev };
              delete next[actionPost.id];
              return next;
            });
            setCommentCounts((prev) => {
              const next = { ...prev };
              delete next[actionPost.id];
              return next;
            });
            setMyLikes((prev) => {
              const next = { ...prev };
              delete next[actionPost.id];
              return next;
            });
            setPollsByPost((prev) => {
              const next = { ...prev };
              delete next[actionPost.id];
              return next;
            });
          } catch (error) {
            Alert.alert("Erreur", "Impossible de supprimer la publication.");
          } finally {
            setActionPost(null);
          }
        },
      },
    ]);
  };

  const handleTogglePin = async () => {
    if (!actionPost || !groupId) return;
    const nextPinned = !actionPost.is_pinned;
    try {
      const updated = await setGroupPostPinned({
        groupId,
        postId: actionPost.id,
        isPinned: nextPinned,
      });
      if (updated) {
        setPosts((prev) =>
          orderPosts(
            prev.map((post) =>
              post.id === actionPost.id
                ? { ...post, is_pinned: updated.is_pinned }
                : updated.is_pinned
                ? { ...post, is_pinned: false }
                : post
            )
          )
        );
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'épingler la publication.");
    } finally {
      setActionPost(null);
    }
  };

  const handleReportComment = () => {
    if (!actionPost || !groupId) return;
    setActionPost(null);
    Alert.alert(
      "Signaler un commentaire",
      "Sélectionne le commentaire à signaler sur la publication.",
      [
        {
          text: "OK",
          onPress: () => router.push(`/groups/${groupId}/post/${actionPost.id}?report=1` as any),
        },
      ]
    );
  };

  const handleOpenPost = (postId: number) => {
    if (!groupId) return;
    router.push({
      pathname: `/groups/${groupId}/post/${postId}` as any,
      params: { groupName: group?.name ?? "" },
    });
  };

  const handlePublish = async () => {
    if (!groupId) return;
    if (!userId) {
      Alert.alert("Connexion requise", "Connecte-toi pour publier.");
      router.push("/(auth)/login");
      return;
    }
    if (!canPost) {
      Alert.alert(
        "Publication réservée",
        "Les publications sont réservées aux admins de ce club."
      );
      return;
    }
    if (!postBody.trim() && selectedMedia.length === 0) {
      Alert.alert("Texte ou média requis", "Ajoute un message ou un média.");
      return;
    }
    const draftBody = postBody;
    const draftMedia = selectedMedia;
    const draftImportant = postImportant;
    const tempId = -Date.now();
    const optimisticMedia: GroupPostUi["media"] = draftMedia.map((item, index) => ({
      id: tempId - index - 1,
      url: item.uri,
      media_type: item.type === "video" ? "video" : "image",
    }));
    setPosts((prev) =>
      orderPosts([
        ...prev,
        {
          id: tempId,
          body: draftBody,
          created_at: new Date().toISOString(),
          author_id: userId,
          author_name: "Moi",
          author_avatar: null,
          author_role: membership?.role ?? null,
          is_important: draftImportant,
          is_pinned: false,
          media: optimisticMedia,
        },
      ])
    );
    setPostBody("");
    setSelectedMedia([]);
    setPostImportant(false);
    setPublishing(true);
    try {
      const created = await createGroupPost(groupId, userId, draftBody, {
        isImportant: draftImportant,
      });
      if (!created) throw new Error("create_failed");
      let mediaRows: { id: number; url: string; media_type: "image" | "video" }[] = [];
      if (draftMedia.length > 0) {
        const uploads = await Promise.all(
          draftMedia.map((item) =>
            uploadGroupMedia({
              groupId,
              postId: created.id,
              uri: item.uri,
              mediaType: item.type,
              mimeType: item.mimeType,
            })
          )
        );
        mediaRows = uploads
          .filter(Boolean)
          .map((row) => ({
            id: row!.id,
            url: row!.url,
            media_type: row!.media_type,
          }));
      }
      setPosts((prev) =>
        orderPosts(
          prev.map((post) =>
            post.id === tempId
              ? {
                  ...post,
                  id: created.id,
                  body: created.body,
                  created_at: created.created_at,
                  is_important: created.is_important ?? false,
                  is_pinned: created.is_pinned ?? false,
                  media: mediaRows.length > 0 ? mediaRows : post.media,
                }
              : post
          )
        )
      );
    } catch (err) {
      setPosts((prev) => prev.filter((post) => post.id !== tempId));
      setPostBody(draftBody);
      setSelectedMedia(draftMedia);
      setPostImportant(draftImportant);
      Alert.alert("Erreur", "Impossible de publier. Es-tu bien approuvé ?");
    } finally {
      setPublishing(false);
    }
  };

  const handlePickMedia = async () => {
    try {
      const picker = await import("expo-image-picker");
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: picker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: true,
      });
      if (!result.canceled && result.assets?.length) {
        const mapped: { uri: string; type: "image" | "video"; mimeType?: string }[] =
          result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.type === "video" ? "video" : "image",
          mimeType: asset.mimeType ?? undefined,
        }));
        const hasVideo = mapped.some((item) => item.type === "video");
        if (hasVideo) {
          setSelectedMedia([mapped.find((item) => item.type === "video")!]);
        } else {
          setSelectedMedia(mapped.slice(0, 3));
        }
      }
    } catch (err) {
      Alert.alert("Info", "Image picker non configure. Installez expo-image-picker.");
    }
  };

  const handleOpenComposer = (openMedia = false) => {
    if (!groupId) return;
    router.push({
      pathname: `/groups/${groupId}/compose` as any,
      params: {
        groupName: group?.name ?? "Groupe",
        openMedia: openMedia ? "1" : "0",
      },
    });
  };

  const handleOpenGallery = () => {
    if (!groupId) return;
    router.push(`/groups/${groupId}/gallery` as any);
  };

  const updateMentionQuery = (value: string) => {
    const match = value.match(/@([a-zA-Z0-9_.-]{0,30})$/);
    if (!match) {
      setMentionQuery("");
      return;
    }
    setMentionQuery(match[1] ?? "");
  };

  const handlePostBodyChange = (value: string) => {
    setPostBody(value);
    updateMentionQuery(value);
  };

  const handlePickMention = (handle: string | null) => {
    if (!handle) return;
    setPostBody((prev) => prev.replace(/@([a-zA-Z0-9_.-]{0,30})$/, `@${handle} `));
    setMentionQuery("");
  };

  const mentionSuggestions = mentionQuery
    ? mentionOptions.filter((item) =>
        item.handle?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        item.label.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Pastel.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden={true} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.coverWrap}
          onPress={() => {
            if (group?.cover_image_url) setViewerUri(group.cover_image_url);
          }}
        >
          <View style={styles.coverClip}>
            {group?.cover_image_url ? (
              <Image
                source={group.cover_image_url}
                style={styles.coverImage}
                contentFit="cover"
                cachePolicy="none"
              />
            ) : (
              <View style={styles.coverFallback} />
            )}
          </View>
          <Pressable
            style={styles.avatarWrap}
            onPress={() => {
              if (group?.avatar_image_url) setViewerUri(group.avatar_image_url);
            }}
          >
            {group?.avatar_image_url ? (
              <Image source={group.avatar_image_url} style={styles.avatarImage} cachePolicy="none" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {(group?.name ?? "Club").slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {group?.name ?? `Groupe ${groupId ?? ""}`}
          </Text>
          <View style={styles.metaRow}>
            {primaryActivity ? (
              <View style={styles.activityChip}>
                <Text style={styles.activityText}>{primaryActivity}</Text>
              </View>
            ) : null}
            <Text style={styles.metaText}>
              {memberCount} {memberLabel}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>
              {group?.visibility === "private" ? "Privé" : "Public"}
            </Text>
            {membership?.status === "approved" && membership.role ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>
                  {membership.role === "founder"
                    ? "Fondateur"
                    : membership.role === "admin"
                    ? "Admin"
                    : "Membre"}
                </Text>
              </>
            ) : null}
          </View>
          {group?.description ? <Text style={styles.description}>{group.description}</Text> : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.iconScroller}
            contentContainerStyle={styles.iconRow}
          >
            {[
              /*
              isJoinable
              isAdmin ? {
                    key: "join",
                    label: "Rejoindre",
                    icon: "log-in" as const,
                    onPress: handleJoin,
                  }
                : null,

                ? {
                    key: "settings",
                    label: "Parametre",
                    icon: "settings-sharp" as const,
                    onPress: () => router.push(`/groups/${groupId}/settings`),
                  }
                : null,
              */
              isJoinable ? {
                    key: "join",
                    label: "Rejoindre",
                    icon: "log-in" as const,
                    onPress: handleJoin,
                  }
                : null,
              isAdmin ? {
                    key: "settings",
                    label: "Parametre",
                    icon: "settings-sharp" as const,
                    onPress: () => router.push(`/groups/${groupId}/settings`),
                  }
                : null,
              {
                key: "members",
                label: "Liste des membres",
                icon: "people" as const,
                onPress: () => router.push(`/groups/${groupId}/members`),
              },
              {
                key: "invite",
                label: "Inviter",
                icon: "person-add" as const,
                onPress: handleInvite,
              },
              {
                key: "gallery",
                label: "Galerie",
                icon: "images" as const,
                onPress: handleOpenGallery,
              },
              {
                key: "share",
                label: "Partager",
                icon: "share-social" as const,
                onPress: handleShare,
              },
              {
                key: "events",
                label: "Événements",
                icon: "calendar" as const,
                onPress: handleViewEvents,
              },
            ]
              .filter(Boolean)
              .map((item) => (
                <Pressable
                  key={(item as { key: string }).key}
                  style={styles.iconItem}
                  onPress={(item as { onPress: () => void }).onPress}
                >
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={(item as { icon: keyof typeof Ionicons.glyphMap }).icon}
                      size={27}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.iconLabel}>
                    {(item as { label: string }).label}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>

          {membership?.status === "approved" ? null : membership?.status === "pending" ? (
            <View style={styles.pendingRow}>
              <Text style={styles.pendingText}>Demande en attente d'approbation.</Text>
            </View>
          ) : (
            <Pressable style={styles.primary} onPress={handleJoin} disabled={joining}>
              <Text style={styles.primaryText}>
                {joining ? "Envoi..." : "Rejoindre le groupe"}
              </Text>
            </Pressable>
          )}
          </View>


        {membership?.status === "approved" &&
        membership?.role &&
        ["admin", "founder"].includes(membership.role) &&
        pendingMembers.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Demandes en attente</Text>
            <View style={styles.pendingList}>
              {pendingMembers.map((member) => (
                <View key={member.user_id} style={styles.pendingCard}>
                  <View style={styles.pendingUserRow}>
                    {pendingProfiles[member.user_id]?.avatar_url ? (
                      <Image
                        source={pendingProfiles[member.user_id]?.avatar_url ?? ""}
                        style={styles.pendingAvatar}
                      />
                    ) : (
                      <View style={styles.pendingAvatarFallback}>
                        <Text style={styles.pendingAvatarText}>
                          {(pendingProfiles[member.user_id]?.name ?? "U")
                            .slice(0, 2)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.pendingUser}>
                      {pendingProfiles[member.user_id]?.name ??
                        `${member.user_id.slice(0, 8)}...`}
                    </Text>
                  </View>
                  <View style={styles.pendingActions}>
                    <Pressable
                      style={styles.primarySmall}
                      onPress={() => handleMemberDecision(member.user_id, "approved")}
                      disabled={handlingMember[member.user_id]}
                    >
                      <Text style={styles.primaryText}>Accepter</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondarySmall}
                      onPress={() => handleMemberDecision(member.user_id, "rejected")}
                      disabled={handlingMember[member.user_id]}
                    >
                      <Text style={styles.secondaryText}>Refuser</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <SectionDivider />
        {membership?.status === "approved" ? (
          canPost ? (
            <View style={styles.composerShell}>
              <Pressable style={styles.composerPreview} onPress={() => handleOpenComposer(false)}>
                {currentMemberAvatar ? (
                  <Image source={currentMemberAvatar} style={styles.composerAvatar} />
                ) : (
                  <View style={styles.composerAvatarFallback}>
                    <Text style={styles.composerAvatarText}>
                      {(session?.user?.email ?? "U").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.composerPlaceholder}>Partagez votre message...</Text>
              </Pressable>
              <Pressable style={styles.composerMedia} onPress={() => handleOpenComposer(false)}>
                <Ionicons name="image-outline" size={20} color={Pastel.textMuted} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Publication restreinte</Text>
              <Text style={styles.noticeText}>
                Les publications sont réservées aux admins de ce club.
              </Text>
            </View>
          )
        ) : null}
        <SectionDivider />

        <View style={styles.section}>

          {posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Les publications du groupe apparaissent ici.
              </Text>
            </View>
          ) : (
            <View style={styles.postList}>
              {posts.map((post, index) => (
                <View key={post.id} style={[styles.postCard, index < posts.length - 1 ? styles.postCardDivider : null]}>
                  <View style={styles.postHeader}>
                    <Pressable
                      style={styles.authorRow}
                      onPress={() => post.author_id && router.push(`/profile/${post.author_id}`)}
                    >
                      {post.author_avatar ? (
                        <Image source={post.author_avatar} style={styles.authorAvatar} />
                      ) : (
                        <View style={styles.authorFallback}>
                          <Text style={styles.authorFallbackText}>
                            {(post.author_name ?? "Membre").slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.authorName}>{post.author_name ?? "Membre"}</Text>
                        {post.author_role ? (
                          <Text style={styles.authorRole}>
                            {post.author_role === "founder"
                              ? "Fondateur"
                              : post.author_role === "admin"
                              ? "Admin"
                              : "Membre"}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <View style={styles.postHeaderActions}>
                      {post.is_important ? (
                        <View style={styles.importantBadge}>
                          <Text style={styles.importantText}>Important</Text>
                        </View>
                      ) : null}
                      <Pressable
                        style={styles.postMenuButton}
                        onPress={() =>
                          handleOpenPostActions({
                            id: post.id,
                            body: post.body ?? null,
                            author_id: post.author_id ?? null,
                            is_pinned: post.is_pinned,
                          })
                        }
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={Pastel.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={styles.postBody}>
                    {post.body ? renderWithMentions(post.body) : "(Sans texte)"}
                  </Text>
                  {post.location_label ? (
                    <View style={styles.locationPill}>
                      <Ionicons name="location-outline" size={12} color={Pastel.textMuted} />
                      <Text style={styles.locationPillText} numberOfLines={1}>{post.location_label}</Text>
                    </View>
                  ) : null}
                  {post.gif_url ? (
                    <Image source={{ uri: post.gif_url }} style={styles.postGif} contentFit="cover" />
                  ) : null}
                  {post.media.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.mediaScroller}
                      contentContainerStyle={styles.mediaRow}
                    >
                      {post.media.map((media) => (
                        <View key={media.id} style={styles.mediaCard}>
                          {media.media_type === "image" ? (
                            <Image
                              source={{ uri: media.url }}
                              style={styles.mediaImage}
                              contentFit="cover"
                            />
                          ) : (
                            <Video
                              source={{ uri: media.url }}
                              style={styles.mediaVideo}
                              useNativeControls
                              resizeMode={ResizeMode.COVER}
                            />
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                  {pollsByPost[post.id] ? (
                    <View style={styles.pollCard}>
                      <Text style={styles.pollQuestion}>{pollsByPost[post.id].question}</Text>
                      <View style={styles.pollOptions}>
                        {pollsByPost[post.id].options.map((option) => {
                          const selected = pollsByPost[post.id].myOptionId === option.id;
                          return (
                            <Pressable
                              key={option.id}
                              onPress={() => handleVotePoll(post.id, option.id)}
                              style={[styles.pollOptionButton, selected ? styles.pollOptionButtonSelected : null]}
                            >
                              <View
                                style={[
                                  styles.pollOptionFill,
                                  { width: `${option.percent}%` },
                                  selected ? styles.pollOptionFillSelected : null,
                                ]}
                              />
                              <View style={styles.pollOptionContent}>
                                <Text
                                  style={[
                                    styles.pollOptionLabel,
                                    selected ? styles.pollOptionLabelSelected : null,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                                <Text style={styles.pollOptionPercent}>{option.percent}%</Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={styles.pollMeta}>
                        {pollsByPost[post.id].totalVotes} vote
                        {pollsByPost[post.id].totalVotes > 1 ? "s" : ""}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.postFooter}>
                    <Text style={styles.postMeta}>
                      {new Date(post.created_at).toLocaleDateString("fr-FR")}
                    </Text>
                    <View style={styles.postIconRow}>
                      <Pressable style={styles.postIconButton} onPress={() => handleToggleLike(post.id)}>
                        <Image
                          source={likeIcon}
                          style={[
                            styles.postIconImage,
                            myLikes[post.id] ? styles.postIconImageActive : styles.postIconImageInactive,
                          ]}
                          contentFit="contain"
                        />
                        <Text
                          style={[
                            styles.postIconText,
                            myLikes[post.id] ? styles.postIconTextActive : null,
                          ]}
                        >
                          {likeCounts[post.id] ?? 0}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.postIconButton} onPress={() => handleOpenPost(post.id)}>
                        <Image
                          source={commentIcon}
                          style={[styles.postIconImage, styles.postIconImageInactive]}
                          contentFit="contain"
                        />
                        <Text style={styles.postIconText}>{commentCounts[post.id] ?? 0}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        </View>
      </ScrollView>

      <Modal
        visible={!!actionPost}
        transparent
        animationType="slide"
        onRequestClose={() => setActionPost(null)}
      >
        <Pressable style={styles.actionSheetBackdrop} onPress={() => setActionPost(null)}>
          <View style={styles.actionSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.actionSheetHandle} />
            {canEditPost ? (
              <Pressable style={styles.actionItem} onPress={handleEditPost}>
                <Text style={styles.actionItemText}>Modifier la publication</Text>
              </Pressable>
            ) : null}
            {canEditPost ? (
              <Pressable style={styles.actionItem} onPress={handleDeletePost}>
                <Text style={[styles.actionItemText, styles.actionItemDanger]}>
                  Supprimer la publication
                </Text>
              </Pressable>
            ) : null}
            {canPinPost ? (
              <Pressable style={styles.actionItem} onPress={handleTogglePin}>
                <Text style={styles.actionItemText}>
                  {actionPost?.is_pinned ? "Désépingler la publication" : "Épingler la publication"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.actionItem} onPress={handleReportComment}>
              <Text style={styles.actionItemText}>Signaler un commentaire</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
          {viewerUri ? (
            <Image
              source={viewerUri}
              style={styles.viewerBlur}
              contentFit="cover"
              blurRadius={18}
            />
          ) : null}
          <View style={styles.viewerOverlay} />
          <Pressable style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          {viewerUri ? (
            <View style={styles.viewerImageWrap}>
              <Image source={viewerUri} style={styles.viewerImage} contentFit="contain" />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },
  container: { paddingTop: 0, paddingBottom: 80 },
  content: { paddingHorizontal: 14, gap: 16 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.background,
    gap: 12,
    padding: 20,
  },
  backButton: { alignSelf: "flex-start" },
  backText: { color: Pastel.textMuted, fontFamily: Font.bold, includeFontPadding: false },
  coverWrap: {
    width: "100%",
    alignSelf: "stretch",
    position: "relative",
    overflow: "visible",
    marginBottom: 10,
  },
  coverClip: { width: "100%", height: 220, borderRadius: 0, overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  coverFallback: { width: "100%", height: "100%", backgroundColor: Pastel.surfaceAlt },
  coverEdit: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coverEditText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  avatarWrap: {
    position: "absolute",
    left: 14,
    bottom: -18,
    width: 84,
    height: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Pastel.background,
    overflow: "hidden",
    backgroundColor: Pastel.surface,
    zIndex: 5,
    elevation: 5,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  avatarText: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  headerContent: { paddingTop: 10, paddingLeft: 0, gap: 10 },
  title: { fontSize: 20, fontFamily: Font.bold, color: Pastel.text, marginBottom: 4, marginTop: 6, includeFontPadding: false },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  metaDot: { color: Pastel.textMuted, fontSize: 12, includeFontPadding: false },
  settingsPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#C8BEAE",
  },
  settingsPillText: { fontSize: 10, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  activityRow: { flexDirection: "row", alignItems: "center" },
  activityChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  activityText: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  description: { fontSize: 13, color: Pastel.text, includeFontPadding: false },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  tagChipAlt: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  tagText: { fontSize: 11, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  actionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  iconScroller: { marginRight: -14 },
  iconRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 0,
    paddingRight: 0,
  },
  iconItem: { width: 76, alignItems: "center", gap: 6 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Pastel.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLabel: { fontSize: 11, color: Pastel.text, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
  },
  actionPillText: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  membersPreview: { gap: 8, marginTop: 4 },
  memberAvatars: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  memberAvatarWrap: { width: 34, height: 34, borderRadius: 12, overflow: "hidden" },
  memberAvatar: { width: "100%", height: "100%" },
  memberAvatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  memberAvatarText: { fontSize: 11, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  membersLinkText: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  pendingRow: { marginTop: 6 },
  pendingText: { color: Pastel.textMuted, fontSize: 12, includeFontPadding: false },
  primary: {
    marginTop: 6,
    backgroundColor: Pastel.primary,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontFamily: Font.bold, includeFontPadding: false },
  section: { gap: 12 },
  sectionTitle: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  sectionDivider: { marginVertical: 4, marginHorizontal: -16 },
  sectionDividerLine: { height: 1, backgroundColor: Pastel.border, width: "100%" },
  sectionHint: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  linkInline: { alignSelf: "flex-start" },
  linkInlineText: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  adminTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  adminEmoji: { fontSize: 14, includeFontPadding: false },
  adminGroup: { gap: 8 },
  adminGroupTitle: { fontSize: 12, fontFamily: Font.bold, color: Pastel.textMuted, includeFontPadding: false },
  adminLinks: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  adminLink: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
  },
  adminLinkText: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  pendingList: { gap: 10 },
  pendingCard: { gap: 8 },
  pendingUser: { fontSize: 12, color: Pastel.text, includeFontPadding: false },
  pendingUserRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingAvatar: { width: 30, height: 30, borderRadius: 10 },
  pendingAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  pendingAvatarText: { fontSize: 11, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  pendingActions: { flexDirection: "row", gap: 8 },
  composerShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Pastel.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 12,
  },
  composerPreview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  composerAvatar: { width: 40, height: 40, borderRadius: 20 },
  composerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  composerAvatarText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  composerPlaceholder: { color: Pastel.textMuted, fontSize: 13, flex: 1, includeFontPadding: false },
  composerMedia: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Pastel.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
    gap: 6,
  },
  noticeTitle: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  noticeText: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  input: {
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Pastel.text,
    backgroundColor: Pastel.surfaceAlt,
    minHeight: 80,
    textAlignVertical: "top",
  },
  primarySmall: {
    backgroundColor: Pastel.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondarySmall: {
    backgroundColor: Pastel.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  secondaryText: { color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  flagChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surfaceAlt,
    alignSelf: "flex-start",
  },
  flagChipActive: { backgroundColor: "#FEF3C7", borderColor: "#FEF3C7" },
  flagText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.bold, includeFontPadding: false },
  flagTextActive: { color: "#92400E" },
  emptyCard: { paddingVertical: 6 },
  emptyText: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  postList: { gap: 0 },
  postCard: {
    gap: 10,
    backgroundColor: Pastel.surface,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  postCardDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  postBody: { fontSize: 14, color: Pastel.text, lineHeight: 21, includeFontPadding: false },
  locationPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
    backgroundColor: Pastel.surfaceAlt, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Pastel.border,
  },
  locationPillText: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  postGif: { width: "100%", height: 200, borderRadius: 14 },
  mention: { color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  mentionList: {
    backgroundColor: Pastel.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Pastel.border,
    padding: 8,
    gap: 6,
  },
  mentionRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Pastel.surfaceAlt,
  },
  mentionLabel: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  mentionMeta: { fontSize: 11, color: Pastel.textMuted, includeFontPadding: false },
  mediaScroller: { marginRight: -14 },
  mediaRow: { gap: 10, paddingVertical: 6, paddingRight: 0 },
  mediaCard: {
    width: 180,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  mediaImage: { width: "100%", height: "100%" },
  mediaVideo: { width: "100%", height: "100%" },
  pollCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: Pastel.surface,
  },
  pollQuestion: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  pollOptions: { gap: 6 },
  pollOptionButton: {
    borderWidth: 1,
    borderColor: Pastel.border,
    borderRadius: 10,
    overflow: Platform.OS === "android" ? "visible" : "hidden",
    backgroundColor: Pastel.surfaceAlt,
    position: "relative",
  },
  pollOptionButtonSelected: { borderColor: Pastel.primary },
  pollOptionFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#DCE7FF",
  },
  pollOptionFillSelected: { backgroundColor: "#C9DBFF" },
  pollOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 10,
  },
  pollOptionLabel: { flex: 1, color: Pastel.text, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  pollOptionLabelSelected: { color: Pastel.text },
  pollOptionPercent: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  pollMeta: { color: Pastel.textMuted, fontSize: 11, includeFontPadding: false },
  postFooter: { gap: 8, marginTop: 2 },
  postMeta: { fontSize: 11, color: Pastel.textMuted, includeFontPadding: false },
  postIconRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  postIconButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  postIconImage: { width: 28, height: 28 },
  postIconImageActive: { tintColor: "#6366F1" },
  postIconImageInactive: { tintColor: Pastel.textMuted },
  postIconText: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  postIconTextActive: { color: Pastel.text },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20 },
  authorFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  authorFallbackText: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  authorName: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  authorRole: { fontSize: 11, color: Pastel.textMuted, marginTop: 1, includeFontPadding: false },
  importantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  importantText: { fontSize: 10, color: "#92400E", fontFamily: Font.bold, includeFontPadding: false },
  postHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  postMenuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: Pastel.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
  actionSheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: Pastel.border,
    alignSelf: "center",
  },
  actionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  actionItemText: { fontSize: 15, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  actionItemDanger: { color: "#EF4444" },
  viewerBackdrop: { flex: 1, backgroundColor: "#000" },
  viewerBlur: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  viewerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  viewerImageWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  viewerImage: { width: "100%", height: "100%" },
  viewerClose: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});



























