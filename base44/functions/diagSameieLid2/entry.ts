import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const svc = base44.asServiceRole;

    // Resolve first 3 @lid chats and check what phones come back
    const chatsResp = await fetch(`${apiUrl}/chat/findChats/Samy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ page: { limit: 1000, offset: 0 } }),
    });
    const chatsData = await chatsResp.json();
    const allChats = Array.isArray(chatsData) ? chatsData : (chatsData.chats || []);
    const lidChats = allChats.filter(c => (c.remoteJid || c.id || '').includes('@lid'));

    const resolved = [];
    for (const chat of lidChats.slice(0, 5)) {
      const jid = chat.remoteJid || chat.id;
      const msgResp = await fetch(`${apiUrl}/chat/findMessages/Samy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 3 }),
      });
      const msgData = await msgResp.json();
      const records = msgData?.messages?.records || [];
      const phones = records.map(r => ({
        remoteJidAlt: r.key?.remoteJidAlt,
        participant: r.key?.participant,
        fromMe: r.key?.fromMe,
      }));
      resolved.push({ lid: jid, name: chat.pushName, record_count: records.length, phones });
    }

    // What's currently in existingPhones set
    const existingConvs = await svc.entities.WhatsAppConversation.filter({ channel: 'sameie' });
    const existingPhones = (existingConvs || []).map(c => ({
      phone: c.wa_phone_e164,
      id: c.id,
    }));

    return Response.json({ resolved, existing_sameie_convs: existingPhones });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});