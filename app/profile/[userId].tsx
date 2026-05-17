import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/services/supabase";
import { listGroupPostMedia } from "@/services/groups";

type ProfileRow = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  is_private?: boolean | null;
};

type UserGroup = {
  id: number;
  name: string;
  cover_image_url?: string | null;
};

type UserPost = {
  id: number;
  body: string | null;
  created_at: string;
  group_id: number;
  group_name?: string | null;
};

const displayNameFromProfile = (profile?: ProfileRow | null) => {
  if (!profile) return "Utilisateur";
  const first = profile.firstname?.trim();
  const last = profile.lastname?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  const handle = profile.handle?.trim();
  if (handle) return handle;
  return "Utilisateur";
};

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { session } = useAuth();
  const viewerId = session?.user?.id ?? null;
  const targetUserId = useMemo(() => (userId ? String(userId) : null), [userId]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (cancelled) return;
        const nextProfile = (profileData as ProfileRow) ?? null;
        setProfile(nextProfile);

        const isPrivate =
          !!nextProfile?.is_private && viewerId && viewerId !== targetUserId;
        if (isPrivate) {
          setGroups([]);
          setPosts([]);
          setPhotos([]);
          return;
        }

        const { data: memberships } = await supabase
          .from("community_group_members")
          .select("group_id, community_groups(id, name, cover_image_url)")
          .eq("user_id", targetUserId)
          .eq("status", "approved");

        const mappedGroups =
          (memberships ?? [])
            .map((row: any) => row.community_groups)
            .filter(Boolean)
            .map((g: any) => ({
              id: Number(g.id),
              name: String(g.name ?? ""),
              cover_image_url: g.cover_image_url ?? null,
            })) ?? [];
        setGroups(mappedGroups);

        const { data: postRows } = await supabase
          .from("community_group_posts")
          .select("id, body, created_at, group_id, community_groups(name)")
          .eq("author_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(20);

        const mappedPosts =
          (postRows ?? []).map((row: any) => ({
            id: Number(row.id),
            body: row.body ?? null,
            created_at: String(row.created_at),
            group_id: Number(row.group_id),
            group_name: row?.community_groups?.name ?? null,
          })) ?? [];
        setPosts(mappedPosts);

        const postIds = mappedPosts.map((p: { id: number }) => p.id);
        if (postIds.length > 0) {
          const mediaRows = await listGroupPostMedia(postIds);
          const photoUrls = mediaRows
            .filter((row: { media_type: "image" | "video"; url: string }) => row.media_type === "image")
            .map((row) => row.url);
          setPhotos(photoUrls);
        } else {
          setPhotos([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [targetUserId, viewerId]);

  if (!targetUserId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Profil introuvable.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#111827"} />
      </View>
    );
  }

  const displayName = displayNameFromProfile(profile);
  const isPrivate =
    !!profile?.is_private && viewerId && viewerId !== targetUserId;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={22} color={"#111827"} />
        </Pressable>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          {profile?.avatar_url ? (
            <Image source={profile.avatar_url} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{displayName.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            {profile?.city ? <Text style={styles.profileMeta}>{profile.city}</Text> : null}
            {profile?.bio ? <Text style={styles.profileBio}>{profile.bio}</Text> : null}
          </View>
        </View>

        {isPrivate ? (
          <Text style={styles.privateNote}>
            Ce profil est privé. Seules la photo et l'identité sont visibles.
          </Text>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Clubs</Text>
              {groups.length === 0 ? (
                <Text style={styles.emptyText}>Aucun club public affichable.</Text>
              ) : (
                <View style={styles.chipRow}>
                  {groups.map((group) => (
                    <View key={group.id} style={styles.chip}>
                      <Text style={styles.chipText}>{group.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Publications</Text>
              {posts.length === 0 ? (
                <Text style={styles.emptyText}>Aucune publication.</Text>
              ) : (
                <View style={styles.postList}>
                  {posts.map((post) => (
                    <View key={post.id} style={styles.postItem}>
                      <Text style={styles.postGroup}>{post.group_name ?? "Club"}</Text>
                      <Text style={styles.postBody}>
                        {post.body ? post.body : "(Sans texte)"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photos partagées</Text>
              {photos.length === 0 ? (
                <Text style={styles.emptyText}>Aucune photo.</Text>
              ) : (
                <View style={styles.photoGrid}>
                  {photos.map((url, index) => (
                    <View key={`${url}-${index}`} style={styles.photoCard}>
                      <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: "transparent",
  },
  headerAction: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontWeight: "700", color: "#111827" },
  content: { padding: 16, gap: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#6B7280", fontSize: 12 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 16 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  profileMeta: { fontSize: 12, color: "#6B7280" },
  profileBio: { fontSize: 12, color: "#111827" },
  privateNote: { fontSize: 12, color: "#6B7280" },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#111827" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F3F4F6",
  },
  chipText: { fontSize: 11, color: "#111827" },
  postList: { gap: 12 },
  postItem: { gap: 4 },
  postGroup: { fontSize: 11, fontWeight: "700", color: "#6B7280" },
  postBody: { fontSize: 12, color: "#111827" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  photo: { width: "100%", height: "100%" },
});
