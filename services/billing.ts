import { supabase } from "@/services/supabase";

type CheckoutSessionParams = {
  venueId: number;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  promotionCodeId?: string | null;
};

type PortalSessionParams = {
  venueId: number;
  returnUrl: string;
};

export async function createCheckoutSession(params: CheckoutSessionParams) {
  const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
    body: params,
  });
  if (error) {
    console.error("Billing checkout error", error);
    throw error;
  }
  return data as { url: string } | null;
}

export async function createCustomerPortalSession(params: PortalSessionParams) {
  const { data, error } = await supabase.functions.invoke("stripe-create-portal", {
    body: params,
  });
  if (error) {
    console.error("Billing portal error", error);
    throw error;
  }
  return data as { url: string } | null;
}

export async function fetchPromoAvailability(codes: string[]) {
  const { data, error } = await supabase.functions.invoke("stripe-promo-availability", {
    body: { codes },
  });
  if (error) {
    console.error("Billing promo availability error", error);
    throw error;
  }
  return data as
    | {
        promos: Array<{
          code: string;
          active: boolean;
          max_redemptions: number | null;
          times_redeemed: number | null;
          remaining: number | null;
          promotion_code_id: string | null;
        }>;
      }
    | null;
}
