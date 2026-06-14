import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Read secrets (names only in logs, never values)
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE');

    // Validate required secrets
    if (!evolutionApiUrl || !evolutionApiKey) {
      return Response.json({
        error: 'Missing required secrets',
        secrets_present: {
          EVOLUTION_API_URL: !!evolutionApiUrl,
          EVOLUTION_API_KEY: !!evolutionApiKey,
          EVOLUTION_INSTANCE: !!evolutionInstance,
        },
        note: 'Set EVOLUTION_API_URL and EVOLUTION_API_KEY to use this function.',
      }, { status: 500 });
    }

    // Determine instance name
    let instanceName = evolutionInstance;
    if (!instanceName) {
      // Try to extract from URL (e.g., https://.../instance/erudite_whatsapp => erudite_whatsapp)
      const urlMatch = evolutionApiUrl.match(/\/instance\/([^\/\?]+)/i);
      if (urlMatch) {
        instanceName = urlMatch[1];
      } else {
        return Response.json({
          error: 'Cannot determine Evolution instance name',
          secrets_present: {
            EVOLUTION_API_URL: true,
            EVOLUTION_API_KEY: true,
            EVOLUTION_INSTANCE: false,
          },
          attempted_url: evolutionApiUrl,
          note: 'Set EVOLUTION_INSTANCE secret with your Evolution instance name (e.g., "erudite_whatsapp"), or include /instance/{name} in EVOLUTION_API_URL.',
        }, { status: 500 });
      }
    }

    // Test phones (from our data, personal channel)
    const testPhones = ['+971585051345', '+9613785917'];

    const results = {};

    for (const phone of testPhones) {
      const phoneClean = phone.replace('+', '');
      results[phone] = {};

      // TEST 1: Profile Picture - try /chat/fetchProfilePictureUrl first
      const fetchPicUrl = `${evolutionApiUrl}/chat/fetchProfilePictureUrl/${instanceName}`;
      try {
        const fetchPicRes = await fetch(fetchPicUrl, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ number: phoneClean }),
        });
        const fetchPicBody = await fetchPicRes.text();
        results[phone].profile_picture_fetch = {
          url: fetchPicUrl,
          method: 'POST',
          status: fetchPicRes.status,
          body: (() => {
            try {
              return JSON.parse(fetchPicBody);
            } catch {
              return fetchPicBody;
            }
          })(),
        };
      } catch (e) {
        results[phone].profile_picture_fetch = {
          url: fetchPicUrl,
          method: 'POST',
          status: 'error',
          body: { error: e.message },
        };
      }

      // TEST 1b: Profile Picture - fallback to /chat/profilePictureUrl if first failed
      if (results[phone].profile_picture_fetch.status === 404 || results[phone].profile_picture_fetch.status === 'error') {
        const picUrl = `${evolutionApiUrl}/chat/profilePictureUrl/${instanceName}`;
        try {
          const picRes = await fetch(picUrl, {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ number: phoneClean }),
          });
          const picBody = await picRes.text();
          results[phone].profile_picture_url = {
            url: picUrl,
            method: 'POST',
            status: picRes.status,
            body: (() => {
              try {
                return JSON.parse(picBody);
              } catch {
                return picBody;
              }
            })(),
          };
        } catch (e) {
          results[phone].profile_picture_url = {
            url: picUrl,
            method: 'POST',
            status: 'error',
            body: { error: e.message },
          };
        }
      }

      // TEST 2: Contact lookup - try /chat/whatsappNumbers
      const whatsappNumbersUrl = `${evolutionApiUrl}/chat/whatsappNumbers/${instanceName}`;
      try {
        const wnRes = await fetch(whatsappNumbersUrl, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ numbers: [phoneClean] }),
        });
        const wnBody = await wnRes.text();
        results[phone].whatsapp_numbers = {
          url: whatsappNumbersUrl,
          method: 'POST',
          status: wnRes.status,
          body: (() => {
            try {
              return JSON.parse(wnBody);
            } catch {
              return wnBody;
            }
          })(),
        };
      } catch (e) {
        results[phone].whatsapp_numbers = {
          url: whatsappNumbersUrl,
          method: 'POST',
          status: 'error',
          body: { error: e.message },
        };
      }

      // TEST 3: Contact lookup - try /contact/findContacts
      const findContactsUrl = `${evolutionApiUrl}/contact/findContacts/${instanceName}`;
      try {
        const fcRes = await fetch(findContactsUrl, {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ where: { id: { includes: phoneClean } } }),
        });
        const fcBody = await fcRes.text();
        results[phone].find_contacts = {
          url: findContactsUrl,
          method: 'POST',
          status: fcRes.status,
          body: (() => {
            try {
              return JSON.parse(fcBody);
            } catch {
              return fcBody;
            }
          })(),
        };
      } catch (e) {
        results[phone].find_contacts = {
          url: findContactsUrl,
          method: 'POST',
          status: 'error',
          body: { error: e.message },
        };
      }
    }

    // Summary
    return Response.json({
      instance_used: instanceName,
      secrets_present: {
        EVOLUTION_API_URL: true,
        EVOLUTION_API_KEY: true,
        EVOLUTION_INSTANCE: !!evolutionInstance,
      },
      test_phones: testPhones,
      results: results,
      note: 'Raw Evolution API responses. Check profile_picture_*/body for URL, whatsapp_numbers/body or find_contacts/body for pushName/name fields.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});