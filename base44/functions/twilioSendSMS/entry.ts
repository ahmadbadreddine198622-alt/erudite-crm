import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Send an SMS via Twilio.
 * Body: { lead_id?, to_phone, body }
 */

async function getCreds(base44: any) {
  const list = await base44.asServiceRole.entities.TwilioCredential.list();
  const c = list?.[0];
  return {
    sid: c?.account_sid || Deno.env.get('TWILIO_SID'),
    token: c?.auth_token || Deno.env.get('TWILIO_TOKEN'),
    smsNumber: c?.sms_number || c?.voice_number || Deno.env.get('TWILIO_SMS_NUMBER')
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, to_phone, body: msgBody } = await req.json();
    if (!to_phone || !msgBody) return Response.json({ error: 'to_phone and body required' }, { status: 400 });

    const { sid, token, smsNumber } = await getCreds(base44);
    if (!sid || !token || !smsNumber) {
      return Response.json({ error: 'Twilio SMS not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
      To: to_phone,
      From: smsNumber,
      Body: msgBody
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: 'Twilio SMS failed: ' + err }, { status: res.status });
    }

    const data = await res.json();

    if (lead_id) {
      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id,
          type: 'sms',
          direction: 'outbound',
          title: `SMS to ${to_phone}`,
          description: msgBody,
          channel: 'sms',
          source: 'twilio',
          agent_email: user.email,
          metadata: { twilio_message_sid: data.sid }
        });
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({ ok: true, message_sid: data.sid, status: data.status });
  } catch (error: any) {
    console.error('twilioSendSMS error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
