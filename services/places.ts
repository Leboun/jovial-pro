type PlaceAddress = Record<string, string | undefined>;

export type PlaceResult = {
  place_id: string;
  label: string;
  display_name?: string | null;
  address_line?: string | null;
  postcode?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
};

const USER_AGENT = "JovialApp/1.0";

const getCity = (address?: PlaceAddress) =>
  address?.city ||
  address?.town ||
  address?.village ||
  address?.municipality ||
  address?.hamlet ||
  null;

const getStreet = (address?: PlaceAddress) =>
  address?.road ||
  address?.pedestrian ||
  address?.footway ||
  address?.residential ||
  address?.cycleway ||
  address?.path ||
  address?.neighbourhood ||
  address?.suburb ||
  null;

const buildAddressLine = (address?: PlaceAddress) => {
  if (!address) return null;
  const venue =
    address.amenity || address.shop || address.tourism || address.leisure || null;
  const houseNumber = address.house_number || "";
  const street = getStreet(address) || "";
  const numberedStreet = [houseNumber, street].filter(Boolean).join(" ").trim();
  if (venue && numberedStreet) return `${venue}, ${numberedStreet}`;
  return venue || numberedStreet || null;
};

const buildLabel = (address?: PlaceAddress) => {
  if (!address) return "";
  const city = getCity(address) || "";
  const department =
    address.state || address.county || address.state_district || address.region || "";
  const country = address.country || "";
  const parts = [city, department, country].filter(Boolean);
  return parts.join(" - ");
};

export async function searchPlaces(query: string, limit = 6, signal?: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, {
    signal,
    headers: {
      "Accept-Language": "fr",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return [] as PlaceResult[];
  const data = (await res.json()) as {
    place_id?: number | string;
    address?: PlaceAddress;
    display_name?: string;
    lat?: string | number;
    lon?: string | number;
  }[];
  return data
    .map((item) => {
      const id = item.place_id ? String(item.place_id) : "";
      if (!id) return null;
      const label = buildLabel(item.address) || item.display_name || "";
      const lat = item.lat !== undefined ? Number(item.lat) : null;
      const lon = item.lon !== undefined ? Number(item.lon) : null;
      return {
        place_id: id,
        label,
        display_name: item.display_name || null,
        address_line: buildAddressLine(item.address),
        postcode: item.address?.postcode || null,
        city: getCity(item.address),
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
      };
    })
    .filter(Boolean) as PlaceResult[];
}

export async function lookupPlaces(placeIds: string[]) {
  if (placeIds.length === 0) return {} as Record<string, string>;
  const url = `https://nominatim.openstreetmap.org/lookup?format=jsonv2&addressdetails=1&place_id=${placeIds.join(
    ","
  )}`;
  const res = await fetch(url, {
    headers: {
      "Accept-Language": "fr",
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) return {} as Record<string, string>;
  const data = (await res.json()) as {
    place_id?: number | string;
    address?: PlaceAddress;
    display_name?: string;
  }[];
  const map: Record<string, string> = {};
  data.forEach((item) => {
    const id = item.place_id ? String(item.place_id) : null;
    if (!id) return;
    const label = buildLabel(item.address) || item.display_name || "";
    map[id] = label;
  });
  return map;
}
