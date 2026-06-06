import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fetch all Twilio phone numbers from the account + the saved credential.
 * Returns: { numbers: [{phone_number, friendly_name, capabilities}], credential }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const creds = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = creds?.[0];
    if (!c?.account_sid || !c?.auth_token) {
      return Response.json({ numbers: [], credential: null, configured: false });
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.account_sid}/IncomingPhoneNumbers.json?PageSize=100`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${c.account_sid}:${c.auth_token}`)}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: 'Twilio API error: ' + err }, { status: res.status });
    }

    const data = await res.json();
    const numbers = (data.incoming_phone_numbers || []).map((n) => ({
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      sid: n.sid,
      capabilities: n.capabilities,
    }));

    return Response.json({
      configured: true,
      numbers,
      credential: {
        id: c.id,
        account_sid: c.account_sid,
        auth_token: c.auth_token,
        label: c.label || 'Twilio Account',
        voice_number: c.voice_number,
        sms_number: c.sms_number,
        agent_phone: c.agent_phone || '',
        record_calls: c.record_calls,
        api_key_sid: c.api_key_sid || '',
        api_key_secret: c.api_key_secret || '',
        twiml_app_sid: c.twiml_app_sid || '',
      },
    });
  } catch (error) {
    console.error('getTwilioNumbers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});