import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

type Payload = {
  reservation_id: number;
};

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} à ${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
};

const formatPrice = (cents: number, currency: string) => {
  if (!cents) return "Gratuit";
  return (cents / 100).toFixed(2).replace(".", ",") + " " + (currency === "EUR" ? "€" : currency);
};

serve(async (req) => {
  try {
    const payload: Payload = await req.json();
    const { reservation_id } = payload;
    if (!reservation_id) return new Response("missing reservation_id", { status: 400 });

    // Fetch reservation with venue and game info
    const { data: res, error: resError } = await supabase
      .from("reservations")
      .select(`
        id, starts_at, ends_at, created_at,
        contact_firstname, contact_lastname, contact_phone, contact_email,
        group_size, price_cents, currency, payment_status, status,
        games(name),
        venues(id, name, address, owner_user_id)
      `)
      .eq("id", reservation_id)
      .maybeSingle();

    if (resError || !res) return new Response("reservation not found", { status: 404 });

    const venue = res.venues as { id: number; name: string; address: string | null; owner_user_id: string | null } | null;
    const game = res.games as { name: string | null } | null;

    if (!venue?.owner_user_id) return new Response("no venue owner", { status: 200 });

    // Get owner email from auth.users
    const { data: userData } = await supabase.auth.admin.getUserById(venue.owner_user_id);
    const ownerEmail = userData?.user?.email ?? null;
    if (!ownerEmail) return new Response("no owner email", { status: 200 });

    const clientName = [res.contact_firstname, res.contact_lastname].filter(Boolean).join(" ") || "Client";
    const activity = game?.name ?? "Activité";
    const isCancelled = res.status === "cancelled";
    const subject = isCancelled
      ? `❌ Annulation — ${clientName} · ${activity}`
      : `🎉 Nouvelle réservation — ${clientName} · ${activity}`;

    const html = isCancelled ? `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #DC2626;">Réservation annulée</h2>
        <p><strong>${clientName}</strong> a annulé sa réservation pour <strong>${activity}</strong>.</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 8px; color: #6B7280;">Créneau</td><td style="padding: 8px;">${formatTime(res.starts_at)}</td></tr>
          ${res.contact_phone ? `<tr><td style="padding: 8px; color: #6B7280;">Téléphone</td><td style="padding: 8px;">${res.contact_phone}</td></tr>` : ""}
        </table>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">Jovial Pro · ${venue.name}</p>
      </div>
    ` : `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #059669;">Nouvelle réservation reçue !</h2>
        <p>Bonne nouvelle — <strong>${clientName}</strong> a réservé <strong>${activity}</strong> dans votre établissement.</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 16px; background: #F9FAFB; border-radius: 8px;">
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 14px; color: #6B7280; font-size: 13px;">Activité</td>
            <td style="padding: 10px 14px; font-weight: 700;">${activity}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 14px; color: #6B7280; font-size: 13px;">Créneau</td>
            <td style="padding: 10px 14px; font-weight: 700;">${formatTime(res.starts_at)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 14px; color: #6B7280; font-size: 13px;">Client</td>
            <td style="padding: 10px 14px;">${clientName}</td>
          </tr>
          ${res.contact_phone ? `<tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 14px; color: #6B7280; font-size: 13px;">Téléphone</td><td style="padding: 10px 14px;"><a href="tel:${res.contact_phone}" style="color: #6366F1;">${res.contact_phone}</a></td></tr>` : ""}
          ${res.contact_email ? `<tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 14px; color: #6B7280; font-size: 13px;">Email</td><td style="padding: 10px 14px;">${res.contact_email}</td></tr>` : ""}
          ${res.group_size ? `<tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 14px; color: #6B7280; font-size: 13px;">Groupe</td><td style="padding: 10px 14px;">${res.group_size} personne${res.group_size > 1 ? "s" : ""}</td></tr>` : ""}
          <tr>
            <td style="padding: 10px 14px; color: #6B7280; font-size: 13px;">Montant</td>
            <td style="padding: 10px 14px;">${formatPrice(res.price_cents ?? 0, res.currency ?? "EUR")} ${res.payment_status === "paid" ? "✓ Payé" : "· Paiement en attente"}</td>
          </tr>
        </table>
        <div style="margin-top: 24px; padding: 14px; background: #FFF7ED; border-radius: 8px; border-left: 3px solid #F59E0B;">
          <p style="margin: 0; font-size: 13px; color: #92400E;">💡 En cas de changement de dernière minute, vous pouvez contacter directement le client par téléphone ou email.</p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">Jovial Pro · ${venue.name}</p>
      </div>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Jovial Pro <notifications@getjovial.fr>",
        to: [ownerEmail],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return new Response("email failed", { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("internal error", { status: 500 });
  }
});
