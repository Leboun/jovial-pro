import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { sender_id, receiver_id, message_preview } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Token push du destinataire
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("expo_push_token, firstname")
      .eq("user_id", receiver_id)
      .single();

    if (!targetProfile?.expo_push_token) {
      return new Response(JSON.stringify({ ok: true, skipped: "no token" }), { headers: corsHeaders });
    }

    // Prénom de l'expéditeur
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("firstname, handle")
      .eq("user_id", sender_id)
      .single();

    const senderName = senderProfile?.firstname ?? senderProfile?.handle ?? "Quelqu'un";
    const preview = message_preview?.slice(0, 60) ?? "Nouveau message";

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        to: targetProfile.expo_push_token,
        title: `💬 ${senderName}`,
        body: preview,
        data: { type: "message", sender_id },
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
