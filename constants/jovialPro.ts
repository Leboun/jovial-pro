export type JovialProOfferKey = "visibilite" | "rayonnement" | "pro";

export type JovialProOffer = {
  key: JovialProOfferKey;
  name: string;
  annualPrice: number;
  monthlyPrice: number;
  shortLabel: string;
  summary: string;
  recommended?: boolean;
  primaryCta: string;
  features: string[];
};

export const JOVIAL_PRO_OFFERS: JovialProOffer[] = [
  {
    key: "visibilite",
    name: "Offre Visibilité",
    annualPrice: 290,
    monthlyPrice: 29.99,
    shortLabel: "Présence essentielle",
    summary:
      "Pour être présent sur Jovial, afficher ta fiche et publier jusqu'à 4 événements par an.",
    primaryCta: "Choisir Visibilité",
    features: [
      "Fiche établissement complète (photos, horaires, réseaux sociaux)",
      "Apparition sur la carte interactive et les recherches Jovial",
      "1 tag d'activité mis en avant",
      "4 événements par an dans l'agenda Jovial",
      "Gestion des réservations sur Jovial Pro",
      "Avantages exclusifs pour les membres Premium Jovial",
      "Kit de communication inclus",
    ],
  },
  {
    key: "rayonnement",
    name: "Offre Rayonnement",
    annualPrice: 490,
    monthlyPrice: 49.99,
    shortLabel: "Animation locale",
    summary:
      "Pour animer régulièrement ton établissement, engager ta communauté et gagner en visibilité locale.",
    recommended: true,
    primaryCta: "Choisir Rayonnement",
    features: [
      "2 tags d'activités mis en avant",
      "Événements illimités dans l'agenda Jovial",
      "Rappels automatiques J-1 et H-1 (réservations & événements)",
      "Accès et animation du Club Jovial",
      "2 passages dans le carrousel Top lieux par an",
      "1 boost Explore (24h dans ta zone) par an",
      "Kit de communication inclus",
    ],
  },
  {
    key: "pro",
    name: "Offre Pro",
    annualPrice: 790,
    monthlyPrice: 79.99,
    shortLabel: "Pilotage complet",
    summary:
      "Pour piloter ta présence, tes réservations et tes prises de parole avec les outils les plus complets.",
    primaryCta: "Choisir Pro",
    features: [
      "3 tags d'activités mis en avant",
      "Événements illimités + rappels automatiques J-1 et H-1",
      "Club Jovial avec administration complète",
      "6 passages dans le carrousel Top lieux par an",
      "1 boost Explore (24h dans ta zone) par mois",
      "1 notification de proximité ciblée par an (accord utilisateurs)",
      "Reporting analytique sur demande (visibilité, interactions, participation)",
    ],
  },
];

export function formatOfferPrice(value: number) {
  return `${value.toString().replace(".", ",")} EUR/an`;
}

export function getOfferByKey(key?: string | null) {
  return JOVIAL_PRO_OFFERS.find((offer) => offer.key === key) ?? null;
}

export function resolveOfferKey(params: {
  requestedOffer?: string | null;
  plan?: string | null;
}): JovialProOfferKey {
  if (params.requestedOffer === "visibilite" || params.plan === "visibilite") return "visibilite";
  if (params.requestedOffer === "rayonnement" || params.plan === "rayonnement") return "rayonnement";
  if (params.requestedOffer === "pro" || params.plan === "pro") return "pro";
  return "visibilite";
}
