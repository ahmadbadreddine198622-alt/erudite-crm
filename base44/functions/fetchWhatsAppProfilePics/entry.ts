import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { limit = 3 } = await req.json().catch(() => ({}));
    const limitNum = parseInt(limit, 10) || 3;

    // Fetch personal-channel conversations with null profile pics
    const conversations = await base44.entities.WhatsAppConversation.filter(
      { channel: 'personal', wa_profile_pic_url: null },
      '-last_message_at',
      limitNum * 2 // Fetch extra to account for duplicates
    );

    if (!conversations || conversations.length === 0) {
      return Response.json({
        status: 'success',
        message: 'No conversations found needing profile pictures',
        processed: [],
        summary: { total: 0, success: 0, failed: 0 }
      });
    }

    // Deduplicate by phone number - process each unique phone once
    const phoneToConvos = {};
    conversations.forEach(conv => {
      const phone = conv.wa_phone_e164 || conv.phone_number;
      if (!phone) return;
      if (!phoneToConvos[phone]) phoneToConvos[phone] = [];
      phoneToConvos[phone].push(conv);
    });

    const uniquePhones = Object.keys(phoneToConvos).slice(0, limitNum);
    const results = [];
    const secrets = {
      evolutionApiUrl: Deno.env.get('EVOLUTION_API_URL'),
      evolutionApiKey: Deno.env.get('EVOLUTION_API_KEY')
    };

    if (!secrets.evolutionApiUrl || !secrets.evolutionApiKey) {
      return Response.json({ error: 'Missing Evolution API secrets' }, { status: 500 });
    }

    for (const phone of uniquePhones) {
      const convos = phoneToConvos[phone];
      const reportEntry = {
        phone,
        conversation_ids: convos.map(c => c.id),
        success: false,
        profile_pic_url: null,
        error: null
      };

      try {
        // Fetch profile picture from Evolution API
        const fetchUrl = `${secrets.evolutionApiUrl}/chat/fetchProfilePictureUrl/erudite_whatsapp`;
        const fetchRes = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': secrets.evolutionApiKey
          },
          body: JSON.stringify({ number: phone.replace('+', '') })
        });

        const fetchData = await fetchRes.json();

        if (!fetchRes.ok) {
          reportEntry.error = fetchData.message?.[0] || `HTTP ${fetchRes.status}`;
          results.push(reportEntry);
          continue;
        }

        // No profile picture available (user has no photo or privacy settings)
        if (!fetchData.profilePictureUrl) {
          reportEntry.success = true;
          reportEntry.profile_pic_url = null;
          reportEntry.error = 'no_photo';
          results.push(reportEntry);
          continue;
        }

        const cdnUrl = fetchData.profilePictureUrl;

        // Store the Evolution CDN URL directly (no re-hosting)
        for (const conv of convos) {
          await base44.entities.WhatsAppConversation.update(conv.id, {
            wa_profile_pic_url: cdnUrl
          });
        }

        reportEntry.success = true;
        reportEntry.profile_pic_url = cdnUrl;
        results.push(reportEntry);

      } catch (err) {
        reportEntry.error = err.message;
        results.push(reportEntry);
      }

      // Throttle: small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return Response.json({
      status: 'success',
      message: `Processed ${results.length} unique phones`,
      processed: results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});