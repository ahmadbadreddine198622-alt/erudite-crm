import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Save / update the Twilio credential (admin only).
 * Body: { account_sid, auth_token, voice_number, sms_number, record_calls, api_key_sid, api_key_secret, twiml_app_sid, label }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { account_sid, auth_token, voice_number, sms_number, record_calls, api_key_sid, api_key_secret, twiml_app_sid, label, agent_phone } = body;

    if (!account_sid || !auth_token) {
      return Response.json({ error: 'account_sid and auth_token required' }, { status: 400 });
    }

    // Test the credentials
    const testRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`,
      { headers: { Authorization: `Basic ${btoa(`${account_sid}:${auth_token}`)}` } }
    );
    if (!testRes.ok) {
      return Response.json({ error: 'Invalid Twilio credentials — could not verify with Twilio API' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.TwilioCredential.list();
    const payload = { account_sid, auth_token, voice_number, sms_number, agent_phone: agent_phone || '', record_calls: record_calls ?? true, api_key_sid, api_key_secret, twiml_app_sid, label };

    let credential;
    if (existing?.[0]) {
      credential = await base44.asServiceRole.entities.TwilioCredential.update(existing[0].id, payload);
    } else {
      credential = await base44.asServiceRole.entities.TwilioCredential.create(payload);
    }

    return Response.json({ ok: true, credential });
  } catch (error) {
    console.error('saveTwilioCredential error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});