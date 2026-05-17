export type GroupCacheEntry = {
  id: number;
  name?: string | null;
  description?: string | null;
  visibility?: "public" | "private" | null;
  post_permission?: "members" | "admins" | null;
  cover_image_url?: string | null;
  avatar_image_url?: string | null;
  serverUpdatedAt?: string | null;
  updatedAt?: number;
};

const groupCache = new Map<number, GroupCacheEntry>();

export function getGroupCache(groupId: number) {
  return groupCache.get(groupId) ?? null;
}

export function setGroupCache(entry: GroupCacheEntry) {
  groupCache.set(entry.id, { ...entry, updatedAt: Date.now() });
}

export function patchGroupCache(groupId: number, patch: Partial<GroupCacheEntry>) {
  const current = groupCache.get(groupId) ?? { id: groupId };
  groupCache.set(groupId, { ...current, ...patch, updatedAt: Date.now() });
}
