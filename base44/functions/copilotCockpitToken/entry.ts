import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * copilotCockpitToken — gives the logged-in CRM browser the shared secret +
 * relay URL so it can open the cockpit WebSocket. App-user auth required;
 * the secret itself lives only in env (COPILOT_SHARED_SECRET).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.email) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const token = Deno.env.get('COPILOT_SHARED_SECRET') || '';
    const relay = Deno.env.get('COPILOT_RELAY_URL') || 'wss://copilot.peninsulabusinessbay.com';

    if (!token) {
      return Response.json({ configured: false, error: 'COPILOT_SHARED_SECRET not set' });
    }
    return Response.json({ configured: true, token, relay_ws: relay });
  } catch (err) {
    return Response.json({ error: err?.message || 'internal error' }, { status: 500 });
  }
});
