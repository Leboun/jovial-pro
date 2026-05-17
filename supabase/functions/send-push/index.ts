const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to, title, body, data } = await req.json();
    if (!to) return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: corsHeaders });

    const tokens = Array.isArray(to) ? to : [to];
    const messages = tokens
      .filter((t: string) => t?.startsWith("ExponentPushToken"))
      .map((token: string) => ({ to: token, title, body, data: data ?? {}, sound: "default", badge: 1 }));

    if (messages.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: corsHeaders });

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(messages),
    });

    const result = await res.json();
    return new Response(JSON.stringify({ ok: true, result }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
