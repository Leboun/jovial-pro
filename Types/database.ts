export type Venue = {
    id: number;
    created_at: string;
    created_by: string | null;
    name: string;
    description: string | null;
    address: string | null;
    postcode: string | null;
    city: string | null;
    contact: string | null;
    website_url: string | null;
    instagram_url: string | null;
    booking_external_url: string | null;
    location: any | null;
    cover_url: string | null;
    photos: string[] | null;
    opening_hours: Record<string, { open: string; close: string }[]> | null;
    timezone: string | null;
  
    // 🔥 Ajout indispensable
    lat: number | null;
    lng: number | null;
  };
  
