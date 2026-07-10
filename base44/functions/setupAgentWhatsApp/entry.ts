// setupAgentWhatsApp — create a per-agent Evolution API instance for the agent's OWN
// WhatsApp number and return the QR code they scan to pair their phone. Stores the
// resulting instance name + number on the User entity so sendMultiChannelWhatsApp routes
// all outbound sends through it.
//
// Input (JSON): { whatsapp_number: string }  — E.164 or digits, e.g. +971529871277
// Output: { ok, instance, whatsapp_number, qr_base64, create_response?, connect_response? }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const number = String(body.whatsapp_number || '').replace(/\D/g, '');
    if (!number) return Response.json({ ok: false, error: 'whatsapp_number is required' }, { status: 400 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    if (!apiUrl || !apiKey) {
      return Response.json({ ok: false, error: 'Evolution secrets missing (EVOLUTION_API_URL / EVOLUTION_API_KEY)' }, { status: 500 });
    }

    const instanceName = 'wa_' + number;

    // 1. Create the instance (idempotent — if it already exists Evolution returns an error we ignore).
    let createResp = null;
    try {
      const r = await fetch(`${apiUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", number, qrcode: true }),
      });
      createResp = await r.json().catch(() => null);
    } catch (e) {
      createResp = { error: String(e?.message || e) };
    }

    // 2. Fetch the QR code the agent scans to pair their phone with this instance.
    let qrBase64 = null;
    let connectResp = null;
    try {
      const r = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { apikey: apiKey },
      });
      connectResp = await r.json().catch(() => null);
      // Prefer the displayable PNG data URL (base64) over the raw pairing `code` string.
      qrBase64 = connectResp?.base64 || connectResp?.qrcode?.base64 || createResp?.qrcode?.base64 || connectResp?.code || createResp?.qrcode?.code || null;
    } catch (e) {
      connectResp = { error: String(e?.message || e) };
    }

    // 2b. Attach the CRM webhook so this instance's chat history syncs into the app.
    // Without this, the agent's phone history never reaches the CRM (the exact bug
    // that left wa_<number> instances with no synced history). We reuse the same
    // event list the manually-configured instances (Adeyemi, Samy, …) already use.
    const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
    let webhookResp = null;
    if (webhookSecret) {
      const origin = new URL(req.url).origin;
      const webhookUrl = `${origin}/functions/evolutionWebhook?secret=${webhookSecret}`;
      const events = [
        'APPLICATION_STARTUP','QRCODE_UPDATED','MESSAGES_SET','MESSAGES_UPSERT','MESSAGES_EDITED',
        'MESSAGES_UPDATE','MESSAGES_DELETE','SEND_MESSAGE','SEND_MESSAGE_UPDATE','CONTACTS_SET',
        'CONTACTS_UPSERT','CONTACTS_UPDATE','PRESENCE_UPDATE','CHATS_SET','CHATS_UPSERT','CHATS_UPDATE',
        'CHATS_DELETE','GROUPS_UPSERT','GROUP_UPDATE','GROUP_PARTICIPANTS_UPDATE','CONNECTION_UPDATE',
        'LABELS_EDIT','LABELS_ASSOCIATION','CALL','TYPEBOT_START','TYPEBOT_CHANGE_STATUS','REMOVE_INSTANCE',
        'LOGOUT_INSTANCE','INSTANCE_CREATE','INSTANCE_DELETE','STATUS_INSTANCE',
      ];
      try {
        const r = await fetch(`${apiUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({ webhook: { url: webhookUrl, enabled: true, events } }),
        });
        webhookResp = await r.json().catch(() => null);
      } catch (e) {
        webhookResp = { error: String(e?.message || e) };
      }
    }

    // 3. Persist the instance + number on the user so sends route here.
    try {
      const meList = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const me = meList?.[0];
      if (me?.id) {
        await base44.asServiceRole.entities.User.update(me.id, {
          whatsapp_number: '+' + number,
          whatsapp_instance: instanceName,
        });
      }
    } catch (_) { /* best-effort persist */ }

    return Response.json({
      ok: true,
      instance: instanceName,
      whatsapp_number: '+' + number,
      qr_base64: qrBase64,
      create_response: createResp,
      connect_response: connectResp,
      webhook_response: webhookResp,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});