import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Sends an outgoing WhatsApp message via the specified Evolution API instance.
 * 
 * Supports two channels:
 * - "business": erudite instance (Meta Cloud API, company number +971582806000)
 * - "personal": erudite_whatsapp instance (Baileys, Ahmad's number +971581806000)
 * 
 * Request body:
 * {
 *   landlord_id: string,
 *   text: string,
 *   channel?: "business" | "personal" (default: "personal")
 * }
 */

const INSTANCE_MAP = {
  business: 'erudite',
  personal: 'erudite_whatsapp',
};

function toDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate below */ }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch (_) { /* none */ }
  
  const landlord_id = body.landlord_id;
  const text = body.text;
  const channel = body.channel || 'personal';
  
  if (!landlord_id || !text || !String(text).trim()) {
    return Response.json({ error: 'landlord_id and non-empty text are required' }, { status: 400 });
  }

  if (!['business', 'personal'].includes(channel)) {
    return Response.json({ error: 'Invalid channel. Must be "business" or "personal"' }, { status: 400 });
  }

  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!apiUrl || !apiKey) {
    return Response.json({
      error: 'Evolution secrets missing',
      detail: `Set EVOLUTION_API_URL and EVOLUTION_API_KEY in Base44 (have url:${!!apiUrl}, key:${!!apiKey}).`,
    }, { status: 500 });
  }

  const svc = base44.asServiceRole;
  const llList = await svc.entities.Landlord.filter({ id: landlord_id });
  const landlord = llList && llList[0];
  if (!landlord) return Response.json({ error: 'Landlord not found', landlord_id }, { status: 404 });

  const number = toDigits(landlord.phone);
  if (!number) return Response.json({ error: 'Landlord has no phone number to send to', landlord_id }, { status: 422 });

  const instanceName = INSTANCE_MAP[channel];
  
  // ---- send via Evolution API (v2 send-text) ----
  const sendUrl = `${apiUrl}/message/sendText/${instanceName}`;
  let evoStatus = 0;
  let evoBody = null;
  try {
    const resp = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number, text: String(text) }),
    });
    evoStatus = resp.status;
    const raw = await resp.text();
    try { evoBody = JSON.parse(raw); } catch { evoBody = raw; }
    if (!resp.ok) {
      return Response.json({ error: 'Evolution send failed', evolution_status: evoStatus, evolution_response: evoBody, send_url: sendUrl }, { status: 502 });
    }
  } catch (e) {
    return Response.json({ error: 'Could not reach Evolution API', detail: String(e && e.message ? e.message : e), send_url: sendUrl }, { status: 502 });
  }

  // ---- record the outgoing message so the thread stays complete ----
  const waId = (evoBody && (evoBody.key?.id || evoBody.message?.key?.id)) || null;
  let message;
  try {
    // Find the conversation for this landlord
    const conversations = await svc.entities.WhatsAppConversation.filter({ landlord_id });
    const conversation = conversations[0];
    
    // Create WhatsAppMessage record (used by the inbox UI)
    message = await svc.entities.WhatsAppMessage.create({
      conversation_id: conversation?.id || null,
      lead_id: null, // Not a lead, it's a landlord
      direction: 'outbound',
      body: String(text),
      timestamp: new Date().toISOString(),
      status: 'sent',
      wa_message_id: waId,
      from_number: channel === 'business' ? '+971582806000' : '+971581806000',
      to_number: '+' + number,
      channel: channel,
      media_type: 'none',
    });
    
    // Also create legacy Message record for backward compatibility
    await svc.entities.Message.create({
      landlord_id,
      phone: number,
      direction: 'outgoing',
      text: String(text),
      timestamp: new Date().toISOString(),
      status: 'sent',
      wa_message_id: waId,
      channel: channel,
    });
  } catch (e) {
    return Response.json({
      status: 'sent_but_not_recorded',
      evolution_status: evoStatus,
      error: 'Message sent on WhatsApp but the Message record failed to save: ' + String(e && e.message ? e.message : e),
    }, { status: 207 });
  }

  return Response.json({ status: 'ok', message_id: message.id, evolution_status: evoStatus, channel });
});