Deno.serve(async (req) => {
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const metaVerifyToken = Deno.env.get("META_VERIFY_TOKEN");
  const metaWebhookSecret = Deno.env.get("META_WEBHOOK_SECRET");

  return Response.json({
    WHATSAPP_PHONE_NUMBER_ID: phoneId ? "✅ SET" : "❌ MISSING",
    WHATSAPP_ACCESS_TOKEN: token ? "✅ SET" : "❌ MISSING",
    WHATSAPP_VERIFY_TOKEN: verifyToken ? "✅ SET" : "❌ MISSING",
    META_VERIFY_TOKEN: metaVerifyToken ? "✅ SET" : "❌ MISSING",
    META_WEBHOOK_SECRET: metaWebhookSecret ? "✅ SET" : "❌ MISSING",
    phone_id_length: phoneId?.length || 0,
    token_length: token?.length || 0,
    verify_token_length: verifyToken?.length || 0,
    meta_verify_token_length: metaVerifyToken?.length || 0,
    meta_webhook_secret_length: metaWebhookSecret?.length || 0,
  });
});