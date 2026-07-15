import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// autoReconnectWhatsApp — periodically checks every Evolution WhatsApp instance
// (both the shared business lines AND per-agent lines) and calls Evolution's
// /instance/reconnect/{name} endpoint for any that are not in the "open" state.
//
// This restores dropped Baileys sessions from persisted auth files WITHOUT
// requiring a new QR scan — the #1 cause of "everyone has to scan the QR again"
// is Evolution server restarts / transient disconnects with no auto-reconnect.
//
// Only if reconnect itself fails (auth files truly lost) does the instance
// need a fresh QR scan.
//
// Runs as service role (admin) — safe to invoke from a scheduled automation.

const STATIC_INSTANCES = [
  'erudite',
  'erudite_whatsapp',
  'malik',
  'samy',
  'dari',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    if (!apiUrl || !apiKey) {
      return Response.json({ error: 'EVOLUTION_API_URL / EVOLUTION_API_KEY missing' }, { status: 500 });
    }

    const svc = base44.asServiceRole;

    // Collect all instance names to check:
    // 1. Static shared lines (erudite, erudite_whatsapp, malik, samy, dari)
    // 2. Per-agent instances (wa_<number> stored on User.whatsapp_instance)
    const instanceSet = new Set(STATIC_INSTANCES);
    let users = [];
    try {
      users = await svc.entities.User.list('-created_date', 200);
    } catch (e) {
      console.warn('[autoReconnectWhatsApp] User list failed:', e?.message);
    }
    const agentInstances = [];
    for (const u of users) {
      if (u.whatsapp_instance) {
        instanceSet.add(u.whatsapp_instance);
        agentInstances.push({
          instance: u.whatsapp_instance,
          email: u.email,
          name: u.display_name || u.full_name || u.email,
          number: u.whatsapp_number,
        });
      }
    }

    const results = [];
    let reconnected = 0;
    let stillDown = 0;
    let alreadyOpen = 0;

    for (const instanceName of instanceSet) {
      const entry = {
        instance: instanceName,
        email: agentInstances.find((a) => a.instance === instanceName)?.email || null,
        name: agentInstances.find((a) => a.instance === instanceName)?.name || instanceName,
        before: null,
        after: null,
        action: 'none',
        error: null,
      };

      // 1. Check current connection state
      try {
        const stResp = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
          headers: { apikey: apiKey },
        });
        const stBody = await stResp.json().catch(() => ({}));
        entry.before = stBody?.instance?.state || stBody?.state || 'unknown';
      } catch (e) {
        entry.before = 'probe_fail';
        entry.error = String(e?.message || e).slice(0, 120);
      }

      // 2. If already open, skip
      if (entry.before === 'open') {
        entry.action = 'skipped_open';
        alreadyOpen++;
        results.push(entry);
        continue;
      }

      // 3. Attempt reconnect by calling /instance/connect — Evolution API
      //    restores the Baileys session from persisted auth files if they
      //    exist (no QR scan needed). Only if the session is truly lost does
      //    it return a new QR code.
      try {
        const rcResp = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: { apikey: apiKey },
        });
        const rcBody = await rcResp.json().catch(() => ({}));

        if (rcResp.status === 404) {
          // Instance doesn't exist on the Evolution server — can't reconnect
          entry.action = 'instance_not_found';
          entry.error = 'Instance not found on Evolution server';
          stillDown++;
        } else if (rcResp.ok) {
          entry.action = 'connect_called';
          // Wait for Baileys to re-establish the websocket session.
          await new Promise((r) => setTimeout(r, 5000));
          try {
            const stResp2 = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
              headers: { apikey: apiKey },
            });
            const stBody2 = await stResp2.json().catch(() => ({}));
            entry.after = stBody2?.instance?.state || stBody2?.state || 'unknown';
          } catch (e) {
            entry.after = 'probe_fail';
          }
          if (entry.after === 'open') {
            reconnected++;
          } else if (entry.after === 'connecting') {
            // Session files are valid — Baileys is still establishing the
            // websocket. It will become "open" shortly; no QR rescan needed.
            entry.action = 'reconnecting';
            reconnected++;
          } else {
            // State stayed "close" — session files likely lost
            entry.action = 'needs_qr_rescan';
            stillDown++;
          }
        } else {
          entry.action = 'connect_failed';
          entry.error = `Evo ${rcResp.status}: ${String(rcBody?.error || rcBody?.message || '').slice(0, 120)}`;
          stillDown++;
        }
      } catch (e) {
        entry.action = 'connect_error';
        entry.error = String(e?.message || e).slice(0, 120);
        stillDown++;
      }

      results.push(entry);
    }

    return Response.json({
      ok: true,
      total_instances: instanceSet.size,
      already_open: alreadyOpen,
      reconnected,
      still_down: stillDown,
      results,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});