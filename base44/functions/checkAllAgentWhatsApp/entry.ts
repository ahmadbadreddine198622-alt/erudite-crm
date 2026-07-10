import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * READ-ONLY connectivity audit.
 * For every user with a configured whatsapp_instance + whatsapp_number, query ONLY the
 * Evolution connection state. Sends NO messages to anyone.
 * Returns per-agent: name, email, role, instance, number, connection_state, configured.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let caller;
  try { caller = await base44.auth.me(); } catch (_) { caller = null; }
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const isAdmin = caller.role === 'admin';
  if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!apiUrl || !apiKey) {
    return Response.json({ error: 'EVOLUTION_API_URL / EVOLUTION_API_KEY missing' }, { status: 500 });
  }

  const svc = base44.asServiceRole;
  let users = [];
  try { users = await svc.entities.User.list('-created_date', 200); } catch (e) {
    return Response.json({ error: 'User list failed: ' + String(e?.message || e) }, { status: 500 });
  }

  const configured = users.filter(u => u.whatsapp_instance && u.whatsapp_number);
  const results = [];

  for (const u of configured) {
    const instance = u.whatsapp_instance;
    const entry = {
      name: (u.display_name || u.full_name || '').trim() || u.email,
      email: u.email,
      role: u.role,
      instance,
      number: u.whatsapp_number,
      state: null,
      connected: false,
      err: null,
    };

    // Query connection state ONLY — no send.
    try {
      const stResp = await fetch(`${apiUrl}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
      const stBody = await stResp.json().catch(() => ({}));
      entry.state = stBody?.instance?.state || stBody?.state || null;
      entry.connected = entry.state === 'open';
    } catch (e) {
      entry.state = 'probe_fail';
      entry.err = String(e?.message || e).slice(0, 120);
    }

    results.push(entry);
  }

  const unconfigured = users
    .filter(u => !(u.whatsapp_instance && u.whatsapp_number))
    .map(u => ({
      name: (u.display_name || u.full_name || '').trim() || u.email,
      email: u.email,
      role: u.role,
    }));

  return Response.json({
    total: users.length,
    configured_count: configured.length,
    connected_count: results.filter(r => r.connected).length,
    disconnected_count: results.filter(r => !r.connected).length,
    results: results.sort((a, b) => (b.connected ? 1 : 0) - (a.connected ? 1 : 0)),
    unconfigured,
    note: 'Read-only audit — no messages were sent to anyone.',
  });
});