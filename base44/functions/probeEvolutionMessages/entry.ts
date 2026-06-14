import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE');

    if (!evolutionApiUrl || !evolutionApiKey) {
      return Response.json({
        error: 'Missing required secrets',
        secrets_present: {
          EVOLUTION_API_URL: !!evolutionApiUrl,
          EVOLUTION_API_KEY: !!evolutionApiKey,
        },
      }, { status: 500 });
    }

    // Fetch instances to find personal WhatsApp
    const fetchInstancesRes = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
      headers: { 'apikey': evolutionApiKey }
    });
    const availableInstances = fetchInstancesRes.ok ? await fetchInstancesRes.json() : [];
    
    const personalInstance = availableInstances.find(i => 
      i.connectionStatus === 'open' && 
      i.ownerJid && 
      i.integration === 'WHATSAPP-BAILEYS'
    );
    
    const instanceName = personalInstance?.name?.trim() || evolutionInstance?.trim() || availableInstances[0]?.name?.trim();
    
    if (!instanceName) {
      return Response.json({
        error: 'No Evolution instance available',
        available_instances: availableInstances.map(i => ({ name: i.name, connectionStatus: i.connectionStatus })),
      }, { status: 500 });
    }

    const targetPhone = '97145560367'; // Clean format without +
    const targetMessageId = 'AA3132FCE82F57C41B';

    const results = {
      instance_used: instanceName,
      target_phone: targetPhone,
      target_message_id: targetMessageId,
    };

    // METHOD 1: Try /message/getBase64FromMediaMessage (might reveal message structure)
    // This is a long shot but worth trying
    const getMessagesUrl = `${evolutionApiUrl}/chat/getMessages/${instanceName}`;
    try {
      const getMsgRes = await fetch(getMessagesUrl, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: targetPhone,
          messageId: targetMessageId,
        }),
      });
      const getMsgBody = await getMsgRes.text();
      results.get_messages = {
        url: getMessagesUrl,
        method: 'POST',
        status: getMsgRes.status,
        body: (() => {
          try { return JSON.parse(getMsgBody); } catch { return getMsgBody; }
        })(),
      };
    } catch (e) {
      results.get_messages = {
        url: getMessagesUrl,
        method: 'POST',
        status: 'error',
        body: { error: e.message },
      };
    }

    // METHOD 2: Try /chat/getBase64FromMediaMessage - may reveal message type
    const base64Url = `${evolutionApiUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
    try {
      const base64Res = await fetch(base64Url, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: targetMessageId,
        }),
      });
      const base64Body = await base64Res.text();
      results.get_base64 = {
        url: base64Url,
        method: 'POST',
        status: base64Res.status,
        body: (() => {
          try { return JSON.parse(base64Body); } catch { return base64Body; }
        })(),
      };
    } catch (e) {
      results.get_base64 = {
        url: base64Url,
        method: 'POST',
        status: 'error',
        body: { error: e.message },
      };
    }

    // METHOD 3: Fetch recent messages from chat to see structure
    const fetchMessagesUrl = `${evolutionApiUrl}/chat/fetchMessages/${instanceName}`;
    try {
      const fetchMsgRes = await fetch(fetchMessagesUrl, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: targetPhone,
          // count: 10, // default
        }),
      });
      const fetchMsgBody = await fetchMsgRes.text();
      results.fetch_messages = {
        url: fetchMessagesUrl,
        method: 'POST',
        status: fetchMsgRes.status,
        body: (() => {
          try { return JSON.parse(fetchMsgBody); } catch { return fetchMsgBody; }
        })(),
      };
    } catch (e) {
      results.fetch_messages = {
        url: fetchMessagesUrl,
        method: 'POST',
        status: 'error',
        body: { error: e.message },
      };
    }

    // METHOD 4: Try /chat/archivedChats to see if message structure is exposed
    const archivedUrl = `${evolutionApiUrl}/chat/archivedChats/${instanceName}`;
    try {
      const archRes = await fetch(archivedUrl, {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const archBody = await archRes.text();
      results.archived_chats = {
        url: archivedUrl,
        method: 'POST',
        status: archRes.status,
        body: (() => {
          try { return JSON.parse(archBody); } catch { return archBody; }
        })(),
      };
    } catch (e) {
      results.archived_chats = {
        url: archivedUrl,
        method: 'POST',
        status: 'error',
        body: { error: e.message },
      };
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});