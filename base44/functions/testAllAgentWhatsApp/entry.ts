import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostics: for every user with a configured whatsapp_instance + whatsapp_number,
 * check the Evolution instance connection state and attempt to send a test message
 * from that agent's own number to TEST_TO_NUMBER (+971526330035 — owner test line).
 * Runs as service role (admin diagnostics) — bypasses the per-agent auth gate so we
 * can verify every agent's line in one pass.
 *
 * Returns per-agent: name, email, role, instance, number, connection_state,
 * send_status ('sent' | 'failed' | 'skipped'), error.
 */

const TEST_TO_NUMBER = '+971526330035';

function toDigits(raw) { return String(raw || '').replace(/\D/g, ''); }

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

  // Only test users that have both an instance and a number configured.
  const configured = users.filter(u => u.whatsapp_instance && u.whatsapp_number);

  const results = [];
  const toDigitsTo = toDigits(TEST_TO_NUMBER);

  for (const u of configured) {
    const instance = u.whatsapp_instance;
    const number = u.whatsapp_number;
    const entry = {
      name: (u.display_name || u.full_name || '').slice(0, 18),
      role: u.role,
      number,
      state: null,
      send: 'skip',
      err: null,
    };

    // 1) Connection state
    try {
      const stResp = await fetch(`${apiUrl}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
      const stBody = await stResp.json().catch(() => ({}));
      entry.state = stBody?.instance?.state || stBody?.state || null;
    } catch (e) {
      entry.state = 'probe_fail';
    }

    // 2) Send test message
    if (entry.state && entry.state !== 'open') {
      entry.send = 'fail';
      entry.err = `not open (${entry.state})`;
    } else {
      const text = `ERUDITE CRM system test from ${u.display_name || u.full_name} (${number}). Please ignore.`;
      try {
        const resp = await fetch(`${apiUrl}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({ number: toDigitsTo, text }),
        });
        const raw = await resp.text();
        let body;
        try { body = JSON.parse(raw); } catch { body = raw; }
        if (!resp.ok) {
          entry.send = 'fail';
          entry.err = `Evo ${resp.status}`;
        } else {
          entry.send = 'sent';
        }
      } catch (e) {
        entry.send = 'fail';
        entry.err = 'send err';
      }
    }

    results.push(entry);
  }

  // Build a summary of who is NOT configured too (for the full picture).
  const unconfigured = users
    .filter(u => !(u.whatsapp_instance && u.whatsapp_number))
    .map(u => `${u.display_name || u.full_name} (${u.role})`);

  return Response.json({
    test_to: TEST_TO_NUMBER,
    total: users.length,
    configured_count: configured.length,
    sent: results.filter(r => r.send === 'sent').length,
    failed: results.filter(r => r.send === 'fail').length,
    results,
    unconfigured,
  });
});