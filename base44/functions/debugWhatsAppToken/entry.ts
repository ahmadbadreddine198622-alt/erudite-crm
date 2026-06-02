import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    // 1. Debug the token via Meta's token introspection endpoint
    const tokenDebugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    );
    const tokenDebug = await tokenDebugRes.json();

    // 2. Check the phone number registration status
    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,account_mode,is_official_business_account`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const phoneData = await phoneRes.json();

    // 3. Try sending a real message and capture full raw response
    const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '971526330035',
        type: 'text',
        text: { body: 'Debug test from PropCRM' },
      }),
    });
    const sendRaw = await sendRes.text();

    return Response.json({
      token_info: {
        length: accessToken?.length,
        token_debug: tokenDebug?.data || tokenDebug,
        is_valid: tokenDebug?.data?.is_valid,
        expires_at: tokenDebug?.data?.expires_at
          ? new Date(tokenDebug.data.expires_at * 1000).toISOString()
          : 'never / unknown',
        app_name: tokenDebug?.data?.application,
        scopes: tokenDebug?.data?.scopes,
      },
      phone_number_status: phoneData,
      send_test: {
        http_status: sendRes.status,
        response: JSON.parse(sendRaw),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});