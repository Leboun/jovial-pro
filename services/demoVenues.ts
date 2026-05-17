import type { OpeningHours } from "@/utils/openingHours";

export type DemoVenue = {
  id: string;
  name: string;
  city: string;
  address: string;
  postcode: string;
  contact: string | null;
  lat: number;
  lng: number;
  cover_url: string | null;
  photos: string[];
  tags: string[];
  activities: string[];
  opening_hours: OpeningHours;
  timezone: string;
  social_platform: "instagram" | "facebook" | null;
  social_url: string | null;
  hasEvents?: boolean;
  isDemo: true;
};

const WEEKDAY_HOURS: OpeningHours = {
  mon: [{ open: "17:00", close: "00:00" }],
  tue: [{ open: "17:00", close: "00:00" }],
  wed: [{ open: "17:00", close: "00:30" }],
  thu: [{ open: "17:00", close: "00:30" }],
  fri: [{ open: "16:00", close: "01:30" }],
  sat: [{ open: "15:00", close: "01:30" }],
  sun: [{ open: "15:00", close: "22:30" }],
};

const LATE_HOURS: OpeningHours = {
  mon: [{ open: "18:00", close: "00:00" }],
  tue: [{ open: "18:00", close: "00:00" }],
  wed: [{ open: "18:00", close: "00:30" }],
  thu: [{ open: "18:00", close: "00:30" }],
  fri: [{ open: "17:00", close: "02:00" }],
  sat: [{ open: "16:00", close: "02:00" }],
  sun: [{ open: "16:00", close: "22:30" }],
};

const DEMO_VENUES: DemoVenue[] = [
  {
    id: "demo-cale-dards",
    name: "La Cale aux Dards",
    city: "Saint-Brieuc",
    address: "12 quai des Arcades",
    postcode: "22000",
    contact: "02 96 00 12 12",
    lat: 48.5142,
    lng: -2.7651,
    cover_url: "https://picsum.photos/seed/demo-cale-dards-cover/1200/900",
    photos: [
      "https://picsum.photos/seed/demo-cale-dards-1/1200/900",
      "https://picsum.photos/seed/demo-cale-dards-2/1200/900",
      "https://picsum.photos/seed/demo-cale-dards-3/1200/900",
    ],
    tags: ["Bar de quartier", "Tournois", "Ambiance simple"],
    activities: ["Flechettes", "Jeux de societe"],
    opening_hours: WEEKDAY_HOURS,
    timezone: "Europe/Paris",
    social_platform: "instagram",
    social_url: "jovial.demo.caledards",
    isDemo: true,
  },
  {
    id: "demo-palet-malt",
    name: "Palet & Malt",
    city: "Saint-Brieuc",
    address: "4 rue Saint-Guillaume",
    postcode: "22000",
    contact: "02 96 00 24 24",
    lat: 48.5126,
    lng: -2.7588,
    cover_url: "https://picsum.photos/seed/demo-palet-malt-cover/1200/900",
    photos: [
      "https://picsum.photos/seed/demo-palet-malt-1/1200/900",
      "https://picsum.photos/seed/demo-palet-malt-2/1200/900",
    ],
    tags: ["Bar jeux", "Comptoir breton", "Afterwork"],
    activities: ["Palet breton", "Billard"],
    opening_hours: LATE_HOURS,
    timezone: "Europe/Paris",
    social_platform: "facebook",
    social_url: "jovial.demo.paletmalt",
    isDemo: true,
  },
  {
    id: "demo-meeples",
    name: "La Table des Meeples",
    city: "Saint-Brieuc",
    address: "9 place du Centre",
    postcode: "22000",
    contact: "02 96 00 33 10",
    lat: 48.5089,
    lng: -2.7607,
    cover_url: "https://picsum.photos/seed/demo-meeples-cover/1200/900",
    photos: [
      "https://picsum.photos/seed/demo-meeples-1/1200/900",
      "https://picsum.photos/seed/demo-meeples-2/1200/900",
    ],
    tags: ["Cafe jeux", "Equipe accueillante", "Petits groupes"],
    activities: ["Jeux de societe", "Blind test"],
    opening_hours: WEEKDAY_HOURS,
    timezone: "Europe/Paris",
    social_platform: "instagram",
    social_url: "jovial.demo.meeples",
    isDemo: true,
  },
  {
    id: "demo-comptoir-baby",
    name: "Le Comptoir du Baby",
    city: "Ploufragan",
    address: "18 avenue des Sports",
    postcode: "22440",
    contact: "02 96 10 20 30",
    lat: 48.4903,
    lng: -2.7935,
    cover_url: "https://picsum.photos/seed/demo-baby-cover/1200/900",
    photos: [
      "https://picsum.photos/seed/demo-baby-1/1200/900",
      "https://picsum.photos/seed/demo-baby-2/1200/900",
    ],
    tags: ["Sports bar", "Grand ecran", "Equipe locale"],
    activities: ["Baby foot", "Flechettes"],
    opening_hours: LATE_HOURS,
    timezone: "Europe/Paris",
    social_platform: "facebook",
    social_url: "jovial.demo.comptoirbaby",
    isDemo: true,
  },
  {
    id: "demo-cercle-22",
    name: "Le Cercle 22",
    city: "Langueux",
    address: "27 boulevard de la Gare",
    postcode: "22360",
    contact: "02 96 18 40 40",
    lat: 48.4957,
    lng: -2.7178,
    cover_url: "https://picsum.photos/seed/demo-cercle-22-cover/1200/900",
    photos: [
      "https://picsum.photos/seed/demo-cercle-22-1/1200/900",
      "https://picsum.photos/seed/demo-cercle-22-2/1200/900",
    ],
    tags: ["Billard club", "Musique live", "Bar tardif"],
    activities: ["Billard", "Cocktails", "Baby foot"],
    opening_hours: LATE_HOURS,
    timezone: "Europe/Paris",
    social_platform: "instagram",
    social_url: "jovial.demo.cercle22",
    isDemo: true,
  },
  {
    id: "demo-remparts",
    name: "L'Echappee des Remparts",
    city: "Tregueux",
    address: "6 rue des Halles",
    postcode: "22950",
    contact: "02 96 32 11 11",
    lat: 48.4934,
    lng: -2.7443,
    cover_url: "https://picsum.photos/seed/demo-remparts-cover/1200/900",
    photos: [
      "https://picsum.photos/seed/demo-remparts-1/1200/900",
      "https://picsum.photos/seed/demo-remparts-2/1200/900",
    ],
    tags: ["Terrasse", "Grandes tables", "Soirees groupes"],
    activities: ["Palet breton", "Jeux de societe", "Baby foot"],
    opening_hours: WEEKDAY_HOURS,
    timezone: "Europe/Paris",
    social_platform: "facebook",
    social_url: "jovial.demo.remparts",
    isDemo: true,
  },
  {
    id: "demo-nuit-blanche",
    name: "La Nuit Blanche",
    city: "Saint-Brieuc",
    address: "3 rue du Gouet",
    postcode: "22000",
    contact: "02 96 44 55 66",
    lat: 48.5167,
    lng: -2.7712,
    cover_url: "https://picsum.photos/seed/demo-nuit-blanche-cover/1200/900",
    photos: [
      "https://picsum.photos/seed/demo-nuit-blanche-1/1200/900",
      "https://picsum.photos/seed/demo-nuit-blanche-2/1200/900",
    ],
    tags: ["Bar lounge", "Soirees DJ", "Concerts"],
    activities: [],
    opening_hours: LATE_HOURS,
    timezone: "Europe/Paris",
    social_platform: "instagram",
    social_url: "jovial.demo.nuitblanche",
    hasEvents: true,
    isDemo: true,
  },
];

const cloneOpeningHours = (openingHours: OpeningHours): OpeningHours =>
  Object.fromEntries(
    Object.entries(openingHours).map(([day, slots]) => [
      day,
      (slots ?? []).map((slot) => ({ ...slot })),
    ])
  );

const cloneDemoVenue = (venue: DemoVenue): DemoVenue => ({
  ...venue,
  photos: [...venue.photos],
  tags: [...venue.tags],
  activities: [...venue.activities],
  opening_hours: cloneOpeningHours(venue.opening_hours),
});

export function getDemoVenues() {
  return DEMO_VENUES.map(cloneDemoVenue);
}

export function findDemoVenueById(id?: string | null) {
  if (!id) return null;
  const match = DEMO_VENUES.find((venue) => venue.id === id);
  return match ? cloneDemoVenue(match) : null;
}
