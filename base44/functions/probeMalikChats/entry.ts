import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const instance = 'Malik';
    const testJid = '971526330035@s.whatsapp.net';
    const testChatId = 'cmqtn29z2akzwr14rhgirxths'; // DB id for 971526330035

    const results = {};

    const tryEndpoint = async (label, url, body) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify(body),
      });
      const txt = await r.text();
      results[label] = { status: r.status, snippet: txt.slice(0, 300) };
    };

    // findMessages variants
    await tryEndpoint('findMsg_chatId', `${apiUrl}/chat/findMessages/${instance}`, { chatId: testChatId, page: { limit: 3 } });
    await tryEndpoint('findMsg_remoteJid', `${apiUrl}/chat/findMessages/${instance}`, { remoteJid: testJid, page: { limit: 3 } });
    await tryEndpoint('findMsg_where_remoteJid', `${apiUrl}/chat/findMessages/${instance}`, { where: { remoteJid: testJid }, page: { limit: 3 } });
    await tryEndpoint('findMsg_empty', `${apiUrl}/chat/findMessages/${instance}`, {});
    
    // Try /message/ endpoints
    await tryEndpoint('msg_find_remoteJid', `${apiUrl}/message/findMessages/${instance}`, { remoteJid: testJid, limit: 3 });
    await tryEndpoint('msg_find_chatId', `${apiUrl}/message/findMessages/${instance}`, { chatId: testChatId, limit: 3 });

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});