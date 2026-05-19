import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "noreply@getjovial.fr";
const FROM_NAME = "Jovial Pro";
const SUPABASE_URL = "https://luwspwiibxzzjvbtklbo.supabase.co";

Deno.serve(async (req) => {
  const bodyText = await req.text();
  const payload = JSON.parse(bodyText);

  const email = payload.user?.email ?? payload.email;
  const emailData = payload.email_data ?? {};
  const emailAction = emailData.email_action_type ?? "signup";
  const tokenHash = emailData.token_hash ?? emailData.token;
  const redirectTo = emailData.redirect_to ?? "https://pro.getjovial.fr";

  if (!email || !tokenHash) {
    return new Response(JSON.stringify({ error: "Missing email or token" }), { status: 400 });
  }

  const type = emailAction === "recovery" ? "recovery" : "signup";
  const confirmationUrl = `${SUPABASE_URL}/auth/v1/verify?token=${tokenHash}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;

  let subject = "Confirmez votre compte Jovial Pro";
  let html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px;">
      <div style="background: #2B4E93; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="color: white; font-size: 28px; font-weight: 900; letter-spacing: -1px;">Jovial Pro</span>
      </div>
      <h2 style="color: #111827; font-size: 22px; font-weight: 800;">Confirmez votre adresse e-mail</h2>
      <p style="color: #6B7280; font-size: 15px; line-height: 1.6;">
        Cliquez sur le bouton ci-dessous pour activer votre compte Jovial Pro.
      </p>
      <a href="${confirmationUrl}" style="display: inline-block; background: #2B4E93; color: white; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin: 24px 0;">
        Confirmer mon compte →
      </a>
      <p style="color: #9CA3AF; font-size: 13px;">
        Si vous n'avez pas créé de compte, ignorez cet e-mail.
      </p>
    </div>
  `;

  if (emailAction === "recovery") {
    subject = "Réinitialisez votre mot de passe Jovial Pro";
    html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px;">
        <div style="background: #2B4E93; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="color: white; font-size: 28px; font-weight: 900; letter-spacing: -1px;">Jovial Pro</span>
        </div>
        <h2 style="color: #111827; font-size: 22px; font-weight: 800;">Réinitialisez votre mot de passe</h2>
        <p style="color: #6B7280; font-size: 15px; line-height: 1.6;">
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </p>
        <a href="${confirmationUrl}" style="display: inline-block; background: #2B4E93; color: white; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin: 24px 0;">
          Réinitialiser mon mot de passe →
        </a>
        <p style="color: #9CA3AF; font-size: 13px;">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.
        </p>
      </div>
    `;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
