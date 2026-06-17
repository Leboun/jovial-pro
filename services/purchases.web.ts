// Stub web : RevenueCat (react-native-purchases) n'est pas utilise sur le web.
// Memes signatures que purchases.ts pour que l'import fonctionne partout.

export const PREMIUM_ENTITLEMENT = "premium";

export function isPurchasesReady(): boolean {
  return false;
}

export async function configurePurchases(_userId: string | null): Promise<void> {
  /* no-op sur web */
}

export async function getOfferingPackages(): Promise<any[]> {
  return [];
}

export async function purchasePackage(
  _pkg: any
): Promise<{ ok: boolean; premium: boolean; cancelled?: boolean; error?: string }> {
  return { ok: false, premium: false, error: "Indisponible sur le web" };
}

export async function restorePurchases(): Promise<boolean> {
  return false;
}

export async function checkPremiumEntitlement(): Promise<boolean | null> {
  return null;
}
