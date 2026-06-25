import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

    // Get a sample @lid JID from the chats
    const chatsResp = await fetch(`${apiUrl}/chat/findChats/Samy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ page: { limit: 1000, offset: 0 } }),
    });
    const chatsData = await chatsResp.json();
    const allChats = Array.isArray(chatsData) ? chatsData : (chatsData.chats || []);
    const lidChats = allChats.filter(c => (c.remoteJid || c.id || '').includes('@lid'));
    
    // Try the first 3 @lid chats with findMessages
    const results = [];
    for (const chat of lidChats.slice(0, 3)) {
      const jid = chat.remoteJid || chat.id;
      const resp = await fetch(`${apiUrl}/chat/findMessages/Samy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 3 }),
      });
      const data = await resp.json();
      const records = data?.messages?.records || data?.records || [];
      results.push({
        lid: jid,
        http_status: resp.status,
        record_count: records.length,
        sample_keys: records.slice(0, 2).map(r => ({
          key: r.key,
          messageType: r.messageType,
          participant: r.key?.participant,
          pushName: r.pushName,
        })),
        raw_snippet: JSON.stringify(data).substring(0, 300),
      });
    }

    return Response.json({ results, total_lid_chats: lidChats.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});