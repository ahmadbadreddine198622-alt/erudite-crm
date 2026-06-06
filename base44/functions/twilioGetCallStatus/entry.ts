import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Gets the current status of a Twilio call by SID.
 * Body: { call_sid }
 * Returns: { status }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { call_sid } = await req.json();
    if (!call_sid) return Response.json({ error: 'call_sid required' }, { status: 400 });

    const c = (await base44.asServiceRole.entities.TwilioCredential.list())?.[0];
    const sid = c?.account_sid || Deno.env.get('TWILIO_SID');
    const token = c?.auth_token || Deno.env.get('TWILIO_TOKEN');

    if (!sid || !token) return Response.json({ error: 'Twilio not configured' }, { status: 500 });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${call_sid}.json`,
      {
        headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
      }
    );

    const data = await res.json();
    return Response.json({ status: data.status, duration: data.duration });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});