export type MapCacheEntry = {
  venues: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    cover_url?: string | null;
    tags?: string[];
    activities?: string[];
    address?: string | null;
    city?: string | null;
    opening_hours?: any;
    timezone?: string | null;
    hasBooking?: boolean;
  }[];
  fingerprint?: string | null;
  updatedAt?: number;
};

let mapCache: MapCacheEntry | null = null;

export function getMapCache() {
  return mapCache;
}

export function setMapCache(entry: MapCacheEntry) {
  mapCache = { ...entry, updatedAt: Date.now() };
}
