import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CheckoutRequest = {
  venueId: number;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  promotionCodeId?: string | null;
};

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response("Missing server configuration", { status: 500 });
  }

  let payload: CheckoutRequest;
  try {
    payload = (await req.json()) as CheckoutRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { venueId, priceId, successUrl, cancelUrl, promotionCodeId } = payload;
  if (!venueId || !priceId || !successUrl || !cancelUrl) {
    return new Response("Missing required fields", { status: 400 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: venue } = await supabase
    .from("venues")
    .select("id, owner_user_id, name")
    .eq("id", venueId)
    .maybeSingle();

  if (!venue || venue.owner_user_id !== user.id) {
    return new Response("Venue not found", { status: 404 });
  }

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("code, stripe_price_id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  const { data: existingSub } = await admin
    .from("establishment_subscriptions")
    .select("stripe_customer_id")
    .eq("venue_id", venueId)
    .maybeSingle();

  let customerId = existingSub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: venue.name ?? undefined,
      metadata: {
        venue_id: String(venueId),
        user_id: user.id,
      },
    });
    customerId = customer.id;
    await admin
      .from("establishment_subscriptions")
      .upsert(
        {
          venue_id: venueId,
          stripe_customer_id: customerId,
          status: "past_due",
          plan: "classic",
        },
        { onConflict: "venue_id" }
      );
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(venueId),
    subscription_data: {
      metadata: {
        venue_id: String(venueId),
        user_id: user.id,
        plan_code: plan?.code ?? "",
      },
    },
  };

  if (promotionCodeId) {
    sessionParams.discounts = [{ promotion_code: promotionCodeId }];
  } else {
    sessionParams.allow_promotion_codes = true;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return Response.json({ url: session.url });
});
