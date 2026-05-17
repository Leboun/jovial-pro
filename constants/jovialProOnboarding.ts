/**
 * Nombre de mois d'essai gratuits pour les nouveaux établissements Jovial Pro.
 * À ajuster côté Stripe / facturation en production ; ici c'est l'affichage et la doc produit.
 */
const parsed = Number.parseInt(process.env.EXPO_PUBLIC_JOVIAL_PRO_TRIAL_MONTHS ?? "3", 10);
export const JOVIAL_PRO_FREE_TRIAL_MONTHS = Number.isFinite(parsed) && parsed > 0 ? parsed : 3;

/** Valeurs réservées à l’établissement « brouillon » créé avant le choix d’offre / paiement. */
export const STUB_ESTABLISHMENT_NAME = "Mon établissement";
export const STUB_ESTABLISHMENT_CITY = "À compléter";
