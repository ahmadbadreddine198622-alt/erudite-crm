import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

    const response = await fetch('https://graph.facebook.com/v21.0/1166628083194563/register', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: '123456'
      })
    });

    const result = await response.json();

    return Response.json({
      status: response.status,
      ok: response.ok,
      meta_response: result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});