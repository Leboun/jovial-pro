export type ExploreCacheEntry = {
  venues: {
    id: number;
    name: string;
    city: string;
    address?: string | null;
    postcode?: string | null;
    createdAt?: string | null;
    lat?: number | null;
    lng?: number | null;
    coverUrl?: string | null;
    photos: string[];
    openingHours?: any;
    timezone?: string | null;
    activities: string[];
    tags: string[];
    hasBooking: boolean;
  }[];
  events: {
    id: number;
    title: string;
    startsAt: string;
    coverUrl?: string | null;
    venueName: string;
    venueCity: string;
    categoryId?: number | null;
    categoryName?: string | null;
  }[];
  games: { id: number; name: string }[];
  tags: { id: number; name: string }[];
  fingerprint?: string | null;
  updatedAt?: number;
};

let exploreCache: ExploreCacheEntry | null = null;

export function getExploreCache() {
  return exploreCache;
}

export function setExploreCache(entry: ExploreCacheEntry) {
  exploreCache = { ...entry, updatedAt: Date.now() };
}
