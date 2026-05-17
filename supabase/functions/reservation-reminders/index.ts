import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const expoEndpoint = "https://exp.host/--/api/v2/push/send";

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const sendPushNotifications = async (messages: ExpoMessage[]) => {
  if (messages.length === 0) return;
  const batches = chunk(messages, 100);
  for (const batch of batches) {
    await fetch(expoEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify(batch),
    });
  }
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
};

serve(async () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response("Missing server configuration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const now = new Date();

  // ── Rappel J-1 à 18h ──────────────────────────────────────────────
  // On cherche les réservations qui commencent demain (entre 00h et 23h59)
  // et on ne les envoie que si l'heure actuelle est entre 18h00 et 18h59
  const messages: ExpoMessage[] = [];

  if (now.getUTCHours() === 17) { // 17h UTC = 18h Paris (heure été) — ajuste si besoin
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    const { data: tomorrowReservations } = await supabase
      .from("reservations")
      .select(`
        id, starts_at, user_id,
        games(name),
        venues(name),
        profiles!reservations_user_id_fkey(expo_push_token)
      `)
      .neq("status", "cancelled")
      .gte("starts_at", tomorrow.toISOString())
      .lte("starts_at", tomorrowEnd.toISOString());

    for (const res of (tomorrowReservations ?? [])) {
      const token = (res.profiles as { expo_push_token?: string | null } | null)?.expo_push_token;
      if (!token || !token.startsWith("ExponentPushToken")) continue;
      const activity = (res.games as { name?: string } | null)?.name ?? "ton activité";
      const venue = (res.venues as { name?: string } | null)?.name ?? "l'établissement";
      const time = formatTime(res.starts_at);
      messages.push({
        to: token,
        title: "📅 Rappel de réservation",
        body: `Demain à ${time} — ${activity} chez ${venue}. On t'attend !`,
        data: { reservation_id: res.id, type: "reminder_j1" },
      });
    }
  }

  // ── Rappel H-1 ────────────────────────────────────────────────────
  // On cherche les réservations qui commencent dans 55 à 65 minutes
  const inOneHourMin = new Date(now.getTime() + 55 * 60 * 1000);
  const inOneHourMax = new Date(now.getTime() + 65 * 60 * 1000);

  const { data: soonReservations } = await supabase
    .from("reservations")
    .select(`
      id, starts_at, user_id,
      games(name),
      venues(name),
      profiles!reservations_user_id_fkey(expo_push_token)
    `)
    .neq("status", "cancelled")
    .gte("starts_at", inOneHourMin.toISOString())
    .lte("starts_at", inOneHourMax.toISOString());

  for (const res of (soonReservations ?? [])) {
    const token = (res.profiles as { expo_push_token?: string | null } | null)?.expo_push_token;
    if (!token || !token.startsWith("ExponentPushToken")) continue;
    const activity = (res.games as { name?: string } | null)?.name ?? "ton activité";
    const venue = (res.venues as { name?: string } | null)?.name ?? "l'établissement";
    const time = formatTime(res.starts_at);
    messages.push({
      to: token,
      title: "⏰ C'est dans 1h !",
      body: `${activity} à ${time} chez ${venue}. À tout de suite !`,
      data: { reservation_id: res.id, type: "reminder_h1" },
    });
  }

  await sendPushNotifications(messages);

  return new Response(
    JSON.stringify({ ok: true, sent: messages.length, timestamp: now.toISOString() }),
    { headers: { "Content-Type": "application/json" } }
  );
});
