import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { follower_id, following_id, status } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupère le token push et les préférences du destinataire
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("expo_push_token, firstname, push_events")
      .eq("user_id", following_id)
      .single();

    if (!targetProfile?.expo_push_token) {
      return new Response(JSON.stringify({ ok: true, skipped: "no token" }), { headers: corsHeaders });
    }
    if (targetProfile.push_events === false) {
      return new Response(JSON.stringify({ ok: true, skipped: "notifications disabled" }), { headers: corsHeaders });
    }

    // Récupère le prénom de celui qui suit
    const { data: followerProfile } = await supabase
      .from("profiles")
      .select("firstname, handle")
      .eq("user_id", follower_id)
      .single();

    const followerName = followerProfile?.firstname ?? followerProfile?.handle ?? "Quelqu'un";

    const title = status === "pending"
      ? "Nouvelle demande de suivi"
      : "Nouveau follower";

    const body = status === "pending"
      ? `${followerName} souhaite te suivre sur Jovial.`
      : `${followerName} a commencé à te suivre sur Jovial.`;

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        to: targetProfile.expo_push_token,
        title,
        body,
        data: { type: "follow", follower_id, status },
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
