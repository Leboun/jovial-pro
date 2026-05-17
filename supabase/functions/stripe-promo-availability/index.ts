import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";

type PromoRequest = {
  codes: string[];
};

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!stripeSecretKey) {
    return new Response("Missing server configuration", { status: 500 });
  }

  let payload: PromoRequest;
  try {
    payload = (await req.json()) as PromoRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const codes = (payload.codes ?? [])
    .map((code) => String(code ?? "").trim())
    .filter(Boolean);
  if (codes.length === 0) {
    return Response.json({ promos: [] });
  }

  const promos = [];
  for (const code of codes) {
    const list = await stripe.promotionCodes.list({ code, limit: 1 });
    const promo = list.data[0];
    if (!promo) {
      promos.push({
        code,
        active: false,
        max_redemptions: null,
        times_redeemed: null,
        remaining: null,
        promotion_code_id: null,
      });
      continue;
    }

    const maxRedemptions = promo.max_redemptions ?? null;
    const timesRedeemed = promo.times_redeemed ?? null;
    const remaining =
      maxRedemptions != null && timesRedeemed != null
        ? Math.max(0, maxRedemptions - timesRedeemed)
        : null;

    promos.push({
      code,
      active: promo.active,
      max_redemptions: maxRedemptions,
      times_redeemed: timesRedeemed,
      remaining,
      promotion_code_id: promo.id,
    });
  }

  return Response.json({ promos });
});
