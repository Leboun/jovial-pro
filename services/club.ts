import { supabase } from "./supabase";
import { pickAndPrepareImage, uploadImage } from "./establishment";

export type Club = {
  id: number;
  venue_id: number;
  name: string;
  description: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  is_private: boolean;
  allow_member_posts: boolean;
  allow_member_comments: boolean;
  require_post_approval: boolean;
  member_count: number;
  post_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClubPost = {
  id: number;
  club_id: number;
  author_venue_id: number | null;
  author_user_id: string | null;
  content: string;
  photo_urls: string[];
  event_id: number | null;
  is_pinned: boolean;
  is_approved: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  shared_event: {
    id: number;
    title: string;
    starts_at: string;
    cover_url: string | null;
  } | null;
};

export type ClubComment = {
  id: number;
  post_id: number;
  author_venue_id: number | null;
  author_user_id: string | null;
  content: string;
  created_at: string;
};

// ─── Club CRUD ────────────────────────────────────────────────────────────────

export async function getClubByVenue(venueId: number): Promise<Club | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createClub(input: {
  venue_id: number;
  name: string;
  description?: string | null;
  is_private?: boolean;
}): Promise<Club> {
  const { data, error } = await supabase
    .from("clubs")
    .insert({
      venue_id: input.venue_id,
      name: input.name,
      description: input.description ?? null,
      is_private: input.is_private ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClub(
  clubId: number,
  patch: Partial<
    Pick<
      Club,
      | "name"
      | "description"
      | "profile_photo_url"
      | "cover_photo_url"
      | "is_private"
      | "allow_member_posts"
      | "allow_member_comments"
      | "require_post_approval"
      | "is_active"
    >
  >
): Promise<Club> {
  const { data, error } = await supabase
    .from("clubs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", clubId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Club photo uploads ───────────────────────────────────────────────────────

const CLUB_BUCKET = "establishment-media";

export async function uploadClubProfilePhoto(venueId: number): Promise<string | null> {
  const image = await pickAndPrepareImage({ targetWidth: 400, quality: 0.85 });
  if (!image) return null;
  return uploadImage({
    bucket: CLUB_BUCKET,
    path: `${venueId}/club/profile.${image.extension}`,
    uri: image.uri,
    contentType: image.contentType,
  });
}

export async function uploadClubCoverPhoto(venueId: number): Promise<string | null> {
  const image = await pickAndPrepareImage({ targetWidth: 1800, quality: 0.88 });
  if (!image) return null;
  return uploadImage({
    bucket: CLUB_BUCKET,
    path: `${venueId}/club/cover.${image.extension}`,
    uri: image.uri,
    contentType: image.contentType,
  });
}

export async function uploadPostPhoto(venueId: number): Promise<string | null> {
  const image = await pickAndPrepareImage({ targetWidth: 1200, quality: 0.85 });
  if (!image) return null;
  return uploadImage({
    bucket: CLUB_BUCKET,
    path: `${venueId}/club/posts/${Date.now()}.${image.extension}`,
    uri: image.uri,
    contentType: image.contentType,
  });
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function listClubPosts(clubId: number): Promise<ClubPost[]> {
  const { data, error } = await supabase
    .from("club_posts")
    .select("*, shared_event:events(id, title, starts_at, cover_url)")
    .eq("club_id", clubId)
    .eq("is_approved", true)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(normalizePost);
}

export async function listPendingPosts(clubId: number): Promise<ClubPost[]> {
  const { data, error } = await supabase
    .from("club_posts")
    .select("*, shared_event:events(id, title, starts_at, cover_url)")
    .eq("club_id", clubId)
    .eq("is_approved", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizePost);
}

function normalizePost(row: any): ClubPost {
  const ev = row.shared_event;
  return {
    ...row,
    shared_event: Array.isArray(ev) ? (ev[0] ?? null) : ev ?? null,
  };
}

export async function createPost(input: {
  club_id: number;
  author_venue_id: number;
  content: string;
  photo_urls?: string[];
  event_id?: number | null;
}): Promise<ClubPost> {
  const { data, error } = await supabase
    .from("club_posts")
    .insert({
      club_id: input.club_id,
      author_venue_id: input.author_venue_id,
      content: input.content,
      photo_urls: input.photo_urls ?? [],
      event_id: input.event_id ?? null,
    })
    .select("*, shared_event:events(id, title, starts_at, cover_url)")
    .single();
  if (error) throw error;
  return normalizePost(data);
}

export async function togglePinPost(postId: number, isPinned: boolean): Promise<void> {
  const { error } = await supabase
    .from("club_posts")
    .update({ is_pinned: isPinned })
    .eq("id", postId);
  if (error) throw error;
}

export async function approvePost(postId: number): Promise<void> {
  const { error } = await supabase
    .from("club_posts")
    .update({ is_approved: true })
    .eq("id", postId);
  if (error) throw error;
}

export async function deletePost(postId: number): Promise<void> {
  const { error } = await supabase.from("club_posts").delete().eq("id", postId);
  if (error) throw error;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function listPostComments(postId: number): Promise<ClubComment[]> {
  const { data, error } = await supabase
    .from("club_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createComment(input: {
  post_id: number;
  author_venue_id: number;
  content: string;
}): Promise<ClubComment> {
  const { data, error } = await supabase
    .from("club_comments")
    .insert({
      post_id: input.post_id,
      author_venue_id: input.author_venue_id,
      content: input.content,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId: number): Promise<void> {
  const { error } = await supabase.from("club_comments").delete().eq("id", commentId);
  if (error) throw error;
}
