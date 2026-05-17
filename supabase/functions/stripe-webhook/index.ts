import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

const statusMap: Record<string, "active" | "past_due" | "canceled"> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "past_due",
  incomplete_expired: "canceled",
  canceled: "canceled",
  paused: "past_due",
};

async function resolvePlanCode(
  supabaseAdmin: ReturnType<typeof createClient>,
  priceId: string | null
) {
  if (!priceId) return null;
  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("code")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  return plan?.code ?? null;
}

async function syncSubscription(
  supabaseAdmin: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const metadata = subscription.metadata ?? {};
  const venueIdRaw = metadata.venue_id ?? "";
  const venueId = Number(venueIdRaw);
  if (!Number.isFinite(venueId) || venueId <= 0) {
    console.error("Missing venue_id metadata for subscription", subscription.id);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const productId =
    (subscription.items.data[0]?.price?.product as string | undefined) ?? null;
  const planCode =
    metadata.plan_code ||
    (await resolvePlanCode(supabaseAdmin, priceId)) ||
    "classic";

  const mappedStatus = statusMap[subscription.status] ?? "past_due";
  const currentPeriodEndAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from("establishment_subscriptions")
    .upsert(
      {
        venue_id: venueId,
        plan: planCode,
        status: mappedStatus,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        stripe_product_id: productId,
        current_period_end_at: currentPeriodEndAt,
      },
      { onConflict: "venue_id" }
    );
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return new Response("Missing server configuration", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature") ?? "";
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature error", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      await syncSubscription(supabaseAdmin, subscription);
    }
    return new Response("ok");
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    await syncSubscription(supabaseAdmin, subscription);
    return new Response("ok");
  }

  return new Response("ignored");
});
