import { STUB_ESTABLISHMENT_CITY, STUB_ESTABLISHMENT_NAME } from "@/constants/jovialProOnboarding";
import type { EstablishmentProfile } from "@/services/establishment";
import type { OpeningHours } from "@/utils/openingHours";

export { STUB_ESTABLISHMENT_CITY, STUB_ESTABLISHMENT_NAME };

export function isStubEstablishment(profile: EstablishmentProfile | null): boolean {
  if (!profile) return false;
  const name = String(profile.name ?? "").trim();
  const city = String(profile.city ?? "").trim();
  return name === STUB_ESTABLISHMENT_NAME || city === STUB_ESTABLISHMENT_CITY;
}

export function isEstablishmentFicheComplete(profile: EstablishmentProfile | null): boolean {
  if (!profile) return false;
  if (isStubEstablishment(profile)) return false;

  const name = String(profile.name ?? "").trim();
  const city = String(profile.city ?? "").trim();
  const address = String(profile.address ?? "").trim();
  const contacts =
    String(profile.phone ?? "").trim() ||
    String(profile.website_url ?? "").trim() ||
    String(profile.instagram_url ?? "").trim();
  const oh = profile.opening_hours as OpeningHours | null;
  const hasHours = Boolean(oh && typeof oh === "object" && Object.keys(oh).length > 0);

  return Boolean(name && city && address && contacts && hasHours);
}
