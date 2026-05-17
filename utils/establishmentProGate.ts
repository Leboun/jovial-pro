import { getBackOfficeEstablishment, getSubscription } from "@/services/establishment";
import { canCreateEvent, getPlanCapabilities, type PlanCapabilities } from "@/utils/planFeatureGate";

export async function ensureEstablishmentFeatureAccess(opts: {
  userId: string;
  replace: (href: string) => void;
}): Promise<{ ok: boolean; venueId: number | null }> {
  const venue = await getBackOfficeEstablishment(opts.userId);
  if (!venue) {
    opts.replace("/establishment/offers");
    return { ok: false, venueId: null };
  }

  const sub = await getSubscription(venue.id);
  if (!sub || sub.status !== "active") {
    opts.replace("/establishment/offers");
    return { ok: false, venueId: null };
  }

  return { ok: true, venueId: venue.id };
}

export async function ensureEstablishmentWithPlan(opts: {
  userId: string;
  replace: (href: string) => void;
}): Promise<{
  ok: boolean;
  venueId: number | null;
  planCode: string | null;
  caps: PlanCapabilities | null;
}> {
  const venue = await getBackOfficeEstablishment(opts.userId);
  if (!venue) {
    opts.replace("/establishment/offers");
    return { ok: false, venueId: null, planCode: null, caps: null };
  }

  const sub = await getSubscription(venue.id);
  if (!sub || sub.status !== "active") {
    opts.replace("/establishment/offers");
    return { ok: false, venueId: null, planCode: null, caps: null };
  }

  const caps = getPlanCapabilities(sub.plan);
  return { ok: true, venueId: venue.id, planCode: sub.plan, caps };
}

export { canCreateEvent, getPlanCapabilities };
