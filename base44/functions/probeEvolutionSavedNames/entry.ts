import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const INSTANCE_NAME = 'erudite_whatsapp';

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return Response.json({ 
        error: 'Missing Evolution credentials',
        hasUrl: !!EVOLUTION_API_URL,
        hasKey: !!EVOLUTION_API_KEY 
      }, { status: 500 });
    }

    const testPhones = ['+447447252802', '+971585051345', '+9613785917'];
    const results = {};

    const headers = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    // Helper to safely fetch and parse
    const tryFetch = async (endpoint, payload = null, method = 'POST') => {
      const url = `${EVOLUTION_API_URL}${endpoint}`;
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: payload ? JSON.stringify(payload) : undefined,
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        return { status: res.status, ok: res.ok, data };
      } catch (err) {
        return { status: 0, ok: false, error: err.message };
      }
    };

    for (const phone of testPhones) {
      const phoneResults = {};

      // 1. POST /chat/findContacts - try empty query (list all)
      phoneResults.findContacts_empty = await tryFetch(`/chat/findContacts/${INSTANCE_NAME}`, { query: '' });

      // 2. POST /chat/findContacts - try with where filter by number
      phoneResults.findContacts_byNumber = await tryFetch(`/chat/findContacts/${INSTANCE_NAME}`, {
        where: { number: phone },
      });

      // 3. POST /chat/whatsappNumbers
      phoneResults.whatsappNumbers = await tryFetch(`/chat/whatsappNumbers/${INSTANCE_NAME}`, {
        numbers: [phone],
      });

      // 4. POST /chat/fetchContacts (if exists)
      phoneResults.fetchContacts = await tryFetch(`/chat/fetchContacts/${INSTANCE_NAME}`, {
        numbers: [phone],
      });

      // 5. GET /chat/fetchContacts?number= (if exists)
      phoneResults.fetchContacts_get = await tryFetch(`/chat/fetchContacts/${INSTANCE_NAME}?number=${encodeURIComponent(phone)}`, null, 'GET');

      // 6. POST /contact/find (alternative endpoint)
      phoneResults.contactFind = await tryFetch(`/contact/find/${INSTANCE_NAME}`, {
        numbers: [phone],
      });

      // Extract name fields from any contact objects found
      phoneResults.nameFieldAnalysis = {};
      
      for (const [endpoint, result] of Object.entries(phoneResults)) {
        if (endpoint === 'nameFieldAnalysis') continue;
        if (!result.ok || !result.data) continue;
        
        const contacts = Array.isArray(result.data) ? result.data : 
                         (result.data.contacts ? (Array.isArray(result.data.contacts) ? result.data.contacts : [result.data.contacts]) : []);
        
        const matchingContact = contacts.find(c => 
          c.number === phone || 
          c.id === phone || 
          c.id?.includes(phone.replace('+', ''))
        );

        if (matchingContact) {
          phoneResults.nameFieldAnalysis[endpoint] = {
            found: true,
            number: matchingContact.number,
            id: matchingContact.id,
            // All name-like fields Baileys/Evolution might expose
            name: matchingContact.name ?? null,           // Saved address-book name (what we're looking for)
            verifiedName: matchingContact.verifiedName ?? null,  // Business verified name
            notify: matchingContact.notify ?? null,       // Push name from message sender
            pushName: matchingContact.pushName ?? null,   // Alternative push name field
            short: matchingContact.short ?? null,         // Short name
            vname: matchingContact.vname ?? null,         // Business short name
            // Full object for debugging
            _raw: matchingContact,
          };
        }
      }

      results[phone] = phoneResults;
    }

    // Mask API key in any echoed config
    const maskedConfig = {
      EVOLUTION_API_URL,
      EVOLUTION_API_KEY: EVOLUTION_API_KEY.slice(0, 4) + '****' + EVOLUTION_API_KEY.slice(-4),
      INSTANCE_NAME,
    };

    return Response.json({
      config: maskedConfig,
      testPhones,
      results,
      summary: Object.fromEntries(
        testPhones.map(phone => {
          const analysis = results[phone].nameFieldAnalysis;
          const savedName = Object.values(analysis).find(a => a?.name)?.name ?? null;
          const pushName = Object.values(analysis).find(a => a?.notify)?.notify ?? 
                           Object.values(analysis).find(a => a?.pushName)?.pushName ?? null;
          return [
            phone,
            {
              savedAddressBookName: savedName,
              pushName,
              found: savedName !== null || pushName !== null,
              endpointsWithData: Object.keys(analysis).filter(k => analysis[k]?.found),
            }
          ];
        })
      ),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});