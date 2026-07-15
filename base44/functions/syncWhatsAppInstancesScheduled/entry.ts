import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// syncWhatsAppInstancesScheduled — scheduled daemon version of
// syncAllWhatsAppInstances. Runs with NO user auth gate (scheduled tasks have
// no user), so it works reliably from the scheduler. Does the full repair for
// every Evolution WhatsApp instance:
//   1. Reconnects any instance not in the "open" state (restores the Baileys
//      session from persisted auth files — no QR rescan unless truly lost).
//   2. (Re)attaches the CRM webhook with the full event set so incoming AND
//      outgoing messages flow into the CRM in real time.
//
// This guarantees that after an Evolution server restart / transient disconnect,
// every line self-heals within minutes — no manual repair needed.

const WEBHOOK_EVENTS = [
  'APPLICATION_STARTUP','QRCODE_UPDATED','MESSAGES_SET','MESSAGES_UPSERT','MESSAGES_EDITED',
  'MESSAGES_UPDATE','MESSAGES_DELETE','SEND_MESSAGE','SEND_MESSAGE_UPDATE','CONTACTS_SET',
  'CONTACTS_UPSERT','CONTACTS_UPDATE','PRESENCE_UPDATE','CHATS_SET','CHATS_UPSERT','CHATS_UPDATE',
  'CHATS_DELETE','GROUPS_UPSERT','GROUP_UPDATE','GROUP_PARTICIPANTS_UPDATE','CONNECTION_UPDATE',
  'LABELS_EDIT','LABELS_ASSOCIATION','CALL','TYPEBOT_START','TYPEBOT_CHANGE_STATUS','REMOVE_INSTANCE',
  'LOGOUT_INSTANCE','INSTANCE_CREATE','INSTANCE_DELETE','STATUS_INSTANCE',
];

Deno.serve(async (req) => {
  try {
    // No auth.me() gate — this runs from the scheduler with no user. The
    // Evolution secrets are server-side env vars; only the scheduler can reach it.
    const _base44 = createClientFromRequest(req);

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const secret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
    if (!apiUrl || !apiKey || !secret) {
      return Response.json({ error: 'Evolution secrets missing', have_url: !!apiUrl, have_key: !!apiKey, have_secret: !!secret }, { status: 500 });
    }

    const origin = 'https://app.erudite-estate.com';
    const webhookUrl = `${origin}/functions/evolutionWebhook?secret=${secret}`;

    // 1. Fetch ALL instances on the Evolution server
    const listResp = await fetch(`${apiUrl}/instance/fetchInstances`, { headers: { apikey: apiKey } });
    const instances = await listResp.json().catch(() => []);
    if (!Array.isArray(instances)) {
      return Response.json({ error: 'fetchInstances did not return a list', raw: instances }, { status: 502 });
    }

    const results = [];
    let connectedCount = 0;
    let reconnectedCount = 0;
    let webhookAttachedCount = 0;

    // Process in small parallel batches to stay fast without overwhelming the API.
    const batchSize = 4;
    for (let i = 0; i < instances.length; i += batchSize) {
      const batch = instances.slice(i, i + batchSize);
      await Promise.all(batch.map(async (inst) => {
        const name = inst?.name || inst?.instance?.name;
        const state = inst?.connectionStatus || inst?.connection?.state || 'unknown';
        const entry = { instance: name, before: state, reconnect: 'none', webhook: 'none', error: null };
        if (!name) { entry.error = 'no instance name'; results.push(entry); return; }

        // 2. Reconnect if not open
        if (state !== 'open') {
          try {
            const rc = await fetch(`${apiUrl}/instance/connect/${encodeURIComponent(name)}`, {
              method: 'GET', headers: { apikey: apiKey },
            });
            entry.reconnect = rc.ok ? 'connect_called' : `failed_${rc.status}`;
            if (rc.ok) reconnectedCount++;
          } catch (e) {
            entry.reconnect = 'error';
            entry.error = String(e?.message || e).slice(0, 120);
          }
        } else {
          entry.reconnect = 'already_open';
          connectedCount++;
        }

        // 3. Attach webhook
        try {
          const setResp = await fetch(`${apiUrl}/webhook/set/${encodeURIComponent(name)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: apiKey },
            body: JSON.stringify({ webhook: { url: webhookUrl, enabled: true, events: WEBHOOK_EVENTS } }),
          });
          if (setResp.ok) {
            entry.webhook = 'attached';
            webhookAttachedCount++;
          } else {
            const setBody = await setResp.json().catch(() => null);
            entry.webhook = `failed_${setResp.status}`;
            entry.error = String(setBody?.error || setBody?.message || '').slice(0, 120);
          }
        } catch (e) {
          entry.webhook = 'error';
          entry.error = String(e?.message || e).slice(0, 120);
        }

        results.push(entry);
      }));
    }

    return Response.json({
      ok: true,
      total_instances: instances.length,
      already_open: connectedCount,
      reconnected: reconnectedCount,
      webhooks_attached: webhookAttachedCount,
      results,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});