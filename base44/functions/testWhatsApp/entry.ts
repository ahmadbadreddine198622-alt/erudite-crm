import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '971581806000',
      type: 'text',
      text: { body: '✅ Erudite Property CRM — WhatsApp test successful! 🎉 Aurora Pipeline is live.' }
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
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
      meta_response: result,
      phone_id_used: phoneNumberId,
      token_preview: accessToken?.slice(0, 20) + '...'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});