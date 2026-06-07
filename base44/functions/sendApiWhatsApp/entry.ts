import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * sendApiWhatsApp — sends a WhatsApp message via the META CLOUD API channel (erudite).
 * 
 * Use this for ALL automated/system messages:
 *   - Internal operator reminders (sent to INTERNAL_WHATSAPP_NUMBER = +971581806000)
 *   - Follow-up automation notifications
 *   - Bulk or template-based sends
 *
 * This NEVER uses Ahmad's personal Evolution instance (erudite_whatsapp).
 * That instance is reserved for direct landlord/client conversations only.
 *
 * Body: { phone_e164, message, template_name?, template_language?, template_components?, template_body? }
 */

// API channel config (Meta Cloud API)
const API_CHANNEL = {
  number: '+971582806000',
  phone_number_id: '1166628083194563',
};

// Ahmad's personal number — operator reminders are sent HERE via the API channel
// so they arrive on his personal WhatsApp but come from the system number, not mixing threads.
const INTERNAL_WHATSAPP_NUMBER = '+971581806000';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Caller must be authenticated or this must be invoked via asServiceRole
  let user = null;
  try { user = await base44.auth.me(); } catch (_) { /* service-role invocation */ }

  const body = await req.json().catch(() => ({}));
  const {
    phone_e164,
    message,
    template_name,
    template_language = 'en',
    template_components,
    template_body,
    // If true, send to the internal operator number (Ahmad's personal WA)
    internal = false,
  } = body;

  const toNumber = internal ? INTERNAL_WHATSAPP_NUMBER : phone_e164;
  if (!toNumber) {
    return Response.json({ error: 'phone_e164 is required (or set internal: true)' }, { status: 400 });
  }
  if (!message?.trim() && !template_name) {
    return Response.json({ error: 'message or template_name is required' }, { status: 400 });
  }

  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || API_CHANNEL.phone_number_id;
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!accessToken) {
    return Response.json({ error: 'WHATSAPP_ACCESS_TOKEN secret not set' }, { status: 500 });
  }

  let payload;
  if (template_name) {
    payload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'template',
      template: {
        name: template_name,
        language: { code: template_language || 'en_US' },
        components: template_components || [],
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: { body: String(message), preview_url: false },
    };
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: data.error?.message || 'Meta API send failed', details: data }, { status: 502 });
  }

  const waMessageId = data.messages?.[0]?.id;
  console.log(`[sendApiWhatsApp] Sent to ${toNumber} via API channel. waId=${waMessageId}`);

  return Response.json({
    status: 'sent',
    channel: 'api',
    to: toNumber,
    wa_message_id: waMessageId,
  });
});