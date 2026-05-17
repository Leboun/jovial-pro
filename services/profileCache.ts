export type ProfileCacheEntry = {
  profile: {
    user_id: string;
    handle: string | null;
    firstname: string | null;
    lastname: string | null;
    bio: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
  favorites: {
    id: number;
    name: string;
    city: string | null;
    address: string | null;
    cover_url: string | null;
  }[];
  rsvps: {
    id: number;
    status: "interested" | "going";
    event: {
      id: number;
      title: string;
      starts_at: string;
      cover_url: string | null;
    };
  }[];
  updatedAt?: number;
};

const profileCache = new Map<string, ProfileCacheEntry>();

export function getProfileCache(userId: string | null) {
  if (!userId) return null;
  return profileCache.get(userId) ?? null;
}

export function setProfileCache(userId: string, entry: ProfileCacheEntry) {
  profileCache.set(userId, { ...entry, updatedAt: Date.now() });
}
