import { supabase } from "./supabase";
import * as FileSystem from "expo-file-system/legacy";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type CommunityGroup = {
  id: number;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  post_permission: "members" | "admins";
  created_by: string | null;
  cover_image_url: string | null;
  avatar_image_url: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  charter_version: number;
  created_at: string;
  updated_at: string;
};

export type CreateGroupInput = {
  name: string;
  description?: string | null;
  visibility?: "public" | "private";
  post_permission?: "members" | "admins";
  cover_image_url?: string | null;
  avatar_image_url?: string | null;
  location_place_id?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  charter_version?: number;
  topicIds?: number[];
  eventCategoryIds?: number[];
};

export type GroupMembership = {
  group_id: number;
  user_id: string;
  role: "member" | "admin" | "founder";
  status: "pending" | "approved" | "rejected" | "banned";
};

export type GroupTopic = {
  id: number;
  label: string;
  category: string;
  slug?: string | null;
  sort_order?: number | null;
};

export type EventCategory = {
  id: number;
  name: string;
};

export type GroupTopicTag = {
  group_id: number;
  topic_id: number;
  rank: number;
  community_group_topics?: { label?: string | null; category?: string | null } | null;
};

export type GroupEventCategory = {
  group_id: number;
  category_id: number;
  rank: number;
  event_categories?: { name?: string | null } | null;
};

export type GroupPost = {
  id: number;
  group_id: number;
  author_id: string | null;
  body: string | null;
  is_pinned: boolean;
  is_important: boolean;
  created_at: string;
  updated_at: string;
  location_place_id?: string | null;
  location_label?: string | null;
  gif_url?: string | null;
};

export type GroupPostComment = {
  id: number;
  post_id: number;
  author_id: string | null;
  body: string;
  created_at: string;
};

export type GroupPostMedia = {
  id: number;
  post_id: number;
  url: string;
  media_type: "image" | "video";
  created_at: string;
};

export type ProfileSummary = {
  user_id: string;
  handle: string | null;
  firstname: string | null;
  lastname: string | null;
  avatar_url: string | null;
};

export type GroupNotificationDefaults = {
  user_id: string;
  enabled: boolean;
  default_level: "all" | "important" | "none";
};

export type GroupNotificationSetting = {
  user_id: string;
  group_id: number;
  level: "all" | "important" | "none";
  notify_mentions: boolean;
};

export async function listGroups() {
  const { data, error } = await supabase
    .from("community_groups")
    .select(
      "id, name, description, visibility, post_permission, created_by, cover_image_url, avatar_image_url, location_place_id, location_lat, location_lng, charter_version, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CommunityGroup[];
}

export async function updateGroup(groupId: number, patch: Partial<CommunityGroup>) {
  const { data, error } = await supabase
    .from("community_groups")
    .update(patch)
    .eq("id", groupId)
    .select(
      "id, name, description, visibility, post_permission, created_by, cover_image_url, avatar_image_url, location_place_id, location_lat, location_lng, charter_version, created_at, updated_at"
    )
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CommunityGroup | null;
}

export async function listGroupTopics() {
  const { data, error } = await supabase
    .from("community_group_topics")
    .select("id, label, category, slug, sort_order, is_active")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GroupTopic[];
}

export async function listEventCategories() {
  const { data, error } = await supabase
    .from("event_categories")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventCategory[];
}

export async function listGroupTopicTags(groupIds: number[]) {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("community_group_topic_tags")
    .select("group_id, topic_id, rank, community_group_topics(label, category)")
    .in("group_id", groupIds);
  if (error) throw error;
  return (data ?? []) as GroupTopicTag[];
}

export async function setGroupPrimaryTopicTag(groupId: number, topicId: number) {
  const { data, error } = await supabase
    .from("community_group_topic_tags")
    .upsert(
      {
        group_id: groupId,
        topic_id: topicId,
        rank: 1,
      },
      { onConflict: "group_id,rank" }
    )
    .select("group_id, topic_id, rank, community_group_topics(label, category)")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as GroupTopicTag | null;
}

export async function listGroupEventCategories(groupIds: number[]) {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("community_group_event_categories")
    .select("group_id, category_id, rank, event_categories(name)")
    .in("group_id", groupIds);
  if (error) throw error;
  return (data ?? []) as GroupEventCategory[];
}

export async function getGroupById(groupId: number) {
  const { data, error } = await supabase
    .from("community_groups")
    .select(
      "id, name, description, visibility, post_permission, created_by, cover_image_url, avatar_image_url, location_place_id, location_lat, location_lng, charter_version, created_at, updated_at"
    )
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as CommunityGroup | null;
}

export async function getGroupMembership(groupId: number, userId: string) {
  const { data, error } = await supabase
    .from("community_group_members")
    .select("group_id, user_id, role, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as GroupMembership | null;
}

export async function listGroupMembers(groupId: number, status?: GroupMembership["status"]) {
  let query = supabase
    .from("community_group_members")
    .select("group_id, user_id, role, status, joined_at, approved_at")
    .eq("group_id", groupId);

  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as (GroupMembership & {
    joined_at?: string;
    approved_at?: string | null;
  })[];
}

export async function listGroupMemberCounts(
  groupIds: number[],
  status: GroupMembership["status"] = "approved"
) {
  if (groupIds.length === 0) return {} as Record<number, number>;
  const { data, error } = await supabase
    .from("community_group_members")
    .select("group_id, status")
    .in("group_id", groupIds)
    .eq("status", status);
  if (error) throw error;
  const counts: Record<number, number> = {};
  (data ?? []).forEach((row: { group_id?: number | null }) => {
    const id = row?.group_id;
    if (typeof id === "number") counts[id] = (counts[id] ?? 0) + 1;
  });
  return counts;
}

export async function listProfilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, handle, firstname, lastname, avatar_url")
    .in("user_id", userIds);
  if (error) throw error;
  return (data ?? []) as ProfileSummary[];
}

export async function resolveMentionUserIds(handles: string[]) {
  const normalized = Array.from(
    new Set(handles.map((h) => h.trim()).filter(Boolean))
  );
  if (normalized.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, handle")
    .in("handle", normalized);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.user_id as string);
}

export async function updateGroupMemberStatus(params: {
  groupId: number;
  userId: string;
  status: GroupMembership["status"];
  approvedBy?: string;
}) {
  const patch: Record<string, any> = {
    status: params.status,
  };
  if (params.status === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = params.approvedBy ?? null;
  }
  const { data, error } = await supabase
    .from("community_group_members")
    .update(patch)
    .eq("group_id", params.groupId)
    .eq("user_id", params.userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as GroupMembership | null;
}

export async function listMyGroups(userId: string) {
  const { data, error } = await supabase
    .from("community_group_members")
    .select("group_id, status, role, community_groups(name)")
    .eq("user_id", userId)
    .eq("status", "approved");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    group_id: row.group_id as number,
    name: String(row?.community_groups?.name ?? ""),
    role: row.role as GroupMembership["role"],
  }));
}

export async function getGroupNotificationDefaults(userId: string) {
  const { data, error } = await supabase
    .from("user_group_notification_defaults")
    .select("user_id, enabled, default_level")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as GroupNotificationDefaults | null;
}

export async function setGroupNotificationDefaults(params: {
  userId: string;
  enabled: boolean;
  defaultLevel: "all" | "important" | "none";
}) {
  const { data, error } = await supabase
    .from("user_group_notification_defaults")
    .upsert({
      user_id: params.userId,
      enabled: params.enabled,
      default_level: params.defaultLevel,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as GroupNotificationDefaults | null;
}

export async function listGroupNotificationSettings(userId: string) {
  const { data, error } = await supabase
    .from("community_group_notification_settings")
    .select("user_id, group_id, level, notify_mentions")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as GroupNotificationSetting[];
}

export async function setGroupNotificationSetting(params: {
  userId: string;
  groupId: number;
  level: "all" | "important" | "none";
  notifyMentions: boolean;
}) {
  const { data, error } = await supabase
    .from("community_group_notification_settings")
    .upsert({
      user_id: params.userId,
      group_id: params.groupId,
      level: params.level,
      notify_mentions: params.notifyMentions,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as GroupNotificationSetting | null;
}

export async function requestJoinGroup(groupId: number, userId: string) {
  const { data, error } = await supabase
    .from("community_group_members")
    .insert({ group_id: groupId, user_id: userId, status: "pending" })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function acceptGroupCharter(groupId: number, userId: string, version: number) {
  const { data, error } = await supabase
    .from("community_group_charter_acceptance")
    .upsert({
      group_id: groupId,
      user_id: userId,
      accepted_version: version,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function attachGroupTags(
  groupId: number,
  topicIds?: number[],
  eventCategoryIds?: number[]
) {
  const topics = (topicIds ?? []).slice(0, 3);
  const eventTags = (eventCategoryIds ?? []).slice(0, 3);

  if (topics.length > 0) {
    const rows = topics.map((topicId, index) => ({
      group_id: groupId,
      topic_id: topicId,
      rank: index + 1,
    }));
    const { error } = await supabase.from("community_group_topic_tags").insert(rows);
    if (error) throw error;
  }

  if (eventTags.length > 0) {
    const rows = eventTags.map((categoryId, index) => ({
      group_id: groupId,
      category_id: categoryId,
      rank: index + 1,
    }));
    const { error } = await supabase.from("community_group_event_categories").insert(rows);
    if (error) throw error;
  }
}

export async function createGroup(userId: string, input: CreateGroupInput) {
  const charterVersion = input.charter_version ?? 1;
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    visibility: input.visibility ?? "public",
    post_permission: input.post_permission ?? "members",
    created_by: userId,
    cover_image_url: input.cover_image_url ?? null,
    avatar_image_url: input.avatar_image_url ?? null,
    location_place_id: input.location_place_id ?? null,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
  };

  const { data: group, error: groupError } = await supabase
    .from("community_groups")
    .insert(payload)
    .select()
    .maybeSingle();

  if (groupError) throw groupError;
  if (!group) return null;

  const { error: memberError } = await supabase.from("community_group_members").insert({
    group_id: group.id,
    user_id: userId,
    role: "founder",
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: userId,
  });
  if (memberError) throw memberError;

  await acceptGroupCharter(group.id, userId, charterVersion);
  await attachGroupTags(group.id, input.topicIds, input.eventCategoryIds);
  return group as CommunityGroup;
}

export async function listGroupPosts(groupId: number) {
  const { data, error } = await supabase
    .from("community_group_posts")
    .select("id, group_id, author_id, body, is_pinned, is_important, created_at, updated_at, location_place_id, location_label, gif_url")
    .eq("group_id", groupId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as GroupPost[];
}

export async function listGroupPostMedia(postIds: number[]) {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("community_group_post_media")
    .select("id, post_id, url, media_type, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GroupPostMedia[];
}

export async function listGroupGalleryMedia(groupId: number) {
  const { data, error } = await supabase
    .from("community_group_post_media")
    .select("id, post_id, url, media_type, created_at, community_group_posts!inner(group_id)")
    .eq("community_group_posts.group_id", groupId)
    .eq("media_type", "image")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { id: number; post_id: number; url: string; created_at: string }) => ({
    id: row.id,
    post_id: row.post_id,
    url: row.url,
    created_at: row.created_at,
  })) as { id: number; post_id: number; url: string; created_at: string }[];
}

async function notifyGroupPost(params: {
  groupId: number;
  postId: number;
  authorId: string;
  body?: string | null;
  isImportant?: boolean;
  isPinned?: boolean;
  mentionUserIds?: string[];
}) {
  try {
    await supabase.functions.invoke("group-post-notify", {
      body: {
        group_id: params.groupId,
        post_id: params.postId,
        author_id: params.authorId,
        body: params.body ?? "",
        is_important: params.isImportant ?? false,
        is_pinned: params.isPinned ?? false,
        mention_user_ids: params.mentionUserIds ?? [],
      },
    });
  } catch {
    // ignore notification errors
  }
}

export async function createGroupPost(
  groupId: number,
  userId: string,
  body: string,
  options?: { isImportant?: boolean; isPinned?: boolean; locationPlaceId?: string; locationLabel?: string; gifUrl?: string }
) {
  const mentionMatches = body.match(/@([a-zA-Z0-9_.-]{2,30})/g) ?? [];
  const handles = mentionMatches.map((item) => item.replace(/^@/, ""));
  let mentionUserIds: string[] = [];
  try {
    mentionUserIds = await resolveMentionUserIds(handles);
  } catch {
    mentionUserIds = [];
  }

  const { data, error } = await supabase
    .from("community_group_posts")
    .insert({
      group_id: groupId,
      author_id: userId,
      body: body.trim(),
      is_important: options?.isImportant ?? false,
      is_pinned: options?.isPinned ?? false,
      ...(options?.locationPlaceId ? { location_place_id: options.locationPlaceId, location_label: options.locationLabel ?? null } : {}),
      ...(options?.gifUrl ? { gif_url: options.gifUrl } : {}),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  const row = (data ?? null) as GroupPost | null;
  if (row) {
    await notifyGroupPost({
      groupId,
      postId: row.id,
      authorId: userId,
      body: row.body,
      isImportant: row.is_important,
      isPinned: row.is_pinned,
      mentionUserIds,
    });
  }
  return row;
}

export async function updateGroupPost(postId: number, body: string) {
  const { data, error } = await supabase
    .from("community_group_posts")
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select("id, body, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data as { id: number; body: string | null; updated_at: string } | null;
}

export async function setGroupPostPinned(params: {
  groupId: number;
  postId: number;
  isPinned: boolean;
}) {
  if (params.isPinned) {
    const { error: clearError } = await supabase
      .from("community_group_posts")
      .update({ is_pinned: false })
      .eq("group_id", params.groupId)
      .neq("id", params.postId);
    if (clearError) throw clearError;
  }
  const { data, error } = await supabase
    .from("community_group_posts")
    .update({ is_pinned: params.isPinned, updated_at: new Date().toISOString() })
    .eq("id", params.postId)
    .select("id, is_pinned")
    .maybeSingle();
  if (error) throw error;
  return data as { id: number; is_pinned: boolean } | null;
}

export async function updateGroupMemberRole(params: {
  groupId: number;
  userId: string;
  role: GroupMembership["role"];
}) {
  const { data, error } = await supabase
    .from("community_group_members")
    .update({ role: params.role })
    .eq("group_id", params.groupId)
    .eq("user_id", params.userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as GroupMembership | null;
}

export async function deleteGroup(groupId: number) {
  const { error } = await supabase.from("community_groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function createGroupReport(params: {
  groupId: number;
  reporterId: string;
  reason: string;
  postId?: number;
  commentId?: number;
  targetUserId?: string | null;
}) {
  const { data, error } = await supabase
    .from("community_group_reports")
    .insert({
      group_id: params.groupId,
      reporter_id: params.reporterId,
      reason: params.reason,
      post_id: params.postId ?? null,
      comment_id: params.commentId ?? null,
      target_user_id: params.targetUserId ?? null,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createGroupAuditLog(params: {
  groupId: number;
  actorId: string;
  action: string;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("community_group_audit_logs")
    .insert({
      group_id: params.groupId,
      actor_id: params.actorId,
      target_user_id: params.targetUserId ?? null,
      action: params.action,
      details: params.details ?? null,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listGroupReports(groupId: number) {
  const { data, error } = await supabase
    .from("community_group_reports")
    .select(
      "id, group_id, reporter_id, target_user_id, post_id, comment_id, reason, status, created_at"
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: number;
    group_id: number;
    reporter_id: string | null;
    target_user_id: string | null;
    post_id: number | null;
    comment_id: number | null;
    reason: string;
    status: "open" | "reviewing" | "resolved" | "dismissed";
    created_at: string;
  }>;
}

export async function updateGroupReportStatus(params: {
  reportId: number;
  status: "reviewing" | "resolved" | "dismissed";
}) {
  const { data, error } = await supabase
    .from("community_group_reports")
    .update({ status: params.status, resolved_at: new Date().toISOString() })
    .eq("id", params.reportId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGroupReportById(reportId: number) {
  const { data, error } = await supabase
    .from("community_group_reports")
    .select(
      "id, group_id, reporter_id, target_user_id, post_id, comment_id, reason, status, created_at, resolved_at"
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: number;
    group_id: number;
    reporter_id: string | null;
    target_user_id: string | null;
    post_id: number | null;
    comment_id: number | null;
    reason: string;
    status: "open" | "reviewing" | "resolved" | "dismissed";
    created_at: string;
    resolved_at: string | null;
  } | null;
}

export async function getGroupPostById(postId: number) {
  const { data, error } = await supabase
    .from("community_group_posts")
    .select("id, group_id, author_id, body, created_at")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: number;
    group_id: number;
    author_id: string | null;
    body: string | null;
    created_at: string;
  } | null;
}

export async function getGroupCommentById(commentId: number) {
  const { data, error } = await supabase
    .from("community_group_post_comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: number;
    post_id: number;
    author_id: string | null;
    body: string;
    created_at: string;
  } | null;
}

export async function listGroupAuditLogs(groupId: number) {
  const { data, error } = await supabase
    .from("community_group_audit_logs")
    .select("id, group_id, actor_id, target_user_id, action, details, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: number;
    group_id: number;
    actor_id: string | null;
    target_user_id: string | null;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
}

export async function deleteGroupPost(postId: number) {
  const { error } = await supabase.from("community_group_posts").delete().eq("id", postId);
  if (error) throw error;
}

const GROUP_MEDIA_BUCKET = "group-media";

export async function uploadGroupImage(params: {
  groupId: number;
  uri: string;
  kind: "cover" | "avatar";
  mimeType?: string;
}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Configuration Supabase manquante.");
  }
  const contentType = params.mimeType ?? "image/jpeg";
  const extension = contentType.includes("png") ? "png" : "jpg";
  const path = `groups/${params.groupId}/${params.kind}/${Date.now()}.${extension}`;
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token ?? null;
  if (!accessToken) {
    throw new Error("Session expirée. Reconnecte-toi.");
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${GROUP_MEDIA_BUCKET}/${path}`;
  const uploadResult = await FileSystem.uploadAsync(uploadUrl, params.uri, {
    httpMethod: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Upload échoué (${uploadResult.status}). ${uploadResult.body}`);
  }

  const { data } = supabase.storage.from(GROUP_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadGroupMedia(params: {
  groupId: number;
  postId: number;
  uri: string;
  mediaType: "image" | "video";
  mimeType?: string;
}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Configuration Supabase manquante.");
  }
  const contentType =
    params.mimeType ??
    (params.mediaType === "video" ? "video/mp4" : "image/jpeg");
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("heic")
      ? "heic"
      : contentType.includes("heif")
        ? "heif"
        : contentType.includes("webp")
          ? "webp"
          : contentType.includes("quicktime")
            ? "mov"
          : contentType.includes("mov")
            ? "mov"
            : contentType.includes("mp4")
              ? "mp4"
              : "jpg";
  const path = `groups/${params.groupId}/posts/${params.postId}/${Date.now()}.${extension}`;
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token ?? null;
  if (!accessToken) {
    throw new Error("Session expirée. Reconnecte-toi.");
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${GROUP_MEDIA_BUCKET}/${path}`;
  const uploadResult = await FileSystem.uploadAsync(uploadUrl, params.uri, {
    httpMethod: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Upload échoué (${uploadResult.status}). ${uploadResult.body}`);
  }

  const { data } = supabase.storage.from(GROUP_MEDIA_BUCKET).getPublicUrl(path);
  const { data: mediaRow, error } = await supabase
    .from("community_group_post_media")
    .insert({
      post_id: params.postId,
      url: data.publicUrl,
      media_type: params.mediaType,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return mediaRow as GroupPostMedia | null;
}

export async function likeGroupPost(postId: number, userId: string) {
  const { data, error } = await supabase
    .from("community_group_post_likes")
    .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function unlikeGroupPost(postId: number, userId: string) {
  const { error } = await supabase
    .from("community_group_post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function listPostLikes(postIds: number[]) {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("community_group_post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);
  if (error) throw error;
  return (data ?? []) as { post_id: number; user_id: string }[];
}

export async function listPostComments(postId: number) {
  const { data, error } = await supabase
    .from("community_group_post_comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GroupPostComment[];
}

export async function listPostCommentCounts(postIds: number[]) {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("community_group_post_comments")
    .select("id, post_id")
    .in("post_id", postIds);
  if (error) throw error;
  return (data ?? []) as { id: number; post_id: number }[];
}

export async function likePostComment(commentId: number, userId: string) {
  const { error } = await supabase
    .from("community_group_post_comment_likes")
    .upsert({ comment_id: commentId, user_id: userId }, { onConflict: "comment_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function unlikePostComment(commentId: number, userId: string) {
  const { error } = await supabase
    .from("community_group_post_comment_likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listCommentLikes(commentIds: number[]) {
  if (commentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("community_group_post_comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);
  if (error) throw error;
  return (data ?? []) as { comment_id: number; user_id: string }[];
}

export async function createPostComment(postId: number, userId: string, body: string) {
  const { data, error } = await supabase
    .from("community_group_post_comments")
    .insert({
      post_id: postId,
      author_id: userId,
      body: body.trim(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as GroupPostComment | null;
}

