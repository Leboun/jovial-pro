export type GroupsListCacheEntry = {
  groups: {
    id: number;
    name: string;
    description?: string | null;
    visibility: "public" | "private";
    post_permission?: "members" | "admins" | null;
    cover_image_url?: string | null;
    avatar_image_url?: string | null;
    location_place_id?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    activity_tag?: string | null;
  }[];
  myGroupIds: number[];
  fingerprint?: string | null;
  updatedAt?: number;
};

let groupsListCache: GroupsListCacheEntry | null = null;

export function getGroupsListCache() {
  return groupsListCache;
}

export function setGroupsListCache(entry: GroupsListCacheEntry) {
  groupsListCache = { ...entry, updatedAt: Date.now() };
}
