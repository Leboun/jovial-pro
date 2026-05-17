import { supabase } from "./supabase";

export type PerkFrequency = "per_visit" | "weekly" | "biweekly" | "monthly";

export type VenuePerk = {
  id: number;
  venue_id: number;
  title: string;
  description: string | null;
  frequency: PerkFrequency;
  is_active: boolean;
  created_at: string;
};

export type PerkRedemption = {
  id: number;
  perk_id: number;
  user_id: string;
  venue_id: number;
  redeemed_at: string;
  validated_at: string | null;
  status: "pending" | "validated";
};

export const PERK_FREQUENCY_LABELS: Record<PerkFrequency, string> = {
  per_visit: "1 fois par visite (24h)",
  weekly: "1 fois par semaine",
  biweekly: "1 fois toutes les 2 semaines",
  monthly: "1 fois par mois",
};

const FREQUENCY_WINDOW_MS: Record<PerkFrequency, number> = {
  per_visit: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

function mapPerkRow(row: any): VenuePerk {
  return {
    id: Number(row.id),
    venue_id: Number(row.venue_id),
    title: String(row.title ?? ""),
    description: row.description ?? null,
    frequency: row.frequency as PerkFrequency,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

export async function fetchVenuePerks(venueId: number): Promise<VenuePerk[]> {
  const { data, error } = await supabase
    .from("venue_perks")
    .select("*")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[] | null) ?? []).map(mapPerkRow);
}

export async function fetchActiveVenuePerks(venueId: number): Promise<VenuePerk[]> {
  const { data, error } = await supabase
    .from("venue_perks")
    .select("*")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[] | null) ?? []).map(mapPerkRow);
}

export async function upsertVenuePerk(params: {
  perkId?: number | null;
  venueId: number;
  title: string;
  description: string | null;
  frequency: PerkFrequency;
  isActive: boolean;
}): Promise<void> {
  const payload = {
    venue_id: params.venueId,
    title: params.title.trim(),
    description: params.description?.trim() || null,
    frequency: params.frequency,
    is_active: params.isActive,
  };
  if (params.perkId) {
    const { error } = await supabase.from("venue_perks").update(payload).eq("id", params.perkId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("venue_perks").insert(payload);
    if (error) throw error;
  }
}

export async function deleteVenuePerk(perkId: number): Promise<void> {
  const { error } = await supabase.from("venue_perks").delete().eq("id", perkId);
  if (error) throw error;
}

export async function toggleVenuePerkActive(perkId: number, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("venue_perks")
    .update({ is_active: isActive })
    .eq("id", perkId);
  if (error) throw error;
}

export async function checkPerkAvailability(
  perkId: number,
  userId: string,
  frequency: PerkFrequency
): Promise<{ available: boolean; nextAvailableAt: Date | null }> {
  const { data, error } = await supabase
    .from("perk_redemptions")
    .select("redeemed_at")
    .eq("perk_id", perkId)
    .eq("user_id", userId)
    .order("redeemed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { available: true, nextAvailableAt: null };

  const lastUsed = new Date((data as any).redeemed_at);
  const nextAvailableAt = new Date(lastUsed.getTime() + FREQUENCY_WINDOW_MS[frequency]);
  if (new Date() >= nextAvailableAt) return { available: true, nextAvailableAt: null };
  return { available: false, nextAvailableAt };
}

export async function redeemAndValidatePerk(
  perkId: number,
  venueId: number,
  userId: string
): Promise<PerkRedemption> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("perk_redemptions")
    .insert({
      perk_id: perkId,
      venue_id: venueId,
      user_id: userId,
      status: "validated",
      validated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  const row = data as any;
  return {
    id: Number(row.id),
    perk_id: Number(row.perk_id),
    user_id: String(row.user_id),
    venue_id: Number(row.venue_id),
    redeemed_at: String(row.redeemed_at),
    validated_at: row.validated_at ?? null,
    status: "validated",
  };
}

export async function fetchRecentRedemptions(
  venueId: number,
  limit = 30
): Promise<Array<PerkRedemption & { perk_title: string }>> {
  const { data, error } = await supabase
    .from("perk_redemptions")
    .select("*, venue_perks(title)")
    .eq("venue_id", venueId)
    .order("redeemed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as any[] | null) ?? []).map((row) => ({
    id: Number(row.id),
    perk_id: Number(row.perk_id),
    user_id: String(row.user_id),
    venue_id: Number(row.venue_id),
    redeemed_at: String(row.redeemed_at),
    validated_at: row.validated_at ?? null,
    status: row.status as "pending" | "validated",
    perk_title: String(row.venue_perks?.title ?? ""),
  }));
}

export async function isUserPremium(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean((data as any)?.is_premium);
}
