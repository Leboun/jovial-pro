export type PlanCode = "visibilite" | "rayonnement" | "pro";

export type PlanCapabilities = {
  tagsLimit: number;
  eventQuota: number | null; // null = illimité
  hasReminders: boolean;
  hasClubJovial: boolean;
  carouselBoostQuota: number; // "Top lieux" par an
  spotlightQuota: number;     // Explore 24h par an
  targetedNotificationQuota: number; // Notification proximité par an
  hasAnalytics: boolean;
};

export const PLAN_CAPABILITIES: Record<PlanCode, PlanCapabilities> = {
  visibilite: {
    tagsLimit: 1,
    eventQuota: 4,
    hasReminders: false,
    hasClubJovial: false,
    carouselBoostQuota: 0,
    spotlightQuota: 0,
    targetedNotificationQuota: 0,
    hasAnalytics: false,
  },
  rayonnement: {
    tagsLimit: 2,
    eventQuota: null,
    hasReminders: true,
    hasClubJovial: true,
    carouselBoostQuota: 2,
    spotlightQuota: 1,
    targetedNotificationQuota: 0,
    hasAnalytics: false,
  },
  pro: {
    tagsLimit: 3,
    eventQuota: null,
    hasReminders: true,
    hasClubJovial: true,
    carouselBoostQuota: 6,
    spotlightQuota: 12,
    targetedNotificationQuota: 1,
    hasAnalytics: true,
  },
};

export function getPlanCapabilities(planCode: string | null | undefined): PlanCapabilities | null {
  if (!planCode) return null;
  return PLAN_CAPABILITIES[planCode as PlanCode] ?? null;
}

export function canCreateEvent(sub: {
  plan: string;
  status: string;
  events_used_year: number;
} | null | undefined): boolean {
  if (!sub || sub.status !== "active") return false;
  const caps = getPlanCapabilities(sub.plan);
  if (!caps) return false;
  if (caps.eventQuota === null) return true;
  return sub.events_used_year < caps.eventQuota;
}

export function getRemainingEvents(sub: {
  plan: string;
  status: string;
  events_used_year: number;
} | null | undefined): number | null {
  if (!sub || sub.status !== "active") return null;
  const caps = getPlanCapabilities(sub.plan);
  if (!caps) return null;
  if (caps.eventQuota === null) return null; // null = illimité
  return Math.max(0, caps.eventQuota - sub.events_used_year);
}

export function planHasFeature(
  planCode: string | null | undefined,
  feature: keyof Pick<
    PlanCapabilities,
    "hasReminders" | "hasClubJovial" | "hasAnalytics"
  >
): boolean {
  const caps = getPlanCapabilities(planCode);
  if (!caps) return false;
  return caps[feature];
}

export function subscriptionHasFeature(
  sub: { plan: string; status: string } | null | undefined,
  feature: keyof Pick<
    PlanCapabilities,
    "hasReminders" | "hasClubJovial" | "hasAnalytics"
  >
): boolean {
  if (!sub || sub.status !== "active") return false;
  return planHasFeature(sub.plan, feature);
}
