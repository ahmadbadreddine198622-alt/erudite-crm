import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return Response.json({
        error: 'Missing EVOLUTION_API_URL or EVOLUTION_API_KEY secrets',
        secrets_present: {
          EVOLUTION_API_URL: !!EVOLUTION_API_URL,
          EVOLUTION_API_KEY: !!EVOLUTION_API_KEY,
        }
      }, { status: 400 });
    }

    // Fetch a sample conversation with a phone number to test against
    const conversations = await base44.entities.WhatsAppConversation.list('-last_message_at', 5);
    const testPhone = conversations.find(c => c.wa_phone_e164 && c.channel === 'personal')?.wa_phone_e164;
    
    if (!testPhone) {
      return Response.json({ error: 'No personal channel conversations found to test with' }, { status: 400 });
    }

    // Clean phone number (remove + and non-digits)
    const cleanPhone = testPhone.replace('+', '').replace(/\D/g, '');

    const results = {
      secrets: {
        EVOLUTION_API_URL,
        EVOLUTION_API_KEY_present: !!EVOLUTION_API_KEY,
      },
      test_phone: testPhone,
      tests: {},
    };

    // TEST 1: Network connectivity - fetch instances
    try {
      const res1 = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
      });
      const data1 = await res1.json();
      results.tests.connectivity = {
        reachable: true,
        status: res1.status,
        response: data1,
      };
    } catch (err) {
      results.tests.connectivity = {
        reachable: false,
        error: err.message,
      };
    }

    // Extract instance name - look for the personal (non-business) instance
    const instances = results.tests.connectivity.response || [];
    const personalInstance = instances.find(i => i.name && !i.name.includes('business') && i.ownerJid) || instances[0];
    const instanceName = personalInstance?.name || 'erudite_whatsapp';
    results.instance_info = {
      name: instanceName,
      connectionStatus: personalInstance?.connectionStatus,
      ownerJid: personalInstance?.ownerJid,
      profileName: personalInstance?.profileName,
      profilePicUrl: personalInstance?.profilePicUrl,
    };
    
    try {
      const res2 = await fetch(`${EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleanPhone,
        }),
      });
      const data2 = await res2.json();
      results.tests.profile_picture = {
        endpoint: `/chat/fetchProfilePictureUrl/${instanceName}`,
        status: res2.status,
        phone_tested: testPhone,
        response: data2,
        url_extracted: data2?.profilePictureUrl || data2?.url || null,
      };
    } catch (err) {
      results.tests.profile_picture = {
        endpoint: `/chat/fetchProfilePictureUrl/${instanceName}`,
        error: err.message,
      };
    }

    // TEST 3: Media/voice note retrieval - /chat/getBase64FromMediaMessage/{instance}
    // Fetch a recent media message to test with
    const mediaMessages = await base44.entities.WhatsAppMessage.filter(
      { conversation_id: conversations[0]?.id },
      '-timestamp',
      10
    );
    const testMediaMsg = mediaMessages.find(m => m.media_type && m.wa_message_id);

    if (testMediaMsg) {
      try {
        const res3 = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              key: {
                remoteJid: testPhone.includes('+') ? `${cleanPhone}@s.whatsapp.net` : `${testPhone}@s.whatsapp.net`,
                fromMe: testMediaMsg.direction === 'outbound',
                id: testMediaMsg.wa_message_id,
              },
            },
          }),
        });
        const data3 = await res3.json();
        results.tests.media_retrieval = {
          endpoint: `/chat/getBase64FromMediaMessage/${instanceName}`,
          status: res3.status,
          message_tested: testMediaMsg.wa_message_id,
          media_type: testMediaMsg.media_type,
          response: data3,
          base64_preview: data3?.base64 ? data3.base64.substring(0, 100) + '...' : null,
        };
      } catch (err) {
        results.tests.media_retrieval = {
          endpoint: `/chat/getBase64FromMediaMessage/${instanceName}`,
          error: err.message,
        };
      }
    } else {
      results.tests.media_retrieval = {
        skipped: true,
        reason: 'No media messages found in recent conversation to test with',
      };
    }

    // TEST 4: Alternative - check if there's a direct media URL endpoint
    try {
      // Some Evolution versions support /chat/getMediaUrl
      const res4 = await fetch(`${EVOLUTION_API_URL}/chat/getMediaUrl/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            key: {
              remoteJid: testPhone.includes('+') ? `${cleanPhone}@s.whatsapp.net` : `${testPhone}@s.whatsapp.net`,
              fromMe: false,
              id: 'test',
            },
          },
        }),
      });
      const data4 = await res4.json();
      results.tests.media_url_endpoint = {
        endpoint: `/chat/getMediaUrl/${instanceName}`,
        status: res4.status,
        response: data4,
      };
    } catch (err) {
      results.tests.media_url_endpoint = {
        endpoint: `/chat/getMediaUrl/${instanceName}`,
        error: err.message,
      };
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});