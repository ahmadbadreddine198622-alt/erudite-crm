import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const INSTANCE_NAME = 'erudite_whatsapp';
    const TARGET_PHONE = '+971529871277';
    const TARGET_JID = '971529871277@s.whatsapp.net';

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return Response.json({ 
        error: 'Missing Evolution credentials',
        hasUrl: !!EVOLUTION_API_URL,
        hasKey: !!EVOLUTION_API_KEY 
      }, { status: 500 });
    }

    const endpoint = `${EVOLUTION_API_URL}/chat/findContacts/${INSTANCE_NAME}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    // 10 second timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    let data;
    let fetchError = null;

    try {
      // Call with empty body to list all contacts, then filter
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { _rawText: text.slice(0, 500) };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      fetchError = err.name === 'AbortError' ? 'timeout' : err.message;
    }

    // Find the target contact
    const contacts = Array.isArray(data) ? data : (data.contacts ? (Array.isArray(data.contacts) ? data.contacts : [data.contacts]) : []);
    const targetContact = contacts.find(c => 
      c.id === TARGET_JID || 
      c.remoteJid === TARGET_JID ||
      c.id?.includes('971529871277') ||
      c.remoteJid?.includes('971529871277')
    );

    // Extract all name-like fields
    const nameFields = targetContact ? {
      name: targetContact.name ?? null,
      notify: targetContact.notify ?? null,
      pushName: targetContact.pushName ?? null,
      verifiedName: targetContact.verifiedName ?? null,
      short: targetContact.short ?? null,
      vname: targetContact.vname ?? null,
      _raw: targetContact,
    } : null;

    return Response.json({
      target: {
        phone: TARGET_PHONE,
        jid: TARGET_JID,
        savedNameExpected: 'Malik Erudite',
        pushNameExpected: 'Operations Manager at Erudite',
      },
      endpoint_tried: endpoint,
      apikey_masked: EVOLUTION_API_KEY.slice(0, 4) + '****' + EVOLUTION_API_KEY.slice(-4),
      fetch_result: {
        ok: response?.ok ?? false,
        status: response?.status ?? 0,
        error: fetchError,
        totalContactsCount: contacts.length,
      },
      targetContact: nameFields,
      analysis: targetContact ? {
        hasSavedName: !!(targetContact.name && targetContact.name !== targetContact.notify),
        savedNameValue: targetContact.name,
        pushNameValue: targetContact.notify || targetContact.pushName,
        conclusion: targetContact.name 
          ? `Saved name field EXISTS: "${targetContact.name}"`
          : `NO saved name field - only pushName: "${targetContact.notify || targetContact.pushName}"`,
      } : {
        conclusion: 'Contact not found in Evolution store',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});