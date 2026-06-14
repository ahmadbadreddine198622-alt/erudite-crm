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
      return Response.json({ error: 'Missing Evolution credentials' }, { status: 500 });
    }

    const maskedKey = EVOLUTION_API_KEY.slice(0, 4) + '****' + EVOLUTION_API_KEY.slice(-4);

    const fetchWithTimeout = async (url, method = 'POST', body = null) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { _rawText: text.slice(0, 500) }; }
        return { status: res.status, ok: res.ok, data };
      } catch (err) {
        clearTimeout(timeoutId);
        return { status: 0, ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message, data: null };
      }
    };

    const results = {};
    const malikFindings = [];

    // 1. POST /chat/findContacts with empty body (list all)
    const findContactsUrl = `${EVOLUTION_API_URL}/chat/findContacts/${INSTANCE_NAME}`;
    const findContactsRes = await fetchWithTimeout(findContactsUrl, 'POST', {});
    const contacts = Array.isArray(findContactsRes.data) ? findContactsRes.data :
                     (findContactsRes.data?.contacts ? (Array.isArray(findContactsRes.data.contacts) ? findContactsRes.data.contacts : [findContactsRes.data.contacts]) : []);
    const targetContact = contacts.find(c => 
      c.id === TARGET_JID || c.remoteJid === TARGET_JID || c.id?.includes('971529871277') || c.remoteJid?.includes('971529871277')
    );
    results.findContacts = {
      endpoint: findContactsUrl,
      status: findContactsRes.status,
      ok: findContactsRes.ok,
      totalContactsCount: contacts.length,
      targetContact: targetContact || null,
      nameFields: targetContact ? {
        id: targetContact.id,
        name: targetContact.name ?? null,
        notify: targetContact.notify ?? null,
        pushName: targetContact.pushName ?? null,
        verifiedName: targetContact.verifiedName ?? null,
        short: targetContact.short ?? null,
        vname: targetContact.vname ?? null,
        isSaved: targetContact.isSaved ?? null,
      } : null,
    };
    if (targetContact) {
      Object.entries(targetContact).forEach(([k, v]) => {
        if (typeof v === 'string' && v.toLowerCase().includes('malik')) {
          malikFindings.push({ endpoint: 'findContacts', field: k, value: v });
        }
      });
    }

    // 2. POST /chat/fetchContacts with numbers array
    const fetchContactsUrl = `${EVOLUTION_API_URL}/chat/fetchContacts/${INSTANCE_NAME}`;
    const fetchContactsRes = await fetchWithTimeout(fetchContactsUrl, 'POST', { numbers: [TARGET_PHONE] });
    const fetchedContacts = Array.isArray(fetchContactsRes.data) ? fetchContactsRes.data :
                            (fetchContactsRes.data?.contacts ? (Array.isArray(fetchContactsRes.data.contacts) ? fetchContactsRes.data.contacts : [fetchContactsRes.data.contacts]) : []);
    const fetchedTarget = fetchedContacts.find(c => 
      c.id === TARGET_JID || c.remoteJid === TARGET_JID || c.id?.includes('971529871277') || c.remoteJid?.includes('971529871277')
    );
    results.fetchContacts = {
      endpoint: fetchContactsUrl,
      body: { numbers: [TARGET_PHONE] },
      status: fetchContactsRes.status,
      ok: fetchContactsRes.ok,
      targetContact: fetchedTarget || null,
      nameFields: fetchedTarget ? {
        id: fetchedTarget.id,
        name: fetchedTarget.name ?? null,
        notify: fetchedTarget.notify ?? null,
        pushName: fetchedTarget.pushName ?? null,
        verifiedName: fetchedTarget.verifiedName ?? null,
        short: fetchedTarget.short ?? null,
        vname: fetchedTarget.vname ?? null,
        isSaved: fetchedTarget.isSaved ?? null,
      } : null,
    };
    if (fetchedTarget) {
      Object.entries(fetchedTarget).forEach(([k, v]) => {
        if (typeof v === 'string' && v.toLowerCase().includes('malik')) {
          malikFindings.push({ endpoint: 'fetchContacts', field: k, value: v });
        }
      });
    }

    // 3. POST /contact/find with numbers
    const contactFindUrl = `${EVOLUTION_API_URL}/contact/find/${INSTANCE_NAME}`;
    const contactFindRes = await fetchWithTimeout(contactFindUrl, 'POST', { numbers: [TARGET_PHONE] });
    const foundContacts = Array.isArray(contactFindRes.data) ? contactFindRes.data :
                          (contactFindRes.data?.contacts ? (Array.isArray(contactFindRes.data.contacts) ? contactFindRes.data.contacts : [contactFindRes.data.contacts]) : []);
    const foundTarget = foundContacts.find(c => 
      c.id === TARGET_JID || c.remoteJid === TARGET_JID || c.id?.includes('971529871277') || c.remoteJid?.includes('971529871277')
    );
    results.contactFind = {
      endpoint: contactFindUrl,
      body: { numbers: [TARGET_PHONE] },
      status: contactFindRes.status,
      ok: contactFindRes.ok,
      targetContact: foundTarget || null,
      nameFields: foundTarget ? {
        id: foundTarget.id,
        name: foundTarget.name ?? null,
        notify: foundTarget.notify ?? null,
        pushName: foundTarget.pushName ?? null,
        verifiedName: foundTarget.verifiedName ?? null,
        short: foundTarget.short ?? null,
        vname: foundTarget.vname ?? null,
      } : null,
    };
    if (foundTarget) {
      Object.entries(foundTarget).forEach(([k, v]) => {
        if (typeof v === 'string' && v.toLowerCase().includes('malik')) {
          malikFindings.push({ endpoint: 'contactFind', field: k, value: v });
        }
      });
    }

    // 4. POST /chat/whatsappNumbers with specific number
    const whatsappNumbersUrl = `${EVOLUTION_API_URL}/chat/whatsappNumbers/${INSTANCE_NAME}`;
    const whatsappNumbersRes = await fetchWithTimeout(whatsappNumbersUrl, 'POST', { numbers: [TARGET_PHONE] });
    const waNumbers = Array.isArray(whatsappNumbersRes.data) ? whatsappNumbersRes.data :
                      (whatsappNumbersRes.data?.numbers ? (Array.isArray(whatsappNumbersRes.data.numbers) ? whatsappNumbersRes.data.numbers : [whatsappNumbersRes.data.numbers]) : []);
    const waNumber = waNumbers.find(n => 
      n.id === TARGET_JID || n.remoteJid === TARGET_JID || n.id?.includes('971529871277') || n.remoteJid?.includes('971529871277')
    ) || waNumbers[0] || null;
    results.whatsappNumbers = {
      endpoint: whatsappNumbersUrl,
      body: { numbers: [TARGET_PHONE] },
      status: whatsappNumbersRes.status,
      ok: whatsappNumbersRes.ok,
      targetNumber: waNumber,
      nameFields: waNumber ? {
        id: waNumber.id,
        name: waNumber.name ?? null,
        notify: waNumber.notify ?? null,
        pushName: waNumber.pushName ?? null,
        verifiedName: waNumber.verifiedName ?? null,
        short: waNumber.short ?? null,
        vname: waNumber.vname ?? null,
      } : null,
    };
    if (waNumber) {
      Object.entries(waNumber).forEach(([k, v]) => {
        if (typeof v === 'string' && v.toLowerCase().includes('malik')) {
          malikFindings.push({ endpoint: 'whatsappNumbers', field: k, value: v });
        }
      });
    }

    return Response.json({
      target: { phone: TARGET_PHONE, jid: TARGET_JID, expectedSavedName: 'Malik Erudite', expectedPushName: 'Operations Manager at Erudite' },
      apikey_masked: maskedKey,
      results,
      malikFindings,
      summary: malikFindings.length > 0 
        ? `FOUND "Malik" in ${malikFindings.length} field(s): ${malikFindings.map(f => `${f.endpoint}.${f.field}`).join(', ')}`
        : 'NOT FOUND - "Malik Erudite" does not appear in any endpoint response',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});