import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Attach the CRM webhook to an existing agent instance that's missing it.
// Body: { instance: string }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const secret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
    const body = await req.json().catch(() => ({}));
    const inst = body.instance;
    if (!inst) return Response.json({ error: 'instance required' }, { status: 400 });
    if (!secret) return Response.json({ error: 'EVOLUTION_WEBHOOK_SECRET missing' }, { status: 500 });

    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/functions/evolutionWebhook?secret=${secret}`;
    const events = [
      'APPLICATION_STARTUP','QRCODE_UPDATED','MESSAGES_SET','MESSAGES_UPSERT','MESSAGES_EDITED',
      'MESSAGES_UPDATE','MESSAGES_DELETE','SEND_MESSAGE','SEND_MESSAGE_UPDATE','CONTACTS_SET',
      'CONTACTS_UPSERT','CONTACTS_UPDATE','PRESENCE_UPDATE','CHATS_SET','CHATS_UPSERT','CHATS_UPDATE',
      'CHATS_DELETE','GROUPS_UPSERT','GROUP_UPDATE','GROUP_PARTICIPANTS_UPDATE','CONNECTION_UPDATE',
      'LABELS_EDIT','LABELS_ASSOCIATION','CALL','TYPEBOT_START','TYPEBOT_CHANGE_STATUS','REMOVE_INSTANCE',
      'LOGOUT_INSTANCE','INSTANCE_CREATE','INSTANCE_DELETE','STATUS_INSTANCE',
    ];

    // Try POST /webhook/set/{instance}
    let setResp = null, setStatus = 0;
    try {
      const r = await fetch(`${apiUrl}/webhook/set/${encodeURIComponent(inst)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ webhook: { url: webhookUrl, enabled: true, events } }),
      });
      setStatus = r.status;
      setResp = await r.json().catch(() => null);
    } catch (e) { setResp = { error: String(e?.message || e) }; }

    // Verify
    let verify = null;
    try {
      const r = await fetch(`${apiUrl}/webhook/find/${encodeURIComponent(inst)}`, { headers: { apikey: apiKey } });
      verify = await r.json().catch(() => null);
    } catch (e) { verify = { error: String(e?.message || e) }; }

    return Response.json({
      instance: inst, set_status: setStatus, set_response: setResp,
      verify_url: verify?.url, verify_enabled: verify?.enabled,
      verify_has_messages_upsert: (verify?.events || []).includes('MESSAGES_UPSERT'),
    });
  } catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 500 }); }
});