import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    // Try both formats
    const body = await req.json().catch(() => ({}));
    const toNumber = body.to || '971581806000';

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber,
      type: 'text',
      text: { body: '✅ Erudite Property CRM — WhatsApp is LIVE! 🎉 Aurora Pipeline is connected and ready.' }
    };

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    return Response.json({
      status: response.status,
      ok: response.ok,
      to_number: toNumber,
      meta_response: result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});