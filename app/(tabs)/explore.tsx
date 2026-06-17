import React, { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";


import { supabase } from "../../services/supabase";
import { useAuth } from "../../providers/AuthProvider";
import { getOpeningStatus, type OpeningHours } from "../../utils/openingHours";
import { getExploreCache, setExploreCache } from "@/services/exploreCache";
import ExploreBoostBanner from "@/components/ExploreBoostBanner";
import { Pastel } from "@/constants/pastel";
import { useIsPremium } from "@/hooks/useIsPremium";
import { Font } from "@/constants/typography";
import { getActivityEmoji } from "@/utils/activityEmoji";

type VenueRow = {
  id: number;
  name: string;
  city: string | null;
  address?: string | null;
  postcode?: string | null;
  created_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  cover_url?: string | null;
  photos?: string[] | null;
  opening_hours?: OpeningHours | null;
  timezone?: string | null;
  tags?: string[] | null;
  venue_type?: string | null;
  venue_ambiance?: string[] | null;
  service_tags?: string[] | null;
  activities?: string[] | null;
  venue_games?: { games?: { name?: string | null } | null; booking_mode?: string | null }[] | null;
  venue_venue_tags?: { venue_tags?: { name?: string | null } | null }[] | null;
};

type EventRow = {
  id: number;
  title: string;
  starts_at: string;
  cover_url?: string | null;
  venue_id: number;
  category_id?: number | string | null;
  event_categories?: { name?: string | null } | null;
  venues?: { name?: string | null; city?: string | null } | null;
};

type GameRow = {
  id: number;
  name: string;
};

type TagRow = {
  id: number;
  name: string;
};

type ExploreVenue = {
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
  openingHours?: OpeningHours | null;
  timezone?: string | null;
  activities: string[];
  tags: string[];
  venueType?: string | null;
  venueAmbiance?: string[] | null;
  serviceTags?: string[] | null;
  hasBooking: boolean;
  distance?: number | null;
};

type ExploreEvent = {
  id: number;
  title: string;
  startsAt: string;
  coverUrl?: string | null;
  venueName: string;
  venueCity: string;
  categoryId?: number | null;
  categoryName?: string | null;
  venueId?: number | null;
};

type IntentKey = "venues" | "events" | "activities";

type MoodKey = "drinks" | "food" | "fun" | "vibe" | "chill";

const MOODS = [
  { key: "drinks" as MoodKey, emoji: "🍻", label: "Boire un verre" },
  { key: "food"   as MoodKey, emoji: "🍜", label: "Manger" },
  { key: "fun"    as MoodKey, emoji: "🎯", label: "S'amuser" },
  { key: "vibe"   as MoodKey, emoji: "🎶", label: "Ambiance" },
  { key: "chill"  as MoodKey, emoji: "💬", label: "Chill" },
];

type IntentTab = {
  key: IntentKey;
  label: string;
  icon: string;
  iconActive: string;
  lib?: "ion" | "mci";
};

type EventCategory = {
  id: number;
  title: string;
  emoji: string;
  items: string[];
};

const intentTabs: IntentTab[] = [
  {
    key: "venues",
    label: "Lieux",
    icon: "location-outline",
    iconActive: "location",
  },
  {
    key: "events",
    label: "Événements",
    icon: "calendar-outline",
    iconActive: "calendar",
  },
  {
    key: "activities",
    label: "Activités",
    icon: "bullseye-arrow",
    iconActive: "bullseye-arrow",
    lib: "mci",
  },
];

const eventCategories: EventCategory[] = [
  {
    id: 1,
    title: "Musique",
    emoji: "",
    items: [
      "Concert live",
      "Jam sessions",
      "DJ set",
      "Open mic",
      "Karaoke",
      "Apéros musicaux",
      "Showcase",
    ],
  },
  {
    id: 2,
    title: "Scène & Parole",
    emoji: "",
    items: [
      "Stand-up",
      "Comedy Club",
      "Slam / Poésie",
      "Théâtre",
      "Théâtre d'impro",
      "Café-théâtre",
      "Lecture publique",
      "Conte",
      "Prise de parole citoyenne",
      "Conférence",
      "Débat public",
      "Cercle de discussion",
    ],
  },
  {
    id: 3,
    title: "Jeux",
    emoji: "",
    items: [
      "Blind test",
      "Loto",
      "Bingo",
      "Soirée jeux de société",
      "Jeux de rôle",
      "Escape game",
      "Quiz",
      "Tournoi",
      "Loup-Garou",
    ],
  },
  {
    id: 4,
    title: "Gastronomie & Boissons",
    emoji: "",
    items: [
      "Dégustations",
      "Ateliers cocktail / mocktail",
      "Soirée à thème culinaire",
      "Apéros producteurs",
      "Invités chefs / brasseurs",
      "Pop-up food",
      "Brunch",
      "Brunch animé",
    ],
  },
  {
    id: 5,
    title: "Société & Engagement",
    emoji: "",
    items: [
      "Rencontres associatives",
      "Café citoyen",
      "Cafés philo",
      "Soirée solidaire",
      "Événements caritatifs",
      "Projection documentaire",
      "Assemblée de quartier",
    ],
  },
  {
    id: 6,
    title: "Numérique & Innovation",
    emoji: "",
    items: [
      "Atelier Numérique",
      "Jeux vidéo",
      "Coding",
      "Repair café",
      "Atelier DIY / Low tech",
      "Présentation de projets",
      "Pitch de startups",
      "Découverte de métiers",
    ],
  },
  {
    id: 7,
    title: "Bien-être",
    emoji: "",
    items: [
      "Yoga",
      "Yoga du rire",
      "Méditation",
      "Sophrologie",
      "Atelier respiration",
      "Cercle de parole",
      "Massage",
    ],
  },
  {
    id: 8,
    title: "Inclusivité & Communautés",
    emoji: "",
    items: [
      "Soirée LGBTQIA+",
      "Rencontre interculturelle",
      "Rencontre multilingue",
      "Café linguistique",
      "Soirée nouveaux arrivants",
      "Speed meeting / dating",
      "Job dating",
      "Soirée féministe / Queer / Safe space",
      "Drag Show",
      "Rencontre intergénérationnelle",
    ],
  },
  {
    id: 9,
    title: "Festif",
    emoji: "",
    items: [
      "Soirée à thème",
      "Soirée Casino",
      "Saint-Patrick",
      "Fête de la musique",
      "14 Juillet",
      "Nouvel An",
      "Saint-Valentin",
      "Halloween",
      "Noël",
      "Soirée déguisée",
      "Anniversaire",
      "Afterwork",
      "Soirée dansante",
      "Fête de village",
    ],
  },
  {
    id: 10,
    title: "Sport & Retransmissions sportives",
    emoji: "",
    items: ["Diffusion matchs / Événements sportifs"],
  },
  {
    id: 11,
    title: "Autres",
    emoji: "",
    items: [
      "Expositions",
      "Vernissage",
      "Live painting",
      "Atelier(s) créatif(s)",
      "Fresque collaborative",
      "Performance artistique",
      "Projection court-métrage",
      "Ciné-débat",
      "Soirée créateurs locaux",
    ],
  },
];


const radiusOptions = [2, 5, 10, 20];

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80";

function isHttpUrlString(v: string) {
  return /^https?:\/\//i.test(v.trim());
}

const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const normalizeActivityLabel = (value: string) => normalizeSearchValue(value);

const hasQueryMatch = (value: string, query: string) =>
  normalizeSearchValue(value).includes(normalizeSearchValue(query));

const preferredActivities = [
  "Fléchettes",
  "Palet breton",
  "Jeux de société",
  "Baby foot",
  "Billard",
];
const compactPreferredActivities = preferredActivities;
const compactPreferredActivitiesBretagne = preferredActivities;

const venueTypeOptions = [
  "🍺 Bar à bière",
  "🏆 Sports bar",
  "🍻 Pub",
  "🏘️ Bar de village",
  "🎯 Bar à fléchettes",
  "🎲 Bar à jeux",
  "🍸 Bar",
  "☕ Café",
  "🍽️ Restaurant",
  "🏢 Tiers-lieu",
  "🎉 Complexe de loisirs",
  "🐱 Bar à chats & chiens",
  "🍷 Bar à vin",
  "🍹 Cocktail bar",
  "🥂 Bar à champagne",
  "🫒 Bar à tapas",
  "💃 Bar dansant",
  "🕵️ Speakeasy",
  "🏙️ Bar Rooftop",
  "🍻 Micro-brasserie",
  "🎵 Piano bar",
  "🎷 Jazz bar",
  "🌿 Guinguette",
  "🧀 Bar à fromages",
  "🦪 Bar à huîtres",
  "🪓 Bar à haches",
  "🎳 Bowling",
  "🎤 Karaoké",
  "🕺 Club / Discothèque",
  "🎮 Salle d'arcade",
  "🎱 Salle de billard",
  "🏖️ Beach bar",
  "🍵 Salon de thé",
  "🍔 Bar-restaurant",
  "🍕 Bar à pizzas",
  "🥃 Whisky bar",
  "🧉 Bar à cocktails sans alcool",
  "💨 Bar à chicha",
  "🎪 Bar éphémère (pop-up)",
  "🏨 Bar d'hôtel",
  "🎠 Parc de loisirs",
];

const venueAmbianceOptions = [
  "🧘 Calme",
  "🤗 Convivial",
  "🎊 Festif",
  "👨‍👩‍👧 Familial",
  "🔥 Animé",
  "🏆 Compétitif",
  "🎯 Ludique",
  "🌙 Nocturne",
  "📚 Studieux",
  "🛋️ Cosy",
  "💑 Romantique",
  "✨ Branché",
  "😎 Décontracté",
  "👔 Afterwork",
  "👯 Soirée entre amis",
  "🎸 Musique live",
  "🎧 DJ set",
  "🎤 Karaoké",
  "🧠 Quiz / Blind test",
  "🥇 Tournoi",
  "🎭 Soirée à thème",
  "🎩 Chic",
  "🕰️ Rétro / Vintage",
  "🌸 Bohème",
  "🌍 Multiculturel",
  "🏳️‍🌈 LGBTQIA+ friendly",
  "🌱 Éco-responsable",
  "🐾 Pet-friendly",
  "🚀 Startup / Créatif",
  "🎶 Open mic",
  "🌄 Vue panoramique",
  "🪴 Intimiste",
  "💥 Grosse ambiance",
  "🕺 Dansant",
  "🤝 Mixte / Tout public",
  "🧑‍🎓 Jeunes / Étudiants",
  "🍻 Bière artisanale",
  "🎉 Célébration / Anniversaire",
  "🌺 Terrasse",
];

const venueServiceOptions = [
  "📶 Wi-Fi",
  "🔌 Prises",
  "♿ Accès PMR",
  "🅿️ Parking",
  "📖 Réservation",
  "🔒 Privatisable",
  "🍹 Happy Hour",
  "🌿 Terrasse",
  "🌳 Jardin",
  "🌄 Vue",
  "🐾 Pet-friendly",
  "🏳️‍🌈 LGBTQIA+ friendly",
  "🍽️ Restauration",
  "📺 Retransmission sportive",
  "🎮 Jeux à disposition",
  "🎲 Ludothèque",
  "🎂 Anniversaires & privatisations",
  "🎤 Scène",
  "🎬 Projection / Cinéma",
  "📡 Streaming / Esports",
  "🌱 Options végétariennes",
  "🛋️ Espace lounge",
  "🚿 Douches",
  "🏕️ Hébergement",
  "🔋 Borne de recharge électrique",
  "🎨 Ateliers & workshops",
];

const venueTypeKeys = venueTypeOptions.map((type) => ({
  label: type,
  key: normalizeSearchValue(type),
}));

const getVenueTypeLabel = (venue: ExploreVenue) => {
  if (venue.venueType) return venue.venueType;

  const match = venue.tags
    .map((tag) => ({ label: tag, key: normalizeSearchValue(tag) }))
    .find((tag) => venueTypeKeys.some((type) => type.key === tag.key));

  if (match) {
    const option = venueTypeKeys.find((type) => type.key === match.key);
    return option?.label ?? match.label;
  }

  return venue.tags[0] ?? "";
};

const findPreferredMatch = (preferred: string, activities: string[]) => {
  const preferredKey = normalizeActivityLabel(preferred);
  return activities.find((activity) =>
    normalizeActivityLabel(activity).includes(preferredKey)
  );
};

const findOrderKey = (activity: string, preferred: string[]) => {
  const activityKey = normalizeActivityLabel(activity);
  const matched = preferred.find((item) =>
    activityKey.includes(normalizeActivityLabel(item))
  );
  return matched ? normalizeActivityLabel(matched) : activityKey;
};

const buildActivityOrder = (isBretagne: boolean) => {
  const base = [...preferredActivities];
  if (isBretagne) {
    const paletKey = normalizeActivityLabel("Palet breton");
    const index = base.findIndex(
      (item) => normalizeActivityLabel(item) === paletKey
    );
    if (index > 1) {
      const [palet] = base.splice(index, 1);
      base.splice(1, 0, palet);
    }
  }
  return base;
};

// getActivityEmoji est centralise dans "@/utils/activityEmoji" (importe en haut).

const getEventCategoryEmoji = (label: string) => {
  const key = normalizeSearchValue(label);
  const map: Record<string, string> = {
    musique: "🎵",
    sceneparole: "🎤",
    jeux: "🎲",
    gastronomieboissons: "🍷",
    societeengagement: "🤝",
    numeriqueinnovation: "💻",
    bienetre: "🧘",
    inclusivitecommunautes: "🌈",
    festif: "🎉",
    sportretransmissionssportives: "🏟️",
    autres: "✨",
  };
  return map[key] ?? "✨";
};

const getActivityHeroCopy = (activity: string | null) => {
  if (!activity) {
    return {
      title: "Choisis d'abord ce que tu veux faire",
      text: "Fléchettes, palets, billard, blind test, jeux... pars d'une envie réelle, puis choisis le lieu.",
      nearbyTitle: "Autour de toi pour jouer",
      resultsTitle: "Établissements correspondants",
    };
  }

  const key = normalizeActivityLabel(activity);
  const map: Record<string, { title: string; text: string; nearbyTitle: string; resultsTitle: string }> = {
    flechettes: {
      title: "Les meilleurs spots pour lancer quelques fléchettes",
      text: "Retrouve les établissements où l'on joue vraiment, avec une ambiance propice à la partie comme à l'afterwork.",
      nearbyTitle: "Autour de toi pour les fléchettes",
      resultsTitle: "Où jouer aux fléchettes",
    },
    paletbreton: {
      title: "Où sortir pour une vraie partie de palet breton",
      text: "Repère les lieux où le palet fait partie de l'ambiance, des habitudes et parfois même de la compétition.",
      nearbyTitle: "Autour de toi pour le palet breton",
      resultsTitle: "Où jouer au palet breton",
    },
    jeuxdesociete: {
      title: "Les bonnes adresses pour jouer sans regarder l'heure",
      text: "Bars à jeux, lieux conviviaux et tables prêtes à accueillir une partie entre amis.",
      nearbyTitle: "Autour de toi pour les jeux de société",
      resultsTitle: "Où jouer aux jeux de société",
    },
    babyfoot: {
      title: "Les lieux où le baby foot se joue pour de vrai",
      text: "Trouve les établissements et spots où l'on vient autant pour l'ambiance que pour la revanche.",
      nearbyTitle: "Autour de toi pour le baby foot",
      resultsTitle: "Où jouer au baby foot",
    },
    billard: {
      title: "Les meilleures adresses pour sortir jouer au billard",
      text: "Tables disponibles, ambiance adaptée et lieux où l'on vient pour enchaîner les parties.",
      nearbyTitle: "Autour de toi pour le billard",
      resultsTitle: "Où jouer au billard",
    },
  };

  return (
    map[key] ?? {
      title: `Les meilleurs endroits pour pratiquer ${activity}`,
      text: "On te montre les lieux les plus pertinents pour cette activité, avec les bons signaux pour choisir vite.",
      nearbyTitle: `Autour de toi pour ${activity}`,
      resultsTitle: `Où pratiquer ${activity}`,
    }
  );
};

const getEventHeroCopy = (categoryTitle: string | null, hasDate: boolean) => {
  const baseText = hasDate
    ? "On te montre les événements qui correspondent à la date que tu as choisie."
    : "Repère rapidement les sorties, temps forts et rendez-vous à ne pas manquer.";

  if (!categoryTitle) {
    return {
      title: "Qu'est-ce qu'il se passe bientôt ?",
      text: baseText,
      spotlightTitle: hasDate ? "Temps forts de ta date" : "À ne pas manquer",
      listTitle: "Tous les événements",
    };
  }

  const map: Record<string, { title: string; text: string; listTitle: string }> = {
    "Sport & Retransmissions sportives": {
      title: "Les rendez-vous sport à ne pas rater",
      text: hasDate
        ? "Compétitions, retransmissions et moments de ferveur sportive sélectionnés pour ta date."
        : "Matchs, tournois, retransmissions et rendez-vous sportifs à vivre entre passionnés.",
      listTitle: "Les prochains rendez-vous sport",
    },
    Musique: {
      title: "Les sorties musicales qui méritent le détour",
      text: hasDate
        ? "Concerts, showcases et soirées musicales prévus pour la date que tu as choisie."
        : "Concerts, sets et ambiances musicales pour sortir avec une vraie bonne raison.",
      listTitle: "Les prochains événements musicaux",
    },
    Jeux: {
      title: "Les soirées jeux à vivre entre amis",
      text: hasDate
        ? "Quiz, blind test, tournois et soirées ludiques prévus pour ta date."
        : "Blind test, quiz, tournois ou jeux de société : de quoi trouver une sortie qui bouge vraiment.",
      listTitle: "Les prochains événements jeux",
    },
    "Scène & Parole": {
      title: "Les soirées où la scène prend la parole",
      text: hasDate
        ? "Stand-up, théâtre, slam et prises de parole repérés pour la date que tu as choisie."
        : "Stand-up, théâtre, slam, débats et scènes ouvertes pour sortir autrement.",
      listTitle: "Les prochains rendez-vous scène & parole",
    },
  };

  const entry = map[categoryTitle];
  return {
    title: entry?.title ?? categoryTitle,
    text: entry?.text ?? baseText,
    spotlightTitle: hasDate ? "Temps forts de ta date" : "À ne pas manquer",
    listTitle: entry?.listTitle ?? `${categoryTitle} à venir`,
  };
};

const getVenueHeroCopy = (venueType: string | null, city: string | null) => {
  if (!venueType) {
    return {
      title: "Quel type de lieu cherches-tu ?",
      text: city
        ? `On cherche les lieux qui correspondent à ${city}.`
        : "Bar à bière, sports bar, pub, bar à fléchettes ou bar à jeux... choisis un type de lieu puis affine si besoin.",
    };
  }

  const cleanedType = venueType.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const map: Record<string, { title: string; text: string }> = {
    "Bar à bière": {
      title: "Les bars à bière où l'on vient autant pour la carte que pour l'ambiance",
      text: city
        ? `On te montre les bars à bière à découvrir autour de ${city}.`
        : "Des lieux vivants, conviviaux, avec une vraie identité et souvent de quoi prolonger la soirée.",
    },
    "Sports bar": {
      title: "Les sports bars où suivre un match devient une sortie",
      text: city
        ? `On te montre les sports bars à découvrir autour de ${city}.`
        : "Écrans, ambiance de match et lieux pensés pour vibrer en groupe plutôt que regarder seul.",
    },
    Pub: {
      title: "Les pubs où l'on aime rester plus longtemps que prévu",
      text: city
        ? `On te montre les pubs à découvrir autour de ${city}.`
        : "Des lieux chaleureux, vivants, souvent parfaits pour se retrouver, discuter et jouer.",
    },
    "Bar à fléchettes": {
      title: "Les bars à fléchettes où l'on joue vraiment",
      text: city
        ? `On te montre les bars à fléchettes à découvrir autour de ${city}.`
        : "Des adresses pensées pour la partie, l'ambiance et les soirées qui se décident autour d'une cible.",
    },
    "Bar à jeux": {
      title: "Les bars à jeux où la soirée démarre autour d'une table",
      text: city
        ? `On te montre les bars à jeux à découvrir autour de ${city}.`
        : "Des lieux où l'on vient pour jouer, rire, refaire une manche et souvent rester plus longtemps que prévu.",
    },
  };

  return (
    map[cleanedType] ?? {
      title: `Trouve le bon ${cleanedType.toLowerCase()} pour ta prochaine sortie`,
      text: city
        ? `On te montre les lieux qui correspondent à ${city}.`
        : "Choisis un type de lieu puis affine si besoin pour trouver la bonne adresse.",
    }
  );
};

const toMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dayDiff = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);

const getQuickEventLabel = (startsAt: string, now = new Date()) => {
  const eventDate = new Date(startsAt);
  if (Number.isNaN(eventDate.getTime())) return "Résultats rapides";
  const diff = dayDiff(now, eventDate);
  if (diff <= 0) {
    return eventDate.getHours() >= 19 ? "Ce soir" : "Aujourd'hui";
  }
  if (diff === 1) return "Demain";
  if (diff <= 6) return "Ces prochains jours";
  if (diff <= 13) return "La semaine prochaine";
  if (diff <= 20) return "Dans les semaines à venir";
  return "Bientôt";
};

const formatEventDate = (startsAt: string) => {
  const eventDate = new Date(startsAt);
  if (Number.isNaN(eventDate.getTime())) return "";
  return eventDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const radius = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const formatDistance = (km: number) => {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

const getVenuePhotos = (venue: ExploreVenue) => {
  const list = Array.isArray(venue.photos) ? venue.photos : [];
  const safePhotos = list.filter((item) => typeof item === "string" && isHttpUrlString(item));

  if (safePhotos.length > 0) return safePhotos;
  if (venue.coverUrl && isHttpUrlString(venue.coverUrl)) return [venue.coverUrl];
  return [FALLBACK_COVER];
};

const mapVenue = (row: VenueRow): ExploreVenue => {
  // Prefer venue_games (source of truth) over the potentially stale venues.activities column
  const venueGamesNames = (row.venue_games ?? [])
    .map((item) => item?.games?.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
  const activities = venueGamesNames.length > 0
    ? venueGamesNames
    : Array.isArray(row.activities)
      ? row.activities.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
      : [];
  const hasBooking = (row.venue_games ?? []).some((item) => {
    const mode = String(item?.booking_mode ?? "none");
    return mode !== "none";
  });
  const tags = (row.venue_venue_tags ?? [])
    .map((item) => item?.venue_tags?.name)
    .filter(Boolean) as string[];
  const fallbackTags =
    tags.length > 0
      ? tags
      : Array.isArray(row.tags)
        ? row.tags.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

  return {
    id: row.id,
    name: row.name,
    city: row.city ?? "",
    address: row.address ?? null,
    postcode: row.postcode ?? null,
    createdAt: row.created_at ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    coverUrl: row.cover_url ?? null,
    photos: Array.isArray(row.photos) ? row.photos.filter((item) => typeof item === "string") : [],
    openingHours: row.opening_hours ?? null,
    timezone: row.timezone ?? null,
    activities,
    tags: fallbackTags,
    venueType: row.venue_type ?? null,
    venueAmbiance: Array.isArray(row.venue_ambiance) ? row.venue_ambiance.filter(Boolean) : null,
    serviceTags: Array.isArray(row.service_tags) ? row.service_tags.filter(Boolean) : null,
    hasBooking,
  };
};

const mapEvent = (row: EventRow): ExploreEvent => {
  const rawCategoryId = row.category_id;
  const parsedCategoryId =
    rawCategoryId == null ? null : Number(rawCategoryId);

  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    coverUrl: row.cover_url ?? null,
    venueName: row.venues?.name ?? "",
    venueCity: row.venues?.city ?? "",
    categoryId: Number.isFinite(parsedCategoryId) ? parsedCategoryId : null,
    categoryName: row.event_categories?.name ?? null,
    venueId: row.venue_id ?? null,
  };
};

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { isPremium: userIsPremium } = useIsPremium();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [selectedEventCategoryId, setSelectedEventCategoryId] = useState<number | null>(null);
  const [eventCalendarMonth, setEventCalendarMonth] = useState(() =>
    toMonthStart(new Date())
  );
  const [cityQuery, setCityQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedVenueName, setSelectedVenueName] = useState<string | null>(null);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number | null>(10);
  const [activeIntent, setActiveIntent] = useState<IntentKey>("activities");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draftEventDate, setDraftEventDate] = useState<Date | null>(null);
  const [activeEventPanel, setActiveEventPanel] = useState<
    "location" | "categories" | "calendar" | null
  >("calendar");
  const [activeActivityPanel, setActiveActivityPanel] = useState<
    "location" | "activities" | null
  >("activities");
  const [venueSearchOpen, setVenueSearchOpen] = useState(false);
  const [activeVenuePanel, setActiveVenuePanel] = useState<
    "location" | "type" | "ambiance" | "services" | null
  >("type");
  const [selectedVenueTypes, setSelectedVenueTypes] = useState<string[]>([]);
  const [selectedVenueAmbiances, setSelectedVenueAmbiances] = useState<string[]>([]);
  const [selectedVenueServices, setSelectedVenueServices] = useState<string[]>([]);
  const [showAllActivityOptions, setShowAllActivityOptions] = useState(false);
  const [activityCarouselIndex, setActivityCarouselIndex] = useState<Record<number, number>>({});
  const [activityListOffsets, setActivityListOffsets] = useState<Record<string, number>>({});
  const [venues, setVenues] = useState<ExploreVenue[]>([]);
  const [events, setEvents] = useState<ExploreEvent[]>([]);
  const venueUpcomingEventCount = useMemo(() => {
    const map: Record<number, number> = {};
    const now = new Date();
    events.forEach((e) => {
      if (e.venueId && new Date(e.startsAt) > now) {
        map[e.venueId] = (map[e.venueId] ?? 0) + 1;
      }
    });
    return map;
  }, [events]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const trimmedQuery = appliedQuery.trim();
  const searchInputRef = useRef<TextInput | null>(null);
  const suppressActivityOpenRef = useRef(false);
  const suppressEventOpenRef = useRef(false);
  const baseVenuesRef = useRef<ExploreVenue[]>([]);
  const baseEventsRef = useRef<ExploreEvent[]>([]);
  const activityListRefs = useMemo<Record<string, ScrollView | null>>(() => ({}), []);
  const activityCardWidth = Math.min(180, Math.round(Dimensions.get("window").width * 0.46));

  const headerTopPadding = insets.top + 6;

  // En-tete compact au scroll (facon Airbnb) : les icones d'intention se reduisent
  // et disparaissent en scrollant, mais les 3 noms restent visibles.
  const scrollY = useRef(new Animated.Value(0)).current;
  const intentIconHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [54, 0],
    extrapolate: "clamp",
  });
  const intentIconOpacity = scrollY.interpolate({
    inputRange: [0, 110],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const intentIconMargin = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [4, 0],
    extrapolate: "clamp",
  });

  const calendarMonthLabel = useMemo(
    () => eventCalendarMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    [eventCalendarMonth]
  );

  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(eventCalendarMonth);
    const blanks = mondayIndex(eventCalendarMonth);
    const list: Array<number | null> = [];
    for (let i = 0; i < blanks; i += 1) list.push(null);
    for (let day = 1; day <= totalDays; day += 1) list.push(day);
    return list;
  }, [eventCalendarMonth]);

  const selectCalendarDay = (day: number) => {
    const next = new Date(
      eventCalendarMonth.getFullYear(),
      eventCalendarMonth.getMonth(),
      day
    );
    setDraftEventDate((prev) => (prev && isSameDay(prev, next) ? null : next));
  };

  const goPrevMonth = () => {
    setEventCalendarMonth((prev) =>
      toMonthStart(new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    );
  };

  const goNextMonth = () => {
    setEventCalendarMonth((prev) =>
      toMonthStart(new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    );
  };

  const selectedEventCategory = useMemo(
    () => eventCategories.find((category) => category.id === selectedEventCategoryId) ?? null,
    [selectedEventCategoryId]
  );

  const eventSearchDisplay = useMemo(
    () => selectedEventCategory?.title ?? "",
    [selectedEventCategory]
  );

  const eventCategorySummary = useMemo(
    () => selectedEventCategory?.title ?? "Toutes",
    [selectedEventCategory]
  );

  const eventDateSummary = useMemo(() => {
    if (!draftEventDate) return "Aucune date";
    return draftEventDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  }, [draftEventDate]);

  const venueTypeSummary = useMemo(() => {
    if (selectedVenueTypes.length === 0) return "Tous";
    return selectedVenueTypes.slice(0, 2).join(" · ");
  }, [selectedVenueTypes]);

  const venueAmbianceSummary = useMemo(() => {
    if (selectedVenueAmbiances.length === 0) return "Toutes";
    return selectedVenueAmbiances.slice(0, 2).join(" · ");
  }, [selectedVenueAmbiances]);

  const venueServicesSummary = useMemo(() => {
    if (selectedVenueServices.length === 0) return "Tous";
    return selectedVenueServices.slice(0, 2).join(" · ");
  }, [selectedVenueServices]);

  const toggleSelection = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const activitySummary = useMemo(
    () => selectedActivity ?? "Toutes",
    [selectedActivity]
  );

  const exploreSubtitle = useMemo(() => {
    if (activeIntent === "activities") {
      return "Choisis ce que tu veux faire et on te montre où le faire.";
    }
    if (activeIntent === "events") {
      return "Repère rapidement ce qu'il se passe aujourd'hui et cette semaine.";
    }
    return "Trouve le lieu adapté à ton mood du moment !";
  }, [activeIntent]);

  const setEventPanel = (panel: "location" | "categories" | "calendar" | null) => {
    setActiveEventPanel(panel);
    if (panel === "calendar") {
      const today = new Date();
      setEventCalendarMonth(toMonthStart(today));
      setDraftEventDate(today);
    }
  };

  const openActivitySearch = () => {
    if (activeIntent === "activities" && !suppressActivityOpenRef.current) {
      setActiveActivityPanel("activities");
      setActivitySearchOpen(true);
    }
  };

  const openVenueSearch = () => {
    if (activeIntent === "venues") {
      setActiveVenuePanel("type");
      setVenueSearchOpen(true);
    }
  };

  const closeActivitySearch = () => {
    setActivitySearchOpen(false);
    suppressActivityOpenRef.current = true;
    searchInputRef.current?.blur();
    setTimeout(() => {
      suppressActivityOpenRef.current = false;
    }, 300);
  };

  const closeVenueSearch = () => {
    setVenueSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const openEventSearch = () => {
    if (activeIntent === "events" && !suppressEventOpenRef.current) {
      setDraftEventDate(selectedDate);
      setEventPanel("calendar");
      setEventSearchOpen(true);
    }
  };

  const closeEventSearch = () => {
    setEventSearchOpen(false);
    suppressEventOpenRef.current = true;
    searchInputRef.current?.blur();
    setTimeout(() => {
      suppressEventOpenRef.current = false;
    }, 300);
  };

  const applyActivitySelection = (activity: string, closeModal?: boolean) => {
    setSelectedActivity((prev) => (prev === activity ? null : activity));
    setQuery("");
    if (closeModal) closeActivitySearch();
  };

  const activateActivity = (activity: string) => {
    setSelectedActivity((prev) => (prev === activity ? null : activity));
    setAppliedQuery((prev) => (prev === activity ? "" : activity));
    setQuery("");
  };

  const applyEventCategorySelection = (categoryId: number, closeModal?: boolean) => {
    const category = eventCategories.find((item) => item.id === categoryId);
    setSelectedEventCategoryId((prev) => (prev === categoryId ? null : categoryId));
    setAppliedQuery((prev) =>
      prev === (category?.title ?? "") ? "" : category?.title ?? ""
    );
    if (closeModal) closeEventSearch();
  };

  const activateVenueType = (type: string) => {
    setSelectedVenueTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [type]
    );
    setAppliedQuery("");
    setQuery("");
  };

  const applySearch = (nextQuery?: string) => {
    const value = (nextQuery ?? query).trim();
    setQuery("");
    if (activeIntent === "activities") {
      const nextActivity = value || selectedActivity || "";
      setAppliedQuery(nextActivity);
      setSelectedActivity(nextActivity || null);
    } else if (activeIntent === "events") {
      const selectedCategory = eventCategories.find(
        (category) => category.id === selectedEventCategoryId
      );
      const nextCategoryTitle = selectedCategory?.title ?? "";
      setAppliedQuery(nextCategoryTitle);
      setSelectedDate(draftEventDate ?? null);
    } else {
      setAppliedQuery(value);
    }
    const cityValue = cityQuery.trim();
    if (cityValue) {
      const normalized = normalizeSearchValue(cityValue);
      const venueNameMatch = venues.find((v) => normalizeSearchValue(v.name) === normalized);
      if (venueNameMatch) {
        setSelectedVenueName(venueNameMatch.name);
        setSelectedCity(null);
      } else {
        const cityMatch = cityOptions.find((city) => normalizeSearchValue(city) === normalized);
        setSelectedCity(cityMatch ?? cityValue);
        setSelectedVenueName(null);
      }
    } else {
      setSelectedCity(null);
      setSelectedVenueName(null);
    }
    setCityQuery("");
  };

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("venue_favorites")
      .select("venue_id")
      .eq("user_id", userId)
      .then(({ data }: { data: { venue_id: number }[] | null }) => {
        if (data) setFavoriteIds(new Set(data.map((r) => r.venue_id)));
      });
  }, [userId]);

  const toggleFavorite = async (venueId: number) => {
    if (!userId) return;
    const isFav = favoriteIds.has(venueId);
    if (!isFav && !userIsPremium) {
      const { count } = await supabase
        .from("venue_favorites")
        .select("venue_id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= 2) {
        Alert.alert(
          "Limite atteinte",
          "Tu as atteint la limite de 2 favoris. Passe à Jovial+ pour en ajouter autant que tu veux !",
          [
            { text: "Plus tard", style: "cancel" },
            { text: "Découvrir Jovial+", onPress: () => router.push("/premium" as any) },
          ]
        );
        return;
      }
    }
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(venueId) : next.add(venueId);
      return next;
    });
    if (isFav) {
      await supabase.from("venue_favorites").delete().eq("user_id", userId).eq("venue_id", venueId);
    } else {
      await supabase.from("venue_favorites").insert({ user_id: userId, venue_id: venueId });
    }
  };

  useEffect(() => {
    if (activeIntent !== "activities" && activitySearchOpen) {
      setActivitySearchOpen(false);
    }
  }, [activeIntent, activitySearchOpen]);

  useEffect(() => {
    if (activeIntent !== "events" && eventSearchOpen) {
      setEventSearchOpen(false);
    }
  }, [activeIntent, eventSearchOpen]);

  useEffect(() => {
    setQuery("");
    setAppliedQuery("");
    setSelectedActivity(null);
    setSelectedEventCategoryId(null);
    setSelectedDate(null);
    setDraftEventDate(null);
    setCityQuery("");
    setSelectedCity(null);
    setSelectedRadiusKm(10);
    setShowAllActivityOptions(false);
    setEventCalendarMonth(toMonthStart(new Date()));
    setActivitySearchOpen(false);
    setEventSearchOpen(false);
    setVenueSearchOpen(false);
    setActiveEventPanel("calendar");
    setActiveActivityPanel("activities");
    setActiveVenuePanel("type");
    setSelectedVenueTypes([]);
    setSelectedVenueAmbiances([]);
    setSelectedVenueServices([]);
    setVenues(baseVenuesRef.current);
    setEvents(baseEventsRef.current);
  }, [activeIntent]);

  useEffect(() => {
    if (venues.length === 0) return;
    const rooftop = venues.find((venue) =>
      normalizeSearchValue(venue.name).includes("rooftop")
    );
    if (rooftop) {
      console.log("[Explore] Rooftop activities:", rooftop.activities);
    }
  }, [venues]);

  useEffect(() => {
    if (activeIntent !== "activities") return;
    console.log("[Explore] selectedActivity:", selectedActivity, "appliedQuery:", appliedQuery);
  }, [activeIntent, selectedActivity, appliedQuery]);

  useEffect(() => {
    let mounted = true;

    const fetchBaseData = async () => {
      const cached = getExploreCache();
      if (cached) {
        setVenues(cached.venues);
        baseVenuesRef.current = cached.venues;
        setEvents(cached.events);
        baseEventsRef.current = cached.events;
        setGames(cached.games);
        setTags(cached.tags);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const [{ data: venuesData }, { data: eventsData }] = await Promise.all([
        supabase
          .from("venues")
          .select(
            "id, name, city, address, postcode, created_at, lat, lng, cover_url, photos, opening_hours, timezone, tags, venue_type, venue_ambiance, service_tags, activities, venue_games(games(name), booking_mode), venue_venue_tags(venue_tags(name))"
          ),
        supabase
          .from("events")
          .select(
            "id, title, starts_at, cover_url, venue_id, category_id, event_categories(name), venues(name, city)"
          )
          .order("starts_at", { ascending: true })
          .limit(30),
      ]);

      if (!mounted) return;

      const baseVenues = (venuesData as VenueRow[] | null)?.map(mapVenue) ?? [];
      console.log("[Explore] venues count:", baseVenues.length);
      console.log(
        "[Explore] venues with activities:",
        baseVenues.filter((v) => v.activities.length > 0).length
      );
      const mappedEvents = (eventsData as EventRow[] | null)?.map(mapEvent) ?? [];
      const baseFingerprint = `${baseVenues
        .map((v) => `${v.id}:${v.createdAt ?? ""}`)
        .join("|")}|${mappedEvents.map((e) => `${e.id}:${e.startsAt}`).join("|")}`;
      const cachedFingerprint = getExploreCache()?.fingerprint ?? null;
      if (baseFingerprint !== cachedFingerprint) {
        setVenues(baseVenues);
        baseVenuesRef.current = baseVenues;
        setEvents(mappedEvents);
        baseEventsRef.current = mappedEvents;
      }
      setLoading(false);

      const [{ data: gamesData }, { data: tagsData }, { data: venueGamesData }] = await Promise.all([
        supabase.from("games").select("id, name").order("name", { ascending: true }),
        supabase.from("venue_tags").select("id, name").order("name", { ascending: true }),
        supabase.from("venue_games").select("venue_id, games(name)"),
      ]);

      if (!mounted) return;

      const nextGames = (gamesData as GameRow[] | null) ?? [];
      const nextTags = (tagsData as TagRow[] | null) ?? [];
      setGames(nextGames);
      setTags(nextTags);
      if (venueGamesData && venueGamesData.length > 0) {
        console.log("[Explore] venue_games rows:", venueGamesData.length);
        const venueGameMap = new Map<number, string[]>();
        venueGamesData.forEach((row: any) => {
          const venueId = Number(row.venue_id);
          const name = row?.games?.name;
          if (!Number.isFinite(venueId) || !name) return;
          const list = venueGameMap.get(venueId) ?? [];
          list.push(String(name));
          venueGameMap.set(venueId, list);
        });
        const merged = baseVenues.map((venue) => {
          // Always prefer venue_games (source of truth) over the potentially stale venues.activities column
          const extra = venueGameMap.get(venue.id);
          return extra && extra.length > 0 ? { ...venue, activities: extra } : venue;
        });
        const mergedFingerprint = `${merged
          .map((v) => `${v.id}:${v.createdAt ?? ""}`)
          .join("|")}|${mappedEvents.map((e) => `${e.id}:${e.startsAt}`).join("|")}`;
        const cachedFingerprint = getExploreCache()?.fingerprint ?? null;
        if (mergedFingerprint !== cachedFingerprint) {
          setVenues(merged);
          baseVenuesRef.current = merged;
        }
        setExploreCache({
          venues: merged,
          events: mappedEvents,
          games: nextGames,
          tags: nextTags,
          fingerprint: mergedFingerprint,
        });
        return;
      }
      setExploreCache({
        venues: baseVenues,
        events: mappedEvents,
        games: nextGames,
        tags: nextTags,
        fingerprint: baseFingerprint,
      });
    };

    fetchBaseData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (activeIntent === "activities") return;
      if (activeIntent === "events" && selectedEventCategoryId != null) {
        const { data: eventsData } = await supabase
          .from("events")
          .select(
            "id, title, starts_at, cover_url, venue_id, category_id, event_categories(name), venues(name, city)"
          )
          .eq("category_id", selectedEventCategoryId)
          .order("starts_at", { ascending: true })
          .limit(60);

        if (cancelled) return;
        setEvents((eventsData as EventRow[] | null)?.map(mapEvent) ?? []);
        return;
      }

      if (activeIntent === "events" && selectedDate && trimmedQuery.length < 2) {
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const { data: eventsData } = await supabase
          .from("events")
          .select(
            "id, title, starts_at, cover_url, venue_id, category_id, event_categories(name), venues(name, city)"
          )
          .gte("starts_at", start.toISOString())
          .lt("starts_at", end.toISOString())
          .order("starts_at", { ascending: true })
          .limit(60);

        if (cancelled) return;
        setEvents((eventsData as EventRow[] | null)?.map(mapEvent) ?? []);
        return;
      }

      if (trimmedQuery.length < 2) return;

      const term = `%${trimmedQuery}%`;
      const [{ data: venuesData }, { data: eventsData }] = await Promise.all([
        supabase
          .from("venues")
          .select(
            "id, name, city, address, postcode, created_at, lat, lng, cover_url, photos, opening_hours, timezone, tags, venue_type, venue_ambiance, service_tags, activities, venue_games(games(name)), venue_venue_tags(venue_tags(name))"
          )
          .or(`name.ilike.${term},city.ilike.${term}`),
        supabase
          .from("events")
          .select(
            "id, title, starts_at, cover_url, venue_id, category_id, event_categories(name), venues(name, city)"
          )
          .ilike("title", term)
          .order("starts_at", { ascending: true })
          .limit(30),
      ]);

      if (cancelled) return;
      setVenues((venuesData as VenueRow[] | null)?.map(mapVenue) ?? []);
      setEvents((eventsData as EventRow[] | null)?.map(mapEvent) ?? []);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, activeIntent, selectedEventCategoryId, selectedDate]);

  useEffect(() => {
    let mounted = true;

    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (mounted) setCoords(null);
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      if (!mounted) return;
      setCoords({ lat: current.coords.latitude, lng: current.coords.longitude });
    };

    loadLocation();

    return () => {
      mounted = false;
    };
  }, []);

  const cityOptions = useMemo(() => {
    const base = venues.map((venue) => venue.city).filter(Boolean) as string[];
    const unique = Array.from(new Set(base.map((item) => item.trim()).filter(Boolean)));
    if (coords) return ["Autour de moi", ...unique];
    return unique;
  }, [venues, coords]);

  const filteredCityOptions = useMemo(() => {
    const term = normalizeSearchValue(cityQuery.trim());
    if (!term) return cityOptions;
    return cityOptions.filter((city) => normalizeSearchValue(city).includes(term));
  }, [cityOptions, cityQuery]);

  const filteredVenueNameOptions = useMemo(() => {
    const term = normalizeSearchValue(cityQuery.trim());
    if (!term) return [];
    return venues
      .filter((v) => normalizeSearchValue(v.name).includes(term))
      .map((v) => v.name)
      .filter((name, i, arr) => arr.indexOf(name) === i)
      .slice(0, 5);
  }, [venues, cityQuery]);

  const activityFilters = useMemo(() => {
    const base = [
      ...games.map((game) => game.name),
      ...venues.flatMap((venue) => venue.activities),
    ];
    return Array.from(new Set(base.filter(Boolean).map((item) => item.trim())));
  }, [games, venues]);

  const activityOptions = useMemo(() => {
    const common = [
      "Fléchettes",
      "Baby foot",
      "Billard",
      "Jeux de société",
      "Pétanque",
      "Palet breton",
    ];
    const normalizedCommon = new Set(common.map((item) => normalizeActivityLabel(item)));
    const normalizedFilters = activityFilters.map((item) => ({
      label: item,
      key: normalizeActivityLabel(item),
    }));
    const commonFromData = normalizedFilters
      .filter((item) => normalizedCommon.has(item.key))
      .map((item) => item.label);
    const extra = normalizedFilters
      .filter((item) => !normalizedCommon.has(item.key))
      .map((item) => item.label)
      .sort((a, b) => a.localeCompare(b, "fr-FR"));
    return { common: commonFromData.length > 0 ? commonFromData : common, extra };
  }, [activityFilters]);

  const cityHasMatches = useMemo(() => {
    if (!selectedCity || selectedCity === "Autour de moi") return true;
    const term = normalizeSearchValue(selectedCity);
    if (!term) return true;
    return venues.some((venue) =>
      normalizeSearchValue(venue.city ?? "").includes(term)
    );
  }, [venues, selectedCity]);

  const filteredVenues = useMemo(() => {
    return venues.filter((venue) => {
      if (selectedVenueName) {
        if (!normalizeSearchValue(venue.name).includes(normalizeSearchValue(selectedVenueName))) return false;
      } else if (selectedCity && selectedCity !== "Autour de moi") {
        const term = normalizeSearchValue(selectedCity);
        const cityValue = normalizeSearchValue(venue.city ?? "");
        if (cityHasMatches) {
          if (!cityValue.includes(term)) return false;
        } else if (coords && selectedRadiusKm != null) {
          if (venue.lat == null || venue.lng == null) return false;
          const km = distanceKm(coords.lat, coords.lng, venue.lat, venue.lng);
          if (km > selectedRadiusKm) return false;
        } else {
          return false;
        }
      }

      const activityQuery = activeIntent === "activities" ? trimmedQuery : "";
      const hasActivityMatch =
        activityQuery.length === 0 ||
        venue.activities.some((activity) =>
          hasQueryMatch(activity, activityQuery)
        );
      const matchesSearch =
        trimmedQuery.length === 0 ||
        hasQueryMatch(venue.name, trimmedQuery) ||
        hasQueryMatch(venue.city ?? "", trimmedQuery) ||
        hasActivityMatch ||
        venue.tags.some((tag) => hasQueryMatch(tag, trimmedQuery));

      if (activeIntent === "activities" && !hasActivityMatch) return false;

      const venueFilterValues = [
        ...(venue.tags ?? []),
        ...(venue.activities ?? []),
        ...(venue.venueType ? [venue.venueType] : []),
        ...(venue.venueAmbiance ?? []),
        ...(venue.serviceTags ?? []),
      ].map((item) => normalizeSearchValue(item));

      const matchesFilterGroup = (selected: string[]) => {
        if (selected.length === 0) return true;
        const normalized = selected.map((item) => normalizeSearchValue(item));
        return normalized.some((needle) =>
          venueFilterValues.some((value) => value.includes(needle))
        );
      };

      if (!matchesFilterGroup(selectedVenueTypes)) return false;
      if (!matchesFilterGroup(selectedVenueAmbiances)) return false;
      if (!matchesFilterGroup(selectedVenueServices)) return false;

      if (!matchesSearch) return false;

      return true;
    });
  }, [
    venues,
    trimmedQuery,
    selectedCity,
    activeIntent,
    cityHasMatches,
    coords,
    selectedRadiusKm,
    selectedVenueTypes,
    selectedVenueAmbiances,
    selectedVenueServices,
  ]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => new Date(event.startsAt).getTime() >= now)
      .filter((event) => {
        if (selectedDate) {
          const eventDate = new Date(event.startsAt);
          if (
            eventDate.getFullYear() !== selectedDate.getFullYear() ||
            eventDate.getMonth() !== selectedDate.getMonth() ||
            eventDate.getDate() !== selectedDate.getDate()
          ) {
            return false;
          }
        }
        if (selectedCity && selectedCity !== "Autour de moi") {
          const term = normalizeSearchValue(selectedCity);
          const cityValue = normalizeSearchValue(event.venueCity ?? "");
          if (!cityValue.includes(term)) return false;
        }

        let matchesSearch =
          trimmedQuery.length === 0 ||
          hasQueryMatch(event.title, trimmedQuery) ||
          hasQueryMatch(event.venueName, trimmedQuery) ||
          hasQueryMatch(event.venueCity, trimmedQuery);

        if (activeIntent === "events" && selectedEventCategoryId != null) {
          matchesSearch = event.categoryId === selectedEventCategoryId;
        }

        if (!matchesSearch) return false;

        return true;
      })
      .slice(0, 12);
  }, [
    events,
    trimmedQuery,
    selectedCity,
    selectedDate,
    activeIntent,
    selectedEventCategoryId,
  ]);

  const venuesWithDistance = useMemo(() => {
    if (!coords) return filteredVenues.map((venue) => ({ ...venue, distance: null }));

    return filteredVenues.map((venue) => {
      if (venue.lat == null || venue.lng == null) {
        return { ...venue, distance: null };
      }
      const km = distanceKm(coords.lat, coords.lng, venue.lat, venue.lng);
      return { ...venue, distance: km };
    });
  }, [filteredVenues, coords]);

  const sortedVenuesByDistance = useMemo(() => {
    if (!coords) return filteredVenues;
    return [...venuesWithDistance].sort((a, b) => {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [coords, filteredVenues, venuesWithDistance]);

  const nearbyVenues = useMemo(() => {
    const base = [...venuesWithDistance]
      .filter((venue) => {
        if (!coords || selectedRadiusKm == null) return true;
        if (venue.distance == null) return false;
        return venue.distance <= selectedRadiusKm;
      })
      .sort((a, b) => {
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      })
      .slice(0, 6);

    return base;
  }, [venuesWithDistance, coords, selectedRadiusKm]);

  const allActivities = useMemo(() => {
    const base = [
      ...games.map((game) => game.name),
      ...venues.flatMap((venue) => venue.activities),
    ];
    return Array.from(new Set(base.filter(Boolean).map((item) => item.trim())));
  }, [games, venues]);

  const isBretagne = useMemo(() => {
    const bretonPostcodes = ["22", "29", "35", "56"];
    const hasBretonPostcode = (postcode?: string | null) => {
      const code = (postcode ?? "").trim();
      return bretonPostcodes.some((prefix) => code.startsWith(prefix));
    };
    const normalizedCity = normalizeSearchValue(selectedCity ?? "");
    if (selectedCity && selectedCity !== "Autour de moi") {
      return venues.some((venue) => {
        const venueCity = normalizeSearchValue(venue.city ?? "");
        if (!venueCity.includes(normalizedCity)) return false;
        return hasBretonPostcode(venue.postcode ?? null);
      });
    }
    if (coords && selectedRadiusKm != null) {
      return venuesWithDistance.some((venue) => {
        if (venue.distance == null || venue.distance > selectedRadiusKm) return false;
        return hasBretonPostcode(venue.postcode ?? null);
      });
    }
    return false;
  }, [selectedCity, coords, selectedRadiusKm, venues, venuesWithDistance]);

  const orderedActivities = useMemo(() => {
    const filtered = allActivities.filter((activity) => {
      const matchesQuery =
        trimmedQuery.length === 0 || hasQueryMatch(activity, trimmedQuery);
      if (!matchesQuery) return false;

      return true;
    });
    const order = buildActivityOrder(isBretagne);
    const orderMap = new Map(
      order.map((item, index) => [normalizeActivityLabel(item), index])
    );
    return [...filtered].sort((a, b) => {
      const aKey = findOrderKey(a, order);
      const bKey = findOrderKey(b, order);
      const aRank = orderMap.has(aKey) ? orderMap.get(aKey)! : 999;
      const bRank = orderMap.has(bKey) ? orderMap.get(bKey)! : 999;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b, "fr-FR");
    });
  }, [allActivities, trimmedQuery, isBretagne]);

  const orderedActivityOptions = useMemo(() => {
    const order = buildActivityOrder(isBretagne);
    const orderMap = new Map(
      order.map((item, index) => [normalizeActivityLabel(item), index])
    );
    return [...allActivities].sort((a, b) => {
      const aKey = findOrderKey(a, order);
      const bKey = findOrderKey(b, order);
      const aRank = orderMap.has(aKey) ? orderMap.get(aKey)! : 999;
      const bRank = orderMap.has(bKey) ? orderMap.get(bKey)! : 999;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b, "fr-FR");
    });
  }, [allActivities, isBretagne]);

  const compactActivities = useMemo(() => {
    const base = isBretagne
      ? compactPreferredActivitiesBretagne
      : compactPreferredActivities;
    if (trimmedQuery.length > 0) {
      return base
        .map((item) => findPreferredMatch(item, orderedActivities))
        .filter((item): item is string => Boolean(item));
    }
    return base;
  }, [orderedActivities, isBretagne, trimmedQuery]);

  const compactActivityOptions = useMemo(() => {
    const base = isBretagne
      ? compactPreferredActivitiesBretagne
      : compactPreferredActivities;
    return base
      .map((item) => findPreferredMatch(item, orderedActivityOptions))
      .filter((item): item is string => Boolean(item));
  }, [orderedActivityOptions, isBretagne]);
  const discoverVenues = useMemo(() => {
    const base = [...venuesWithDistance];
    if (coords) {
      return base
        .sort((a, b) => {
          if (a.distance == null) return 1;
          if (b.distance == null) return -1;
          return a.distance - b.distance;
        })
        .slice(0, 6);
    }

    return base
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [venuesWithDistance, coords]);

  const activitySections = useMemo(() => {
    const sections = orderedActivities
      .map((activity) => {
        const normalized = normalizeSearchValue(activity);
        const matches = sortedVenuesByDistance.filter((venue) =>
          venue.activities.some((item) => normalizeSearchValue(item) === normalized)
        );
        return {
          activity,
          venues: matches.slice(0, 8),
          priorityKey: normalizeActivityLabel(activity),
        };
      })
      .filter((section) => section.venues.length > 0);

    return sections;
  }, [orderedActivities, sortedVenuesByDistance]);

  const featuredActivityOptions = useMemo(() => {
    const source = orderedActivityOptions.length > 0 ? orderedActivityOptions : compactActivityOptions;
    return compactPreferredActivities
      .map((activity) =>
        source.find(
          (item) => normalizeActivityLabel(item) === normalizeActivityLabel(activity)
        )
      )
      .filter((item): item is string => Boolean(item));
  }, [orderedActivityOptions, compactActivityOptions]);

  const featuredVenueTypes = useMemo(
    () => [
      "🍻 Bar à bière",
      "🏟️ Sports bar",
      "🍺 Pub",
      "🎯 Bar à fléchettes",
      "🎲 Bar à jeux",
    ],
    []
  );

  const featuredEventCategories = useMemo(() => {
    const orderedCategoryTitles = [
      "Sport & Retransmissions sportives",
      "Musique",
      "Jeux",
      "Scène & Parole",
    ];

    return orderedCategoryTitles
      .map((title) => eventCategories.find((category) => category.title === title))
      .filter((category): category is EventCategory => Boolean(category));
  }, []);

  const spotlightEvents = useMemo(() => {
    const in7days = new Date();
    in7days.setDate(in7days.getDate() + 7);
    return filteredEvents
      .filter((event) => {
        const startsAt = new Date(event.startsAt);
        if (startsAt > in7days) return false;
        if (coords && selectedRadiusKm != null) {
          // Garder uniquement les événements dont le lieu est dans le rayon
          const venue = venuesWithDistance.find((v) => v.id === event.venueId);
          if (venue && venue.distance != null && venue.distance > selectedRadiusKm) return false;
        }
        return true;
      })
      .slice(0, 3);
  }, [filteredEvents, coords, selectedRadiusKm, venuesWithDistance]);

  const featuredEvents = useMemo(
    () => filteredEvents.filter((e) => !spotlightEvents.some((s) => s.id === e.id)).slice(0, 6),
    [filteredEvents, spotlightEvents]
  );
  const activityHeroCopy = useMemo(
    () => getActivityHeroCopy(selectedActivity),
    [selectedActivity]
  );
  const eventHeroCopy = useMemo(
    () => getEventHeroCopy(selectedEventCategory?.title ?? null, !!selectedDate),
    [selectedEventCategory, selectedDate]
  );
  const venueHeroCopy = useMemo(
    () => getVenueHeroCopy(selectedVenueTypes[0] ?? null, selectedCity),
    [selectedVenueTypes, selectedCity]
  );

  const selectedActivityVenues = useMemo(() => {
    if (!selectedActivity) return sortedVenuesByDistance.slice(0, 12);
    const selectedKey = normalizeActivityLabel(selectedActivity);
    return sortedVenuesByDistance
      .filter((venue) =>
        venue.activities.some((activity) => normalizeActivityLabel(activity) === selectedKey)
      )
      .slice(0, 12);
  }, [selectedActivity, sortedVenuesByDistance]);

  const activityNearbyVenues = useMemo(() => {
    const base = selectedActivity ? selectedActivityVenues : nearbyVenues;
    return base.slice(0, 6);
  }, [selectedActivity, selectedActivityVenues, nearbyVenues]);

  const getActivityLeadLabel = (venue: ExploreVenue, focusActivity?: string | null) => {
    if (focusActivity) {
      const key = normalizeActivityLabel(focusActivity);
      const exact = venue.activities.find(
        (activity) => normalizeActivityLabel(activity) === key
      );
      if (exact) return exact;
    }

    return venue.activities[0] ?? "Activité";
  };


  const openVenue = (venueId: number) => {
    router.push(`/venue/${venueId}` as any);
  };

  const openEvent = (eventId: number) => {
    router.push(`/event/${eventId}` as any);
  };

  const openDirections = (venue: ExploreVenue) => {
    const label = encodeURIComponent(venue.name ?? "");

    if (venue.lat != null && venue.lng != null) {
      const url =
        Platform.OS === "ios"
          ? `http://maps.apple.com/?daddr=${venue.lat},${venue.lng}`
          : `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;

      Linking.openURL(url).catch((err) => console.error("Cannot open maps", err));
      return;
    }

    const query = encodeURIComponent(
      `${venue.address ?? ""} ${venue.postcode ?? ""} ${venue.city ?? ""}`.trim()
    );

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${query || label}`
        : `https://www.google.com/maps/dir/?api=1&destination=${query || label}`;

    Linking.openURL(url).catch((err) => console.error("Cannot open maps", err));
  };

  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const moodSelectingRef = useRef(false);

  const handleMoodSelect = (moodKey: MoodKey) => {
    if (selectedMood === moodKey) {
      setSelectedMood(null);
      setActiveIntent("activities");
      return;
    }
    moodSelectingRef.current = true;
    setSelectedMood(moodKey);
    if (moodKey === "drinks") {
      setActiveIntent("venues");
      setTimeout(() => {
        setSelectedVenueTypes(["🍺 Pub", "🍻 Bar à bière", "🍸 Bar", "☕ Café"]);
        setSelectedVenueAmbiances([]);
        moodSelectingRef.current = false;
      }, 50);
    } else if (moodKey === "food") {
      setActiveIntent("venues");
      setTimeout(() => {
        setSelectedVenueTypes(["🍽️ Restaurant", "🍔 Bar-restaurant"]);
        setSelectedVenueAmbiances([]);
        moodSelectingRef.current = false;
      }, 50);
    } else if (moodKey === "fun") {
      setActiveIntent("activities");
      moodSelectingRef.current = false;
    } else if (moodKey === "vibe") {
      setActiveIntent("events");
      moodSelectingRef.current = false;
    } else if (moodKey === "chill") {
      setActiveIntent("venues");
      setTimeout(() => {
        setSelectedVenueTypes([]);
        setSelectedVenueAmbiances(["🧘 Calme", "🛋️ Cosy", "🪴 Intimiste"]);
        moodSelectingRef.current = false;
      }, 50);
    } else {
      moodSelectingRef.current = false;
    }
  };

  const showVenues = activeIntent === "venues";
  const showEvents = activeIntent === "events";
  const showActivities = activeIntent === "activities";
  const quickResults =
    (trimmedQuery.length >= 2 ||
      (showEvents && (!!selectedDate || selectedEventCategoryId != null))) &&
    !showActivities;
  const hasActivitySearchCriteria =
    showActivities &&
    (trimmedQuery.length > 0 ||
      !!selectedActivity ||
      (selectedCity && selectedCity !== "Autour de moi"));

  const noQuickResults =
    (showVenues && filteredVenues.length === 0) ||
    (showEvents && filteredEvents.length === 0);

  const quickResultsTitle = useMemo(() => {
    if (!showEvents) return "Résultats rapides";
    const firstEvent = filteredEvents[0];
    if (!firstEvent) return "Résultats rapides";
    return getQuickEventLabel(firstEvent.startsAt);
  }, [showEvents, filteredEvents]);

  const handleActivityCarouselEnd = (venueId: number, offsetX: number, photoCount: number) => {
    const rawIndex = Math.round(offsetX / activityCardWidth);
    const nextIndex = Math.max(0, Math.min(photoCount - 1, rawIndex));
    setActivityCarouselIndex((prev) =>
      prev[venueId] === nextIndex ? prev : { ...prev, [venueId]: nextIndex }
    );
  };

  const handleActivityListScroll = (key: string, offsetX: number) => {
    setActivityListOffsets((prev) => (prev[key] === offsetX ? prev : { ...prev, [key]: offsetX }));
  };

  const scrollActivityListRight = (key: string) => {
    const ref = activityListRefs[key];
    if (!ref) return;
    const offset = activityListOffsets[key] ?? 0;
    ref.scrollTo({ x: offset + activityCardWidth + 12, animated: true });
  };
  const smartSuggestion = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Bon matin ☀️ Un café ou un brunch ?", intent: "venues" as IntentKey };
    if (hour < 18) return { text: "L'après-midi est à toi 🎯 Que fait-on ?", intent: "activities" as IntentKey };
    return { text: "Parfait pour ce soir 🍻 Qu'est-ce qu'on fait ?", intent: "venues" as IntentKey };
  }, []);

  const openSearchModal = () => {
    if (activeIntent === "activities") {
      setActiveActivityPanel("activities");
      setActivitySearchOpen(true);
    } else if (activeIntent === "events") {
      setDraftEventDate(selectedDate);
      setEventPanel("calendar");
      setEventSearchOpen(true);
    } else {
      setActiveVenuePanel("type");
      setVenueSearchOpen(true);
    }
  };

  return (
    <View style={styles.screen}>
      <Modal
        transparent
        visible={venueSearchOpen}
        animationType="fade"
        onRequestClose={closeVenueSearch}
      >
        <View style={styles.searchModalBackdrop}>
          <Pressable style={styles.searchModalScrim} onPress={closeVenueSearch} />
          <ScrollView
            contentContainerStyle={styles.searchModalSheet}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.searchModalHeader}>
              <Pressable style={styles.searchModalClose} onPress={closeVenueSearch} hitSlop={8}>
                <Ionicons name="close" size={20} color={Pastel.text} />
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.searchModalCard,
                activeVenuePanel !== "location" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setActiveVenuePanel(activeVenuePanel === "location" ? null : "location")
              }
            >
              <View style={styles.searchModalCardHeader}>
                <View style={styles.searchModalTitleRow}>
                  <Text style={styles.searchModalTitle}>Où</Text>
                  <Pressable
                    style={styles.searchModalInputRowCompact}
                    onPress={(event) => event.stopPropagation()}
                  >
                    <Ionicons name="location-outline" size={18} color={Pastel.textMuted} />
                    <TextInput
                      value={cityQuery}
                      onChangeText={setCityQuery}
                      placeholder="Ville ou établissement"
                      placeholderTextColor={Pastel.textMuted}
                      selectionColor="#2B4E93"
                      cursorColor="#2B4E93"
                      style={styles.searchModalInputCompact}
                      onPressIn={(event) => event.stopPropagation()}
                    />
                    {cityQuery.length > 0 || selectedCity || selectedVenueName ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          setCityQuery("");
                          setSelectedCity(null);
                          setSelectedVenueName(null);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={18} color={Pastel.textMuted} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                </View>
              </View>
              {activeVenuePanel !== "location" ? null : cityQuery.length > 0 ? (
                (filteredCityOptions.length > 0 || filteredVenueNameOptions.length > 0) ? (
                  <View style={styles.searchModalCityList}>
                    {filteredCityOptions.slice(0, 5).map((city) => (
                      <Pressable
                        key={`venue-city-option-${city}`}
                        style={styles.searchModalCityRow}
                        onPress={(event) => { event.stopPropagation(); setCityQuery(city); }}
                      >
                        <Ionicons name="location-outline" size={14} color={Pastel.textMuted} />
                        <Text style={styles.searchModalCityText}>{city}</Text>
                      </Pressable>
                    ))}
                    {filteredVenueNameOptions.map((name) => (
                      <Pressable
                        key={`venue-name-option-${name}`}
                        style={styles.searchModalCityRow}
                        onPress={(event) => { event.stopPropagation(); setCityQuery(name); }}
                      >
                        <Ionicons name="storefront-outline" size={14} color={Pastel.primary} />
                        <Text style={[styles.searchModalCityText, { color: Pastel.primary }]}>{name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.searchModalMuted}>Aucun résultat.</Text>
                )
              ) : null}
            </Pressable>

            <Pressable
              style={[
                styles.searchModalCard,
                activeVenuePanel !== "type" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() => setActiveVenuePanel(activeVenuePanel === "type" ? null : "type")}
            >
              <View style={styles.searchModalCardHeader}>
                <Text style={styles.searchModalTitle}>Type de lieu</Text>
              </View>
              {activeVenuePanel !== "type" ? null : (
                <View style={styles.searchModalChips}>
                  {venueTypeOptions.map((type) => {
                    const isActive = selectedVenueTypes.includes(type);
                    return (
                      <Pressable
                        key={`venue-type-${type}`}
                        style={[
                          styles.searchModalChip,
                          isActive ? styles.searchModalChipActive : null,
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleSelection(type, setSelectedVenueTypes);
                        }}
                      >
                        <Text
                          style={[
                            styles.searchModalChipText,
                            isActive ? styles.searchModalChipTextActive : null,
                          ]}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.searchModalCard,
                activeVenuePanel !== "ambiance" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setActiveVenuePanel(activeVenuePanel === "ambiance" ? null : "ambiance")
              }
            >
              <View style={styles.searchModalCardHeader}>
                <Text style={styles.searchModalTitle}>Ambiance</Text>
              </View>
              {activeVenuePanel !== "ambiance" ? null : (
                <View style={styles.searchModalChips}>
                  {venueAmbianceOptions.map((ambiance) => {
                    const isActive = selectedVenueAmbiances.includes(ambiance);
                    return (
                      <Pressable
                        key={`venue-ambiance-${ambiance}`}
                        style={[
                          styles.searchModalChip,
                          isActive ? styles.searchModalChipActive : null,
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleSelection(ambiance, setSelectedVenueAmbiances);
                        }}
                      >
                        <Text
                          style={[
                            styles.searchModalChipText,
                            isActive ? styles.searchModalChipTextActive : null,
                          ]}
                        >
                          {ambiance}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.searchModalCard,
                activeVenuePanel !== "services" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setActiveVenuePanel(activeVenuePanel === "services" ? null : "services")
              }
            >
              <View style={styles.searchModalCardHeader}>
                <Text style={styles.searchModalTitle}>Services</Text>
              </View>
              {activeVenuePanel !== "services" ? null : (
                <View style={styles.searchModalChips}>
                  {venueServiceOptions.map((service) => {
                    const isActive = selectedVenueServices.includes(service);
                    return (
                      <Pressable
                        key={`venue-service-${service}`}
                        style={[
                          styles.searchModalChip,
                          isActive ? styles.searchModalChipActive : null,
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleSelection(service, setSelectedVenueServices);
                        }}
                      >
                        <Text
                          style={[
                            styles.searchModalChipText,
                            isActive ? styles.searchModalChipTextActive : null,
                          ]}
                        >
                          {service}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.searchModalActionButton}
              onPress={() => {
                applySearch();
                closeVenueSearch();
              }}
            >
              <Ionicons name="search" size={16} color="#FFFFFF" />
              <Text style={styles.searchModalActionText}>Rechercher</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        transparent
        visible={activitySearchOpen}
        animationType="fade"
        onRequestClose={closeActivitySearch}
      >
        <View style={styles.searchModalBackdrop}>
          <Pressable style={styles.searchModalScrim} onPress={closeActivitySearch} />
          <ScrollView
            contentContainerStyle={styles.searchModalSheet}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.searchModalHeader}>
              <Pressable
                style={styles.searchModalClose}
                onPress={closeActivitySearch}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={Pastel.text} />
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.searchModalCard,
                activeActivityPanel !== "location" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setActiveActivityPanel(
                  activeActivityPanel === "location" ? null : "location"
                )
              }
            >
              <View style={styles.searchModalCardHeader}>
                <View style={styles.searchModalTitleRow}>
                  <Text style={styles.searchModalTitle}>Où</Text>
                  <Pressable
                    style={styles.searchModalInputRowCompact}
                    onPress={(event) => event.stopPropagation()}
                  >
                    <Ionicons name="location-outline" size={18} color={Pastel.textMuted} />
                    <TextInput
                      value={cityQuery}
                      onChangeText={setCityQuery}
                      placeholder="Ville ou établissement"
                      placeholderTextColor={Pastel.textMuted}
                      selectionColor="#2B4E93"
                      cursorColor="#2B4E93"
                      style={styles.searchModalInputCompact}
                      onPressIn={(event) => event.stopPropagation()}
                    />
                    {cityQuery.length > 0 || selectedCity || selectedVenueName ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          setCityQuery("");
                          setSelectedCity(null);
                          setSelectedVenueName(null);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={18} color={Pastel.textMuted} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                </View>
              </View>
              {activeActivityPanel !== "location" ? null : cityQuery.length > 0 ? (
                (filteredCityOptions.length > 0 || filteredVenueNameOptions.length > 0) ? (
                  <View style={styles.searchModalCityList}>
                    {filteredCityOptions.slice(0, 5).map((city) => (
                      <Pressable
                        key={`activity-city-option-${city}`}
                        style={styles.searchModalCityRow}
                        onPress={(event) => { event.stopPropagation(); setCityQuery(city); }}
                      >
                        <Ionicons name="location-outline" size={14} color={Pastel.textMuted} />
                        <Text style={styles.searchModalCityText}>{city}</Text>
                      </Pressable>
                    ))}
                    {filteredVenueNameOptions.map((name) => (
                      <Pressable
                        key={`activity-venue-name-${name}`}
                        style={styles.searchModalCityRow}
                        onPress={(event) => { event.stopPropagation(); setCityQuery(name); }}
                      >
                        <Ionicons name="storefront-outline" size={14} color={Pastel.primary} />
                        <Text style={[styles.searchModalCityText, { color: Pastel.primary }]}>{name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.searchModalMuted}>Aucun résultat.</Text>
                )
              ) : null}
            </Pressable>
            <Pressable
              style={[
                styles.searchModalCard,
                activeActivityPanel !== "activities" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setActiveActivityPanel(
                  activeActivityPanel === "activities" ? null : "activities"
                )
              }
            >
              <View style={styles.searchModalCardHeader}>
                <Text style={styles.searchModalTitle}>Activités</Text>
              </View>
              {activeActivityPanel !== "activities" ? null : (
                <>
                  {orderedActivityOptions.length === 0 ? (
                    <Text style={styles.searchModalMuted}>Aucune activité trouvée.</Text>
                  ) : (
                    <View style={styles.searchModalChips}>
                      {(showAllActivityOptions ? orderedActivityOptions : compactActivityOptions).map(
                        (activity) => {
                          const active = selectedActivity === activity;
                          return (
                            <Pressable
                              key={`activity-suggestion-${activity}`}
                              style={[
                                styles.searchModalChip,
                                active ? styles.searchModalChipActive : null,
                              ]}
                              onPress={(event) => {
                                event.stopPropagation();
                                applyActivitySelection(activity);
                              }}
                            >
                              <Text
                                style={[
                                  styles.searchModalChipText,
                                  active ? styles.searchModalChipTextActive : null,
                                ]}
                              >
                                {`${getActivityEmoji(activity)} ${activity}`}
                              </Text>
                            </Pressable>
                          );
                        }
                      )}
                      {orderedActivityOptions.length > compactActivityOptions.length ? (
                        <Pressable
                          style={styles.searchModalChipMoreCompact}
                          onPress={(event) => {
                            event.stopPropagation();
                            setShowAllActivityOptions((prev) => !prev);
                          }}
                        >
                          <Text style={styles.searchModalChipMoreText}>
                            {showAllActivityOptions
                              ? "— Voir moins d'activités"
                              : "Voir plus d'Activités"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </>
              )}
            </Pressable>
            <Pressable
              style={styles.searchModalActionButton}
              onPress={() => {
                applySearch();
                closeActivitySearch();
              }}
            >
              <Ionicons name="search" size={16} color="#FFFFFF" />
              <Text style={styles.searchModalActionText}>Rechercher</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        transparent
        visible={eventSearchOpen}
        animationType="fade"
        onRequestClose={closeEventSearch}
      >
        <View style={styles.searchModalBackdrop}>
          <Pressable style={styles.searchModalScrim} onPress={closeEventSearch} />
          <ScrollView
            contentContainerStyle={styles.searchModalSheet}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.searchModalHeader}>
              <Pressable style={styles.searchModalClose} onPress={closeEventSearch} hitSlop={8}>
                <Ionicons name="close" size={20} color={Pastel.text} />
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.searchModalCard,
                activeEventPanel !== "location" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setEventPanel(activeEventPanel === "location" ? null : "location")
              }
            >
              <View style={styles.searchModalCardHeader}>
                <View style={styles.searchModalTitleRow}>
                  <Text style={styles.searchModalTitle}>Où</Text>
                  <Pressable
                    style={styles.searchModalInputRowCompact}
                    onPress={(event) => event.stopPropagation()}
                  >
                    <Ionicons name="location-outline" size={18} color={Pastel.textMuted} />
                    <TextInput
                      value={cityQuery}
                      onChangeText={setCityQuery}
                      placeholder="Ville ou établissement"
                      placeholderTextColor={Pastel.textMuted}
                      selectionColor="#2B4E93"
                      cursorColor="#2B4E93"
                      style={styles.searchModalInputCompact}
                      onPressIn={(event) => event.stopPropagation()}
                    />
                    {cityQuery.length > 0 || selectedCity ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          setCityQuery("");
                          setSelectedCity(null);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={18} color={Pastel.textMuted} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                </View>
              </View>
              {activeEventPanel !== "location" ? null : cityQuery.length > 0 ? (
                filteredCityOptions.length > 0 ? (
                  <View style={styles.searchModalCityList}>
                    {filteredCityOptions.slice(0, 8).map((city) => (
                      <Pressable
                        key={`event-city-option-${city}`}
                        style={styles.searchModalCityRow}
                        onPress={(event) => {
                          event.stopPropagation();
                          setCityQuery(city);
                        }}
                      >
                        <Text style={styles.searchModalCityText}>{city}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.searchModalMuted}>Aucune ville trouvée.</Text>
                )
              ) : null}
            </Pressable>

            <Pressable
              style={[
                styles.searchModalCard,
                activeEventPanel !== "categories" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setEventPanel(activeEventPanel === "categories" ? null : "categories")
              }
            >
              <View style={styles.searchModalCardHeader}>
                <Text style={styles.searchModalTitle}>Catégories d'événements</Text>
              </View>
              {activeEventPanel !== "categories" ? null : (
                <View style={styles.searchModalChips}>
                  {eventCategories.map((category) => {
                    const isActive = selectedEventCategoryId === category.id;
                    const isOther = category.title === "Autres";
                    return (
                      <Pressable
                        key={category.id}
                        style={[
                          isOther ? styles.searchModalChipMore : styles.searchModalChip,
                          !isOther && isActive ? styles.searchModalChipActive : null,
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          applyEventCategorySelection(category.id);
                        }}
                      >
                        <Text
                          style={[
                            isOther ? styles.searchModalChipMoreText : styles.searchModalChipText,
                            !isOther && isActive ? styles.searchModalChipTextActive : null,
                          ]}
                        >
                          {`${getEventCategoryEmoji(category.title)} ${category.title}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.searchModalCard,
                activeEventPanel !== "calendar" ? styles.searchModalCardCollapsed : null,
              ]}
              onPress={() =>
                setEventPanel(activeEventPanel === "calendar" ? null : "calendar")
              }
            >
              <View style={styles.searchModalCardHeader}>
                <Text style={styles.searchModalTitle}>Calendrier</Text>
              </View>
              {activeEventPanel !== "calendar" ? null : (
                <Pressable
                  style={styles.searchModalCardBody}
                  onPress={(event) => event.stopPropagation()}
                >
                  <View style={styles.calendarHeader}>
                    <Pressable
                      style={styles.calendarNav}
                      onPress={(event) => {
                        event.stopPropagation();
                        goPrevMonth();
                      }}
                    >
                      <Ionicons name="chevron-back" size={16} color="#2B4E93" />
                    </Pressable>
                    <Text style={styles.calendarTitle}>{calendarMonthLabel}</Text>
                    <Pressable
                      style={styles.calendarNav}
                      onPress={(event) => {
                        event.stopPropagation();
                        goNextMonth();
                      }}
                    >
                      <Ionicons name="chevron-forward" size={16} color="#2B4E93" />
                    </Pressable>
                  </View>
                  <View style={styles.calendarWeekdays}>
                    {["L", "M", "M", "J", "V", "S", "D"].map((label, index) => (
                      <Text key={`weekday-${label}-${index}`} style={styles.calendarWeekdayText}>
                        {label}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.calendarGrid}>
                    {calendarDays.map((day, index) => {
                      if (!day) {
                        return <View key={`day-empty-${index}`} style={styles.calendarDay} />;
                      }
                      const date = new Date(
                        eventCalendarMonth.getFullYear(),
                        eventCalendarMonth.getMonth(),
                        day
                      );
                      const isSelected =
                        !!draftEventDate && isSameDay(draftEventDate, date);
                      const isToday = isSameDay(new Date(), date);
                      return (
                        <Pressable
                          key={`day-${day}`}
                          style={[
                            styles.calendarDay,
                            isToday ? styles.calendarDayToday : null,
                            isSelected ? styles.calendarDayActive : null,
                          ]}
                          onPress={(event) => {
                            event.stopPropagation();
                            selectCalendarDay(day);
                          }}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              isToday ? styles.calendarDayTextToday : null,
                              isSelected ? styles.calendarDayTextActive : null,
                            ]}
                          >
                            {day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Pressable>
              )}
            </Pressable>
            <Pressable
              style={styles.searchModalActionButton}
              onPress={() => {
                applySearch();
                closeEventSearch();
              }}
            >
              <Ionicons name="search" size={16} color="#FFFFFF" />
              <Text style={styles.searchModalActionText}>Rechercher</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>


      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* Sticky header: search bar + intent tabs */}
        <View style={[styles.headerZone, { paddingTop: headerTopPadding }]}>
          <Text style={styles.screenTitle}>Explorer</Text>
          <Pressable style={styles.searchHeaderCard} onPress={openSearchModal}>
            <Ionicons name="search" size={20} color={Pastel.textMuted} />
            <Text style={styles.searchPillPlaceholder}>
              {activeIntent === "activities"
                ? activitySummary !== "Toutes"
                  ? activitySummary
                  : "Choisir une activité…"
                : activeIntent === "events"
                ? eventSearchDisplay || "Rechercher un événement…"
                : venueTypeSummary !== "Tous"
                ? venueTypeSummary
                : "Rechercher un lieu…"}
            </Text>
          </Pressable>

          <View style={styles.intentTabsRow}>
            {intentTabs.map((tab) => {
              const active = activeIntent === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={styles.intentTab}
                  onPress={() => setActiveIntent(tab.key)}
                >
                  <Animated.View
                    style={[
                      styles.intentIconWrap,
                      active ? styles.intentIconWrapActive : null,
                      {
                        height: intentIconHeight,
                        opacity: intentIconOpacity,
                        marginBottom: intentIconMargin,
                        overflow: "hidden",
                      },
                    ]}
                  >
                    {tab.lib === "mci" ? (
                      <MaterialCommunityIcons
                        name={(active ? tab.iconActive : tab.icon) as any}
                        size={28}
                        color={active ? Pastel.primary : Pastel.textMuted}
                      />
                    ) : (
                      <Ionicons
                        name={(active ? tab.iconActive : tab.icon) as any}
                        size={28}
                        color={active ? Pastel.primary : Pastel.textMuted}
                      />
                    )}
                  </Animated.View>
                  <Text style={[styles.intentTabText, active ? styles.intentTabTextActive : null]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.intentTabUnderline, active ? styles.intentTabUnderlineActive : null]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Content area */}
        <View style={styles.sectionZone}>

          {/* Coup de projecteur + Sélection Jovial */}
          {!quickResults && showVenues && (
            <ExploreBoostBanner
              userLat={coords?.lat}
              userLng={coords?.lng}
            />
          )}

          {/* === VENUES === */}

          {showVenues && quickResults ? (
            <View style={styles.sectionCard}>
              <View style={styles.airbnbSectionHeader}>
                <Text style={styles.airbnbSectionTitle}>{quickResultsTitle}</Text>
              </View>
              {noQuickResults ? (
                <Text style={styles.muted}>Aucun résultat pour le moment.</Text>
              ) : (
                sortedVenuesByDistance.slice(0, 6).map((venue) => {
                  const openingStatus = getOpeningStatus(
                    venue.openingHours ?? undefined,
                    venue.timezone ?? null
                  );
                  return (
                    <Pressable
                      key={"result-" + venue.id}
                      style={styles.resultRow}
                      onPress={() => openVenue(venue.id)}
                    >
                      <View style={styles.resultIcon}>
                        <Ionicons name="location-outline" size={16} color="#0B0B12" />
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>{venue.name}</Text>
                        <Text style={styles.resultMeta}>
                          {venue.city || "Ville"} - {venue.tags[0] ?? "Lieu"}
                        </Text>
                        {openingStatus.status !== "unknown" ? (
                          <View style={styles.statusRow}>
                            <View
                              style={[
                                styles.statusPill,
                                openingStatus.isOpen
                                  ? styles.statusPillOpen
                                  : styles.statusPillClosed,
                              ]}
                            >
                              <Text style={styles.statusPillText}>
                                {openingStatus.isOpen ? "Ouvert" : "Fermé"}
                              </Text>
                            </View>
                            {!!openingStatus.nextChangeLabel && (
                              <Text style={styles.statusMeta}>
                                {openingStatus.nextChangeLabel}
                              </Text>
                            )}
                          </View>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}

          {showVenues && !quickResults ? (
            <View style={styles.sectionCard}>
              <View style={styles.airbnbSectionHeader}>
                <Text style={styles.airbnbSectionTitle}>Autour de toi</Text>
                <Pressable><Text style={styles.airbnbSeeAll}>Voir tout →</Text></Pressable>
              </View>
              {nearbyVenues.length === 0 ? (
                <Text style={styles.muted}>Aucun résultat pour le moment.</Text>
              ) : (
                <View style={styles.activityListingWrap}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.activityListingRow}
                    ref={(ref) => {
                      activityListRefs["venues-nearby"] = ref;
                    }}
                    onScroll={(event) =>
                      handleActivityListScroll(
                        "venues-nearby",
                        event.nativeEvent.contentOffset.x
                      )
                    }
                    scrollEventThrottle={16}
                  >
                    {nearbyVenues.map((venue) => {
                      const photos = getVenuePhotos(venue);
                      const activeIndex = activityCarouselIndex[venue.id] ?? 0;
                      const typeLabel = getVenueTypeLabel(venue);
                      return (
                        <Pressable
                          key={`nearby-venue-${venue.id}`}
                          style={styles.airbnbVenueCard}
                          onPress={() => openVenue(venue.id)}
                        >
                          <View style={styles.airbnbCarouselWrap}>
                            <ScrollView
                              horizontal
                              pagingEnabled
                              showsHorizontalScrollIndicator={false}
                              snapToInterval={260}
                              decelerationRate="fast"
                              onMomentumScrollEnd={(event) =>
                                handleActivityCarouselEnd(
                                  venue.id,
                                  event.nativeEvent.contentOffset.x,
                                  photos.length
                                )
                              }
                            >
                              {photos.map((url, index) => (
                                <View
                                  key={`nearby-venue-${venue.id}-photo-${index}`}
                                  style={[
                                    styles.activityCarouselSlide,
                                    { width: 260, height: 160 },
                                  ]}
                                >
                                  <Image
                                    source={url}
                                    style={styles.activityCarouselImage}
                                    contentFit="cover"
                                    cachePolicy="disk"
                                    transition={120}
                                  />
                                </View>
                              ))}
                            </ScrollView>
                            <View style={styles.activityCarouselDots}>
                              {photos.map((_, index) => (
                                <View
                                  key={`nearby-venue-${venue.id}-dot-${index}`}
                                  style={[
                                    styles.activityCarouselDot,
                                    index === activeIndex ? styles.activityCarouselDotActive : null,
                                  ]}
                                />
                              ))}
                            </View>
                            {typeLabel ? (
                              <View style={styles.venueTypeBadgeOnPhoto}>
                                <Text style={styles.venueTypeBadgeOnPhotoText}>{typeLabel}</Text>
                              </View>
                            ) : null}
                            {coords && venue.lat != null && venue.lng != null ? (
                              <View style={styles.distancePill}>
                                <Ionicons name="location" size={11} color="#FFFFFF" />
                                <Text style={styles.distanceText}>
                                  {formatDistance(distanceKm(coords.lat, coords.lng, venue.lat, venue.lng))}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.airbnbCardInfo}>
                            <View style={styles.airbnbCardInfoRow}>
                              <Text style={[styles.airbnbCardTitle, { flex: 1 }]}>{venue.name}</Text>
                              <Pressable
                                onPress={(e) => { e.stopPropagation(); toggleFavorite(venue.id); }}
                                hitSlop={10}
                              >
                                <Ionicons
                                  name={favoriteIds.has(venue.id) ? "heart" : "heart-outline"}
                                  size={20}
                                  color={favoriteIds.has(venue.id) ? "#EF4444" : Pastel.textMuted}
                                />
                              </Pressable>
                            </View>
                            <Text style={styles.airbnbCardMeta}>{venue.city || "Ville"}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {nearbyVenues.length > 1 ? (
                    <Pressable
                      style={styles.activityListArrow}
                      onPress={() => scrollActivityListRight("venues-nearby")}
                    >
                      <Ionicons name="chevron-forward" size={18} color={Pastel.text} />
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}


          {/* === EVENTS === */}

          {showEvents && spotlightEvents.length > 0 && !quickResults ? (
            <View style={styles.sectionCard}>
              <View style={styles.airbnbSectionHeader}>
                <Text style={styles.airbnbSectionTitle}>{eventHeroCopy.spotlightTitle}</Text>
                <Pressable><Text style={styles.airbnbSeeAll}>Voir tout →</Text></Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 10 }}>
                {spotlightEvents.map((event) => (
                  <Pressable
                    key={`spotlight-event-${event.id}`}
                    style={styles.airbnbEventCard}
                    onPress={() => openEvent(event.id)}
                  >
                    <Image
                      source={event.coverUrl || FALLBACK_COVER}
                      style={styles.airbnbEventImage}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={120}
                    />
                    <View style={styles.airbnbCardInfo}>
                      <Text style={styles.airbnbCardTitle}>{event.title}</Text>
                      <Text style={styles.airbnbCardMeta}>
                        {formatEventDate(event.startsAt)} · {event.venueName || "Lieu"}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {showEvents && quickResults ? (
            <View style={styles.sectionCard}>
              <View style={styles.airbnbSectionHeader}>
                <Text style={styles.airbnbSectionTitle}>{quickResultsTitle}</Text>
              </View>
              {noQuickResults ? (
                <Text style={styles.muted}>Aucun résultat pour le moment.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 10 }}>
                  {filteredEvents.slice(0, 12).map((event) => (
                    <Pressable
                      key={"result-" + event.id}
                      style={styles.airbnbEventCard}
                      onPress={() => openEvent(event.id)}
                    >
                      <Image
                        source={event.coverUrl || FALLBACK_COVER}
                        style={styles.airbnbEventImage}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={120}
                      />
                      <View style={styles.airbnbCardInfo}>
                        <Text style={styles.airbnbCardTitle}>{event.title}</Text>
                        <Text style={styles.airbnbCardMeta}>
                          {formatEventDate(event.startsAt)} · {event.venueName || "Lieu"}
                        </Text>
                        <Text style={styles.airbnbCardMeta}>{event.venueCity || "Ville"}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {showEvents && !quickResults ? (
            <View style={styles.sectionCard}>
              <View style={styles.airbnbSectionHeader}>
                <Text style={styles.airbnbSectionTitle}>{eventHeroCopy.listTitle}</Text>
                <Pressable><Text style={styles.airbnbSeeAll}>Voir tout →</Text></Pressable>
              </View>
              {featuredEvents.length === 0 ? (
                <Text style={styles.muted}>Aucun événement pour le moment.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 10 }}>
                  {featuredEvents.map((event) => (
                    <Pressable
                      key={"event-list-" + event.id}
                      style={styles.airbnbEventCard}
                      onPress={() => openEvent(event.id)}
                    >
                      <Image
                        source={event.coverUrl || FALLBACK_COVER}
                        style={styles.airbnbEventImage}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={120}
                      />
                      <View style={styles.airbnbCardInfo}>
                        <Text style={styles.airbnbCardTitle}>{event.title}</Text>
                        <Text style={styles.airbnbCardMeta}>
                          {formatEventDate(event.startsAt)} · {event.venueName || "Lieu"}
                        </Text>
                        <Text style={styles.airbnbCardMeta}>{event.venueCity || "Ville"}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {/* === ACTIVITIES === */}
          {showActivities ? (
            <>
              {activitySections.map((section) => (
                <View key={`activity-section-${section.activity}`} style={styles.sectionCard}>
                  <View style={styles.airbnbSectionHeader}>
                    <Text style={styles.airbnbSectionTitle}>{section.activity}</Text>
                    <Pressable><Text style={styles.airbnbSeeAll}>Voir tout →</Text></Pressable>
                  </View>
                  <View style={styles.activityListingWrap}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.activityListingRow}
                      ref={(ref) => {
                        const key = normalizeActivityLabel(section.activity);
                        activityListRefs[key] = ref;
                      }}
                      onScroll={(event) =>
                        handleActivityListScroll(
                          normalizeActivityLabel(section.activity),
                          event.nativeEvent.contentOffset.x
                        )
                      }
                      scrollEventThrottle={16}
                    >
                      {section.venues.map((venue) => {
                        const photos = getVenuePhotos(venue);
                        const activeIndex = activityCarouselIndex[venue.id] ?? 0;
                        return (
                          <Pressable
                            key={`activity-venue-${section.activity}-${venue.id}`}
                            style={styles.airbnbVenueCard}
                            onPress={() => openVenue(venue.id)}
                          >
                            <View style={styles.airbnbCarouselWrap}>
                              <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                snapToInterval={260}
                                decelerationRate="fast"
                                onMomentumScrollEnd={(event) =>
                                  handleActivityCarouselEnd(
                                    venue.id,
                                    event.nativeEvent.contentOffset.x,
                                    photos.length
                                  )
                                }
                              >
                                {photos.map((url, index) => (
                                  <View
                                    key={`activity-venue-${venue.id}-photo-${index}`}
                                    style={[
                                      styles.activityCarouselSlide,
                                      { width: 260, height: 160 },
                                    ]}
                                  >
                                    <Image
                                      source={url}
                                      style={styles.activityCarouselImage}
                                      contentFit="cover"
                                      cachePolicy="disk"
                                      transition={120}
                                    />
                                  </View>
                                ))}
                              </ScrollView>
                              <View style={styles.activityCarouselDots}>
                                {photos.map((_, index) => (
                                  <View
                                    key={`activity-venue-${venue.id}-dot-${index}`}
                                    style={[
                                      styles.activityCarouselDot,
                                      index === activeIndex ? styles.activityCarouselDotActive : null,
                                    ]}
                                  />
                                ))}
                              </View>
                              <View style={styles.activityFocusBadge}>
                                <Text style={styles.activityFocusBadgeText}>
                                  {`${getActivityEmoji(section.activity)} ${section.activity}`}
                                </Text>
                              </View>
                              {coords && venue.lat != null && venue.lng != null ? (
                                <View style={styles.distancePill}>
                                  <Ionicons name="location" size={11} color="#FFFFFF" />
                                  <Text style={styles.distanceText}>
                                    {formatDistance(distanceKm(coords.lat, coords.lng, venue.lat, venue.lng))}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.airbnbCardInfo}>
                              <View style={styles.airbnbCardInfoRow}>
                                <Text style={[styles.airbnbCardTitle, { flex: 1 }]}>{venue.name}</Text>
                                <Pressable
                                  onPress={(e) => { e.stopPropagation(); toggleFavorite(venue.id); }}
                                  hitSlop={10}
                                >
                                  <Ionicons
                                    name={favoriteIds.has(venue.id) ? "heart" : "heart-outline"}
                                    size={20}
                                    color={favoriteIds.has(venue.id) ? "#EF4444" : Pastel.textMuted}
                                  />
                                </Pressable>
                              </View>
                              <Text style={styles.airbnbCardMeta}>
                                {venue.city || "Ville"}
                                {venue.tags[0] ? ` · ${venue.tags[0]}` : ""}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    {section.venues.length > 1 ? (
                      <Pressable
                        style={styles.activityListArrow}
                        onPress={() => scrollActivityListRight(normalizeActivityLabel(section.activity))}
                      >
                        <Ionicons name="chevron-forward" size={18} color={Pastel.text} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pastel.background },
  container: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 60,
    gap: 0,
    backgroundColor: Pastel.background,
    flexGrow: 1,
  },
  quickFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 16,
    backgroundColor: Pastel.background,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  quickFilterScroll: {
    gap: 8,
    paddingRight: 12,
  },
  quickFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
  },
  quickFilterChipActive: {
    backgroundColor: Pastel.primary,
    borderColor: Pastel.primary,
  },
  quickFilterChipText: {
    fontSize: 13,
    fontFamily: Font.medium,
    color: Pastel.text,
    includeFontPadding: false,
  },
  quickFilterChipTextActive: {
    color: "#FFFFFF",
  },
  quickFilterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Pastel.border,
    backgroundColor: Pastel.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    marginLeft: 4,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: Font.display,
    color: Pastel.primary,
    letterSpacing: 0.5,
    paddingBottom: 4,
    includeFontPadding: false,
  },
  headerZone: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    backgroundColor: Pastel.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -8,
    height: 16,
    backgroundColor: "transparent",
    shadowColor: "#0B0B12",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sectionZone: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
    backgroundColor: Pastel.background,
    flexGrow: 1,
  },
  title: { fontSize: 28, fontFamily: Font.extraBold, color: Pastel.text, includeFontPadding: false },
  subtitle: { fontSize: 13, color: Pastel.textMuted, includeFontPadding: false },
  exploreSubtitle: {
    fontSize: 14,
    fontFamily: Font.semiBold,
    color: "#4B5563",
    textAlign: "center",
    width: "100%",
    marginBottom: 4,
    includeFontPadding: false,
  },
  searchHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 40,
    backgroundColor: Pastel.surface,
    borderWidth: 1.5,
    borderColor: Pastel.primarySoft,
    marginTop: 8,
    marginBottom: 10,
    shadowColor: Pastel.primary,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  searchPillInput: { flex: 1, fontSize: 15, color: Pastel.text, includeFontPadding: false },
  searchPillFake: { flex: 1, paddingVertical: 2 },
  searchPillPlaceholder: { fontSize: 15, color: Pastel.textMuted, includeFontPadding: false },
  searchPillValue: { fontSize: 15, color: Pastel.text, includeFontPadding: false },
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
  },
  searchModalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(247, 244, 238, 0.22)",
  },
  searchModalSheet: {
    paddingTop: 70,
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 40,
  },
  searchModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchModalHeaderText: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  searchModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  searchModalCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: Pastel.surface,
    gap: 12,
    shadowColor: "#0B0B12",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  searchModalCardCollapsed: {
    paddingVertical: 12,
    gap: 6,
  },
  searchModalCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  searchModalCardBody: { gap: 12 },
  searchModalTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  searchModalSummary: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  searchModalSectionLabel: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.bold, includeFontPadding: false },
  searchModalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  searchModalInput: { flex: 1, fontSize: 15, color: Pastel.text, includeFontPadding: false },
  searchModalInputRowCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
    borderWidth: 1,
    borderColor: Pastel.border,
  },
  searchModalInputCompact: { flex: 1, fontSize: 14, color: Pastel.text, includeFontPadding: false },
  searchModalChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  searchModalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  searchModalChipActive: {
    backgroundColor: "#D6E0F5",
    borderWidth: 1,
    borderColor: "#B9CCEF",
  },
  searchModalChipText: { fontSize: 12, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  searchModalChipTextActive: { color: "#2B4E93", fontFamily: Font.bold, includeFontPadding: false },
  searchModalChipMore: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#D6E0F5",
    borderWidth: 1,
    borderColor: "#B9CCEF",
  },
  searchModalChipMoreCompact: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#D6E0F5",
    borderWidth: 1,
    borderColor: "#B9CCEF",
  },
  searchModalChipMoreText: { fontSize: 12, color: "#2B4E93", fontFamily: Font.bold, includeFontPadding: false },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  calendarNav: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.primarySoft,
  },
  calendarTitle: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  calendarWeekdays: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 4,
  },
  calendarWeekdayText: {
    fontSize: 10,
    fontFamily: Font.bold,
    color: Pastel.textMuted,
    width: "14.2857%",
    textAlign: "center",
    includeFontPadding: false,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    rowGap: 6,
  },
  calendarDay: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  calendarDayToday: {
    backgroundColor: "#D6E0F5",
    borderWidth: 1,
    borderColor: "#2B4E93",
  },
  calendarDayActive: { backgroundColor: "#2B4E93" },
  calendarDayText: { fontSize: 11, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },
  calendarDayTextToday: { color: "#2B4E93" },
  calendarDayTextActive: { color: "#FFFFFF" },
  searchModalCityList: { gap: 6 },
  searchModalCityRow: { paddingVertical: 6, paddingHorizontal: 6 },
  searchModalCityText: { fontSize: 14, color: Pastel.text, fontFamily: Font.semiBold, includeFontPadding: false },
  searchModalMuted: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  searchModalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#2B4E93",
    shadowColor: "#0B0B12",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  searchModalActionText: { color: "#FFFFFF", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  intentTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  intentTab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingTop: 8,
  },
  intentTabActive: {},
  intentIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  intentIconWrapActive: {
    backgroundColor: Pastel.primarySoft,
  },
  intentIconImage: {
    width: 32,
    height: 32,
  },
  intentTabText: { fontSize: 12, color: Pastel.textMuted, fontFamily: Font.medium, textAlign: "center", includeFontPadding: false },
  intentTabTextActive: { color: Pastel.primary, fontFamily: Font.bold, includeFontPadding: false },
  intentTabUnderline: {
    height: 2,
    width: "60%",
    borderRadius: 999,
    backgroundColor: "transparent",
    marginTop: 2,
    alignSelf: "center",
  },
  intentTabUnderlineActive: {
    backgroundColor: Pastel.primary,
  },
  searchPanel: {
    padding: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    gap: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  searchRowColumn: { gap: 10 },
  searchTextBlock: { flex: 1 },
  searchLabel: { fontSize: 12, color: "#64748B", fontFamily: Font.semiBold, includeFontPadding: false },
  searchInput: { color: "#0B0B12", fontSize: 16, paddingVertical: 2, includeFontPadding: false },
  searchValue: { color: "#0B0B12", fontSize: 15, fontFamily: Font.semiBold, includeFontPadding: false },
  searchDivider: { height: 1, backgroundColor: Pastel.border },
  searchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D6E0F5",
  },
  searchClear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  datePickerCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#F8FAFC",
    maxHeight: "70%",
  },
  datePickerTitle: { fontSize: 16, fontFamily: Font.bold, color: "#0B0B12", marginBottom: 8, includeFontPadding: false },
  datePickerOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  datePickerOptionText: { fontSize: 14, color: "#0B0B12", fontFamily: Font.semiBold, includeFontPadding: false },
  moreButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#2B4E93",
  },
  moreButtonText: { fontSize: 12, fontFamily: Font.bold, color: "#FFFFFF", includeFontPadding: false },
  intentRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  intentChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  intentChipActive: {
    backgroundColor: "#D6E0F5",
    borderColor: "#D6E0F5",
  },
  intentText: { fontSize: 12, color: "#0B0B12", fontFamily: Font.bold, includeFontPadding: false },
  intentTextActive: { color: "#2B4E93" },
  filterRow: { gap: 8 },
  filterScroll: { gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#D6E0F5",
  },
  filterText: { fontSize: 12, color: "#64748B", fontFamily: Font.semiBold, includeFontPadding: false },
  filterTextActive: { color: "#2B4E93" },
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  chipActive: {
    backgroundColor: "#D6E0F5",
  },
  chipText: { fontSize: 12, color: "#64748B", fontFamily: Font.semiBold, includeFontPadding: false },
  chipTextActive: { color: "#2B4E93" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionCard: {
    backgroundColor: "transparent",
    gap: 14,
  },
  activityHeroCard: {
    gap: 16,
    paddingBottom: 8,
  },
  activityHeroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  activityHeroCopy: {
    flex: 1,
    gap: 6,
  },
  activityHeroEyebrow: {
    fontSize: 11,
    fontFamily: Font.extraBold,
    color: "#2B4E93",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    includeFontPadding: false,
  },
  activityHeroTitle: {
    fontSize: 22,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    lineHeight: 28,
    includeFontPadding: false,
  },
  activityHeroText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#4B5563",
    includeFontPadding: false,
  },
  activityHeroAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#D6E0F5",
  },
  activityHeroActionText: {
    fontSize: 12,
    fontFamily: Font.bold,
    color: "#2B4E93",
    includeFontPadding: false,
  },
  activityQuickRow: {
    gap: 8,
    paddingRight: 10,
  },
  activityQuickChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  activityQuickChipActive: {
    backgroundColor: "#2B4E93",
    borderColor: "#2B4E93",
  },
  activityQuickChipText: {
    fontSize: 12,
    fontFamily: Font.bold,
    color: Pastel.text,
    includeFontPadding: false,
  },
  activityQuickChipTextActive: {
    color: "#FFFFFF",
  },
  discoveryHeroCard: {
    gap: 16,
    paddingBottom: 6,
  },
  discoveryHeroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  discoveryHeroCopy: {
    flex: 1,
    gap: 6,
  },
  discoveryHeroEyebrow: {
    fontSize: 11,
    fontFamily: Font.extraBold,
    color: "#2B4E93",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    includeFontPadding: false,
  },
  discoveryHeroTitle: {
    fontSize: 22,
    fontFamily: Font.extraBold,
    color: Pastel.text,
    lineHeight: 28,
    includeFontPadding: false,
  },
  discoveryHeroText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#4B5563",
    includeFontPadding: false,
  },
  discoveryHeroAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#D6E0F5",
  },
  discoveryHeroActionText: {
    fontSize: 12,
    fontFamily: Font.bold,
    color: "#2B4E93",
    includeFontPadding: false,
  },
  discoveryQuickRow: {
    gap: 8,
    paddingRight: 10,
  },
  discoveryQuickChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  discoveryQuickChipActive: {
    backgroundColor: "#2B4E93",
    borderColor: "#2B4E93",
  },
  discoveryQuickChipText: {
    fontSize: 12,
    fontFamily: Font.bold,
    color: Pastel.text,
    includeFontPadding: false,
  },
  discoveryQuickChipTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: { fontSize: 16, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  muted: { fontSize: 13, color: Pastel.textMuted, includeFontPadding: false },
  inspirationRow: { gap: 12 },
  inspirationCard: {
    width: 240,
    height: 150,
    borderRadius: 18,
    overflow: "hidden",
  },
  inspirationImage: { width: "100%", height: "100%" },
  inspirationOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  inspirationTitle: { color: "#F8FAFC", fontSize: 14, fontFamily: Font.bold, includeFontPadding: false },
  inspirationSubtitle: { color: "#E2E8F0", fontSize: 12, includeFontPadding: false },
  placeCard: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  placeImageWrap: {
    height: 130,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  placeImage: { width: "100%", height: "100%" },
  placeFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  newBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#D6E0F5",
  },
  activityFocusBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.72)",
  },
  activityFocusBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  activityResultBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.78)",
  },
  activityResultBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: Font.bold,
    includeFontPadding: false,
  },
  newBadgeText: { color: "#2B4E93", fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  placeTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  placeName: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  placeMeta: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillOpen: { backgroundColor: "#2F9E44" },
  statusPillClosed: { backgroundColor: "#8A8F98" },
  statusPillText: { fontSize: 11, fontFamily: Font.bold, color: "#FFFFFF", includeFontPadding: false },
  statusMeta: { fontSize: 11, color: Pastel.textMuted, fontFamily: Font.semiBold, includeFontPadding: false },
  venueTypeBadgeOnPhoto: {
    position: "absolute",
    left: 10,
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.72)",
  },
  venueTypeBadgeOnPhotoText: { fontSize: 11, fontFamily: Font.bold, color: "#FFFFFF", includeFontPadding: false },
  venueActivityTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 },
  venueActivityTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  venueActivityTagText: { fontSize: 10, fontFamily: Font.semiBold, color: Pastel.text, includeFontPadding: false },
  venueEventLine: { fontSize: 11, color: Pastel.textMuted, marginTop: 4, includeFontPadding: false },
  distancePill: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.72)",
  },
  distanceText: { color: "#FFFFFF", fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  tagRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
  },
  tagText: { fontSize: 11, color: "#0369A1", fontFamily: Font.semiBold, includeFontPadding: false },
  tagAlt: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#D6E0F5",
  },
  tagTextAlt: { fontSize: 11, color: "#2B4E93", fontFamily: Font.semiBold, includeFontPadding: false },
  placeActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  placeActionsSingle: {
    alignItems: "flex-start",
    marginTop: 4,
  },
  placeActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  placeActionGhost: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  placeActionGhostText: { color: Pastel.text, fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  placeActionPrimary: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2B4E93",
  },
  placeActionPrimaryText: { color: "#F8FAFC", fontSize: 12, fontFamily: Font.extraBold, includeFontPadding: false },
  placeActionSecondary: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Pastel.surfaceAlt,
  },
  placeActionSecondaryText: {
    color: Pastel.text,
    fontSize: 12,
    fontFamily: Font.extraBold,
    includeFontPadding: false,
  },
  activityListingRow: { gap: 12, paddingVertical: 4, paddingRight: 10 },
  activityListingWrap: { position: "relative" },
  activityVenueCard: {
    borderRadius: 14,
    backgroundColor: "transparent",
    gap: 8,
  },
  activityCarouselWrap: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  activityCarouselSlide: {},
  activityCarouselImage: { width: "100%", height: "100%" },
  activityCarouselDots: {
    position: "absolute",
    bottom: 10,
    left: 12,
    flexDirection: "row",
    gap: 6,
  },
  activityCarouselDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  activityCarouselDotActive: {
    backgroundColor: "#FFFFFF",
  },
  activityVenueInfo: { gap: 4, paddingHorizontal: 2, paddingBottom: 4 },
  activityVenueName: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  activityVenueMeta: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  venueServiceTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  venueServiceTag: {
    backgroundColor: "#F0FDF4",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  venueServiceTagText: { fontSize: 10, fontFamily: Font.semiBold, color: "#16A34A", includeFontPadding: false },
  activityListArrow: {
    position: "absolute",
    right: 0,
    top: "40%",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#0B0B12",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  eventImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  eventImage: { width: "100%", height: "100%" },
  eventFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventInfo: { flex: 1, gap: 2 },
  eventName: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  eventMeta: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },
  eventTime: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#D6E0F5",
  },
  eventTimeText: { fontSize: 11, color: "#2B4E93", fontFamily: Font.bold, includeFontPadding: false },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: Pastel.border,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  resultIconAlt: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#D6E0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: 14, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  resultMeta: { fontSize: 12, color: Pastel.textMuted, includeFontPadding: false },

  // Mood system
  moodHeaderTitle: {
    fontSize: 16,
    fontFamily: Font.bold,
    color: Pastel.text,
    marginBottom: 10,
    textAlign: "center",
    includeFontPadding: false,
  },
  moodPillsRow: {
    gap: 8,
    paddingBottom: 10,
    paddingRight: 10,
  },
  moodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  moodPillActive: {
    backgroundColor: Pastel.primary,
  },
  moodPillEmoji: { fontSize: 16, includeFontPadding: false },
  moodPillText: { fontSize: 13, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  moodPillTextActive: { color: "#FFFFFF" },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionSeeAll: { fontSize: 12, color: Pastel.text, fontFamily: Font.bold, includeFontPadding: false },

  // Activity pills (section 2)
  activityPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Pastel.surface,
    borderWidth: 1,
    borderColor: Pastel.border,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  activityPillActive: {
    backgroundColor: Pastel.primary,
    borderColor: Pastel.primary,
  },
  activityPillText: { fontSize: 12, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  activityPillTextActive: { color: "#FFFFFF" },

  // Venue card (horizontal scroll, section 3)
  venueCardHorizontal: {
    width: 200,
    borderRadius: 20,
    backgroundColor: Pastel.surface,
    overflow: "hidden",
    shadowColor: "#0B0B12",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  venueCardImage: {
    width: "100%",
    height: 120,
    backgroundColor: Pastel.surfaceAlt,
  },
  venueCardInfo: {
    padding: 10,
    gap: 4,
  },
  venueCardActivities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },

  // Event card (horizontal scroll, section 4)
  eventCardHorizontal: {
    width: 180,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  eventCardOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  // Suggestion banner (section 1)
  suggestionBanner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#D6E0F5",
    borderWidth: 1,
    borderColor: "#B9CCEF",
  },
  suggestionBannerText: {
    fontSize: 14,
    fontFamily: Font.semiBold,
    color: "#2B4E93",
    includeFontPadding: false,
  },

  // Airbnb redesign
  airbnbSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  airbnbSectionTitle: {
    fontSize: 20,
    fontFamily: Font.extraBold,
    color: Pastel.primary,
    includeFontPadding: false,
  },
  airbnbSeeAll: {
    fontSize: 14,
    fontFamily: Font.semiBold,
    color: Pastel.primary,
    includeFontPadding: false,
  },
  airbnbVenueCard: {
    width: 260,
    marginRight: 14,
    backgroundColor: Pastel.surface,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: "hidden",
  },
  airbnbCarouselWrap: {
    width: 260,
    height: 160,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    backgroundColor: Pastel.surfaceAlt,
  },
  airbnbEventCard: {
    width: 260,
    backgroundColor: Pastel.surface,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: "hidden",
  },
  airbnbEventImage: {
    width: 260,
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  airbnbCardInfo: {
    padding: 12,
    gap: 3,
  },
  airbnbCardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  airbnbCardTitle: {
    fontSize: 15,
    fontFamily: Font.bold,
    color: Pastel.text,
    includeFontPadding: false,
  },
  airbnbCardMeta: {
    fontSize: 13,
    color: Pastel.textMuted,
    includeFontPadding: false,
  },

  // Results header (when activity selected)
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  resultsHeaderText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Font.bold,
    color: Pastel.text,
    includeFontPadding: false,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Pastel.surfaceAlt,
  },
  resetButtonText: {
    fontSize: 12,
    fontFamily: Font.bold,
    color: Pastel.text,
    includeFontPadding: false,
  },
});





















































































