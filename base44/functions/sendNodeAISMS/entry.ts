import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Send an SMS via NodeAI (sms.nodeai.agency).
 * Body: { landlord_id?, lead_id?, to_phone, body }
 *
 * The mandatory opt-out keyword OPTOUT5258 is appended to every message — NodeAI
 * rejects sends without it.
 */

// Strip a phone to plain digits (NodeAI wants no '+'). UAE local '0X' → '971X'.
function toDigits(raw: string): string {
  if (!raw) return '';
  let d = String(raw).replace(/[^\d]/g, '');
  if (d.startsWith('971')) return d;
  if (d.startsWith('0')) return '971' + d.slice(1);
  return d;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, landlord_id, to_phone, body: msgBody } = await req.json();
    if (!to_phone || !msgBody) return Response.json({ error: 'to_phone and body required' }, { status: 400 });

    const smsUser = Deno.env.get('NODEAI_SMS_USER');
    const smsPass = Deno.env.get('NODEAI_SMS_PASSWORD');
    const sender = Deno.env.get('NODEAI_SMS_SENDER');
    if (!smsUser || !smsPass || !sender) {
      return Response.json({ error: 'NodeAI SMS not configured' }, { status: 500 });
    }

    const to = toDigits(to_phone);
    if (!to) return Response.json({ error: 'Invalid destination number' }, { status: 400 });

    // Append mandatory opt-out keyword. Single space separator if body doesn't end with one.
    const content = /OPTOUT5258\s*$/.test(msgBody)
      ? msgBody
      : msgBody.replace(/\s+$/, '') + ' OPTOUT5258';

    const url = `https://sms.nodeai.agency/api/v1/http-send?user=${encodeURIComponent(smsUser)}` +
      `&password=${encodeURIComponent(smsPass)}` +
      `&from=${encodeURIComponent(sender)}` +
      `&to=${encodeURIComponent(to)}` +
      `&content=${encodeURIComponent(content)}`;

    const res = await fetch(url, { method: 'GET' });
    const raw = await res.text();
    let data: any = raw;
    try { data = JSON.parse(raw); } catch { /* plain-text response */ }

    if (!res.ok) {
      return Response.json({ error: 'NodeAI SMS failed: ' + (raw.slice(0, 300)), status: res.status }, { status: res.status });
    }

    // Log as CallLog for the landlord SMS thread (mirrors the old twilioSendSMS behaviour).
    if (landlord_id) {
      try {
        await base44.asServiceRole.entities.CallLog.create({
          landlord_id,
          direction: 'outbound',
          to_number: to,
          from_number: sender,
          status: 'completed',
          started_at: new Date().toISOString(),
          notes: content,
        });
      } catch (_) { /* non-fatal */ }
    }

    // BRAIN V4 P3 LEARN: outcome ledger (non-fatal).
    try {
      await base44.asServiceRole.functions.invoke('recordOutcomeEvent', {
        landlord_id: landlord_id || null,
        kind: 'draft_sent',
        channel: 'sms',
        source_ref: `NodeAISMS:${to}:${Date.now()}`,
        text: content,
        sent_at: new Date().toISOString(),
        writer_email: user.email,
      }).catch(() => {});
    } catch (_) { /* ledger must never break a send */ }

    return Response.json({ ok: true, to, from: sender, content, raw: data });
  } catch (error) {
    console.error('sendNodeAISMS error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});