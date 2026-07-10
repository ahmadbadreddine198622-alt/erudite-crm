import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin tool: attach the CRM webhook to an Evolution instance using service role.
// Body: { instance: string }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Service-role auth — callable from the admin dashboard / test runner
    const isAuthed = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuthed) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const secret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
    const body = await req.json().catch(() => ({}));
    const inst = body.instance;
    if (!inst) return Response.json({ error: 'instance required' }, { status: 400 });
    if (!apiUrl || !apiKey || !secret) {
      return Response.json({ error: 'Evolution secrets missing', have_url: !!apiUrl, have_key: !!apiKey, have_secret: !!secret }, { status: 500 });
    }

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

    // Attach webhook
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
      instance: inst,
      webhook_url: webhookUrl,
      set_status: setStatus,
      set_response: setResp,
      verify_url: verify?.url,
      verify_enabled: verify?.enabled,
      verify_events_count: (verify?.events || []).length,
      verify_has_messages_upsert: (verify?.events || []).includes('MESSAGES_UPSERT'),
      verify_has_send_message: (verify?.events || []).includes('SEND_MESSAGE'),
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
});