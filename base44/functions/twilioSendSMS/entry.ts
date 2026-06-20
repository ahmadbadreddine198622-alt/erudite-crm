import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Send an SMS via Twilio.
 * Body: { landlord_id?, lead_id?, to_phone, body, from_phone? }
 * If from_phone is not provided, falls back to the saved sms_number credential.
 */

async function getCreds(base44) {
  const list = await base44.asServiceRole.entities.TwilioCredential.list();
  const c = list?.[0];
  return {
    sid: c?.account_sid || Deno.env.get('TWILIO_SID'),
    token: c?.auth_token || Deno.env.get('TWILIO_TOKEN'),
    defaultSmsNumber: c?.sms_number || c?.voice_number || Deno.env.get('TWILIO_SMS_NUMBER'),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, landlord_id, to_phone, body: msgBody, from_phone } = await req.json();
    if (!to_phone || !msgBody) return Response.json({ error: 'to_phone and body required' }, { status: 400 });

    const { sid, token, defaultSmsNumber } = await getCreds(base44);
    if (!sid || !token) {
      return Response.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    const fromNumber = from_phone || defaultSmsNumber;
    if (!fromNumber) {
      return Response.json({ error: 'No Twilio number available to send from' }, { status: 500 });
    }

    const params = new URLSearchParams({
      To: to_phone,
      From: fromNumber,
      Body: msgBody,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: 'Twilio SMS failed: ' + err }, { status: res.status });
    }

    const data = await res.json();

    // Log as Activity for history
    const entityPayload = {
      type: 'sms',
      direction: 'outbound',
      title: `SMS to ${to_phone}`,
      description: msgBody,
      channel: 'sms',
      source: 'manual',
      agent_email: user.email,
      scheduled_at: new Date().toISOString(),
      metadata: { twilio_message_sid: data.sid, from_number: fromNumber },
    };

    if (lead_id) entityPayload.lead_id = lead_id;

    // If landlord_id, store in CallLog for backward compatibility with SMS panel
    if (landlord_id) {
      try {
        await base44.asServiceRole.entities.CallLog.create({
          landlord_id,
          direction: 'outbound',
          to_number: to_phone,
          from_number: fromNumber,
          status: 'completed',
          started_at: new Date().toISOString(),
          notes: msgBody,
        });
      } catch (_) { /* non-fatal */ }
    }

    if (lead_id) {
      try {
        await base44.asServiceRole.entities.Activity.create(entityPayload);
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({ ok: true, message_sid: data.sid, status: data.status, from: fromNumber });
  } catch (error) {
    console.error('twilioSendSMS error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});