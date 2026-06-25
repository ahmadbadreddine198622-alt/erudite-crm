import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

    const resp = await fetch(`${apiUrl}/chat/findChats/Samy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ page: { limit: 1000, offset: 0 } }),
    });
    const data = await resp.json();
    const chats = Array.isArray(data) ? data : (data.chats || []);

    // Categorize
    const groups = chats.filter(c => (c.remoteJid || c.id || '').includes('-'));
    const lids = chats.filter(c => (c.remoteJid || c.id || '').includes('@lid'));
    const phones = chats.filter(c => {
      const jid = c.remoteJid || c.id || '';
      return !jid.includes('-') && !jid.includes('@lid');
    });
    const SAMEIE_OWN = '971522869064';
    const validPhones = phones.filter(c => {
      const digits = (c.remoteJid || c.id || '').split('@')[0];
      return digits && digits !== SAMEIE_OWN && digits.length >= 7;
    });

    return Response.json({
      total: chats.length,
      groups: groups.length,
      lids: lids.length,
      phone_contacts: phones.length,
      valid_importable: validPhones.length,
      sample_valid: validPhones.slice(0, 10).map(c => ({
        jid: c.remoteJid,
        name: c.pushName || c.name,
        last_msg: (c.lastMessage?.message?.conversation || c.lastMessage?.message?.extendedTextMessage?.text || '')?.substring(0, 60),
        ts: c.updatedAt || c.lastMessage?.messageTimestamp,
      })),
      sample_lids: lids.slice(0, 3).map(c => ({ jid: c.remoteJid, name: c.pushName })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});