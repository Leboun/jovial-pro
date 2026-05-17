import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PortalRequest = {
  venueId: number;
  returnUrl: string;
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

  let payload: PortalRequest;
  try {
    payload = (await req.json()) as PortalRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { venueId, returnUrl } = payload;
  if (!venueId || !returnUrl) {
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
    .select("id, owner_user_id")
    .eq("id", venueId)
    .maybeSingle();

  if (!venue || venue.owner_user_id !== user.id) {
    return new Response("Venue not found", { status: 404 });
  }

  const { data: sub } = await admin
    .from("establishment_subscriptions")
    .select("stripe_customer_id")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return new Response("No Stripe customer for venue", { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  });

  return Response.json({ url: session.url });
});
