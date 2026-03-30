import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

Deno.serve(async (req) => {
  // ── Webhook verification (GET) ───────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── Incoming webhook (POST) ──────────────────────────────────────────────
  const body = await req.json();
  const base44 = createClientFromRequest(req);

  // Walk the Meta payload structure
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.length) {
    return Response.json({ status: 'ignored' });
  }

  const waMessage = value.messages[0];
  const from = waMessage.from; // phone number
  const msgId = waMessage.id;
  const msgText = waMessage?.text?.body || waMessage?.caption || '[media]';
  const msgType = waMessage.type; // text, image, audio…
  const timestamp = new Date(Number(waMessage.timestamp) * 1000).toISOString();

  // Dedup: skip if already stored
  const existing = await base44.asServiceRole.entities.WhatsAppMessage.filter({ wa_message_id: msgId });
  if (existing.length > 0) return Response.json({ status: 'duplicate' });

  // Find or create Lead by phone
  let leads = await base44.asServiceRole.entities.Lead.filter({ phone: from });
  let lead;
  if (leads.length > 0) {
    lead = leads[0];
  } else {
    // Normalise phone with + prefix
    const phone = from.startsWith('+') ? from : '+' + from;
    lead = await base44.asServiceRole.entities.Lead.create({
      name: phone,
      phone,
      source: 'whatsapp',
      stage: 'new_lead',
      type: 'buyer',
      tags: ['whatsapp_inbound'],
    });
  }

  // Find or create Conversation
  let convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ lead_id: lead.id });
  let conv;
  if (convs.length > 0) {
    conv = convs[0];
    await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, {
      last_message: msgText.slice(0, 100),
      last_message_at: timestamp,
      unread_count: (conv.unread_count || 0) + 1,
      status: 'open',
    });
  } else {
    conv = await base44.asServiceRole.entities.WhatsAppConversation.create({
      lead_id: lead.id,
      phone_number: from,
      last_message: msgText.slice(0, 100),
      last_message_at: timestamp,
      unread_count: 1,
      status: 'open',
    });
  }

  // Store message
  const mediaType = msgType === 'text' ? 'none' : (msgType || 'none');
  await base44.asServiceRole.entities.WhatsAppMessage.create({
    conversation_id: conv.id,
    lead_id: lead.id,
    wa_message_id: msgId,
    direction: 'inbound',
    body: msgText,
    media_type: ['image','audio','video','document'].includes(mediaType) ? mediaType : 'none',
    timestamp,
    from_number: from,
    to_number: value?.metadata?.display_phone_number || '',
    status: 'delivered',
  });

  // Trigger AI analysis asynchronously (fire and forget)
  base44.asServiceRole.functions.invoke('analyzeConversation', { conversation_id: conv.id });

  return Response.json({ status: 'ok', lead_id: lead.id, conversation_id: conv.id });
});