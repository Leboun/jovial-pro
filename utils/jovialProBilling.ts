import type { JovialProOfferKey } from "@/constants/jovialPro";

export type PlanCodeDB = "visibilite" | "rayonnement" | "pro";

export const OFFER_TO_PLAN_CODE: Record<JovialProOfferKey, PlanCodeDB> = {
  visibilite: "visibilite",
  rayonnement: "rayonnement",
  pro: "pro",
};

export function planCodeToOfferKey(planCode?: string | null): JovialProOfferKey | null {
  if (planCode === "visibilite") return "visibilite";
  if (planCode === "rayonnement") return "rayonnement";
  if (planCode === "pro") return "pro";
  return null;
}
