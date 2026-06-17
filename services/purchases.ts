import { Platform } from "react-native";

// Cles publiques RevenueCat (a coller dans les variables d'env quand le compte sera pret).
// Tant qu'elles sont vides OU que le module natif n'est pas dans le build, tout degrade
// proprement (aucun crash) -> l'app retombe sur l'ancien comportement.
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";

export const PREMIUM_ENTITLEMENT = "premium";

let Purchases: any = null;
let configured = false;

// Chargement paresseux + protege : si le module natif n'est pas present dans le build
// installe (ex: ancien build OTA), require() renvoie null au lieu de crasher.
function loadSDK(): any {
  if (Purchases) return Purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Purchases = require("react-native-purchases").default;
  } catch {
    Purchases = null;
  }
  return Purchases;
}

function apiKey(): string {
  return Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
}

// Vrai si l'utilisateur a un abonnement actif. On accepte l'entitlement "premium"
// OU n'importe quel entitlement actif (Jovial n'en a qu'un) -> robuste quel que soit
// le nom donne a l'entitlement dans RevenueCat.
function hasActiveEntitlement(customerInfo: any): boolean {
  const active = customerInfo?.entitlements?.active ?? {};
  return !!active[PREMIUM_ENTITLEMENT] || Object.keys(active).length > 0;
}

/** Vrai uniquement si une cle est definie ET le SDK natif est disponible. */
export function isPurchasesReady(): boolean {
  return !!apiKey() && !!loadSDK();
}

/** A appeler au lancement (apres login) pour identifier l'utilisateur. */
export async function configurePurchases(userId: string | null): Promise<void> {
  if (Platform.OS === "web") return;
  const P = loadSDK();
  if (!P || !apiKey()) return;
  try {
    if (!configured) {
      P.configure({ apiKey: apiKey(), appUserID: userId ?? undefined });
      configured = true;
    } else if (userId) {
      await P.logIn(userId);
    }
  } catch {
    /* SDK natif absent (ancien build) -> on ignore */
  }
}

/** Recupere les offres (packages) de l'offering courant configure dans RevenueCat. */
export async function getOfferingPackages(): Promise<any[]> {
  const P = loadSDK();
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    return offerings?.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

/** Lance l'achat d'un package. */
export async function purchasePackage(
  pkg: any
): Promise<{ ok: boolean; premium: boolean; cancelled?: boolean; error?: string }> {
  const P = loadSDK();
  if (!P || !pkg) return { ok: false, premium: false, error: "Service indisponible" };
  try {
    const { customerInfo } = await P.purchasePackage(pkg);
    return { ok: true, premium: hasActiveEntitlement(customerInfo) };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, premium: false, cancelled: true };
    return { ok: false, premium: false, error: String(e?.message ?? e) };
  }
}

/** Restaure les achats (obligatoire cote Apple). */
export async function restorePurchases(): Promise<boolean> {
  const P = loadSDK();
  if (!P) return false;
  try {
    const info = await P.restorePurchases();
    return hasActiveEntitlement(info);
  } catch {
    return false;
  }
}

/**
 * Statut premium d'apres RevenueCat.
 * Retourne null si on ne peut pas savoir (SDK indispo / non configure) ->
 * l'appelant fait alors un fallback (ex: verif Supabase).
 */
export async function checkPremiumEntitlement(): Promise<boolean | null> {
  const P = loadSDK();
  if (!P || !isPurchasesReady()) return null;
  try {
    const info = await P.getCustomerInfo();
    return hasActiveEntitlement(info);
  } catch {
    return null;
  }
}
