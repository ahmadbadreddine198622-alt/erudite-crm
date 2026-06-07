import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * apiChannelDigest — Rule 5: Daily digest of unhandled ApiInboxMessages > 4 hours old.
 * Sends ONE operator reminder to +971581806000 via the personal channel (Evolution),
 * listing all unhandled senders. Exempt from quiet hours (internal operator message).
 *
 * Run via scheduled automation: every hour (checks age internally).
 */

const OPERATOR_NUMBER = '971581806000'; // personal channel recipient
const STALE_HOURS = 4;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  const stale = await svc.entities.ApiInboxMessage.filter({ status: 'new' });
  const unhandled = stale.filter(m => m.received_at <= cutoff);

  if (unhandled.length === 0) {
    console.log('[apiChannelDigest] No unhandled messages older than 4h.');
    return Response.json({ status: 'ok', unhandled: 0 });
  }

  // Group by sender
  const bySender = {};
  for (const m of unhandled) {
    const key = m.linked_landlord_name || m.linked_lead_name || m.sender_phone;
    if (!bySender[key]) bySender[key] = 0;
    bySender[key]++;
  }

  const lines = Object.entries(bySender)
    .map(([name, count]) => `• ${name}: ${count} unread msg${count > 1 ? 's' : ''}`)
    .join('\n');

  const digest = `📬 API Channel Digest\n${unhandled.length} unhandled message(s) older than ${STALE_HOURS}h:\n\n${lines}\n\nPlease review at /api-inbox`;

  // Send via Evolution (personal channel) — exempt from quiet hours per Rule 8
  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

  if (!apiUrl || !apiKey) {
    console.error('[apiChannelDigest] Evolution credentials missing');
    return Response.json({ error: 'Evolution credentials missing' }, { status: 500 });
  }

  const res = await fetch(`${apiUrl}/message/sendText/erudite_whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number: OPERATOR_NUMBER, text: digest }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[apiChannelDigest] Evolution send failed:', err);
    return Response.json({ error: 'Digest send failed', detail: err }, { status: 502 });
  }

  console.log(`[apiChannelDigest] Sent digest for ${unhandled.length} unhandled messages`);
  return Response.json({ status: 'sent', unhandled: unhandled.length });
});