import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response("Missing server configuration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const payload = await req.json().catch(() => ({}));
  const blackoutId = Number(payload?.blackout_id);
  if (!Number.isFinite(blackoutId)) {
    return new Response("Missing blackout_id", { status: 400 });
  }

  const { data: blackout } = await supabase
    .from("venue_game_blackouts")
    .select("id, venue_id, game_id, starts_at, ends_at, reason")
    .eq("id", blackoutId)
    .maybeSingle();

  if (!blackout) {
    return new Response("Blackout not found", { status: 404 });
  }

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, user_id, starts_at, ends_at")
    .eq("venue_id", blackout.venue_id)
    .eq("game_id", blackout.game_id)
    .lt("starts_at", blackout.ends_at)
    .gt("ends_at", blackout.starts_at);

  const toCancel = (reservations as any[] | null) ?? [];
  if (toCancel.length === 0) {
    return new Response(JSON.stringify({ cancelled: 0 }), { status: 200 });
  }

  const ids = toCancel.map((item) => item.id);
  await supabase
    .from("reservations")
    .update({
      status: "cancelled_by_venue",
      cancelled_reason: blackout.reason ?? null,
      cancelled_at: new Date().toISOString(),
    })
    .in("id", ids);

  const userIds = Array.from(new Set(toCancel.map((item) => item.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ cancelled: ids.length }), { status: 200 });
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token, user_id")
    .in("user_id", userIds);

  const tokenList = (tokens as any[] | null) ?? [];
  if (tokenList.length === 0) {
    return new Response(JSON.stringify({ cancelled: ids.length, notified: 0 }), { status: 200 });
  }

  const reasonText = blackout.reason ? `Motif : ${blackout.reason}` : "Une raison specifique a ete indiquee.";
  const messages: PushMessage[] = tokenList.map((row) => ({
    to: row.token,
    title: "Reservation annulee",
    body: `Votre reservation a ete annulee par l'etablissement. ${reasonText}`,
    data: { type: "booking_cancelled", blackout_id: blackout.id },
  }));

  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  return new Response(JSON.stringify({ cancelled: ids.length, notified: messages.length }), {
    status: 200,
  });
});
