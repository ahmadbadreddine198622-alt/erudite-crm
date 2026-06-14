import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const singlePhone = payload.phone; // Optional: single phone for event-driven fetch
    const limit = payload.limit ?? 3;
    const limitNum = parseInt(limit, 10) || 3;

    let conversations = [];
    if (singlePhone) {
      // Single-phone mode: fetch just this phone's conversations
      const allForPhone = await base44.entities.WhatsAppConversation.filter(
        { wa_phone_e164: singlePhone },
        null,
        10
      );
      conversations = (allForPhone || []).filter(c => 
        !c.wa_profile_pic_url || c.wa_profile_pic_url.includes('drive.google.com')
      );
    } else {
      // Batch mode: fetch personal-channel conversations with null OR drive.google.com profile pics
      const allConversations = await base44.entities.WhatsAppConversation.filter(
        { channel: 'personal' },
        '-last_message_at',
        limitNum * 3 // Fetch extra to account for filtering + duplicates
      );
      
      // Filter client-side: null OR contains drive.google.com
      conversations = (allConversations || []).filter(c => 
        !c.wa_profile_pic_url || c.wa_profile_pic_url.includes('drive.google.com')
      ).slice(0, limitNum * 2);
    }

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

    const uniquePhones = singlePhone ? [singlePhone] : Object.keys(phoneToConvos).slice(0, limitNum);
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
    const noPhotoCount = results.filter(r => r.error === 'no_photo').length;
    const driveUrlReplacedCount = results.filter(r => r.success && r.profile_pic_url).length;
    
    // Count remaining (null OR drive-url) after this batch (only in batch mode)
    let remainingCount = 0;
    if (!singlePhone) {
      const remainingConversations = await base44.entities.WhatsAppConversation.filter(
        { channel: 'personal' },
        null,
        5000
      );
      remainingCount = (remainingConversations || []).filter(c => 
        !c.wa_profile_pic_url || c.wa_profile_pic_url.includes('drive.google.com')
      ).length;
    }

    return Response.json({
      status: 'success',
      message: singlePhone ? `Processed single phone ${singlePhone}` : `Processed ${results.length} unique phones`,
      processed: results,
      summary: {
        total: results.length,
        success: successCount,
        no_photo: noPhotoCount,
        failed: failedCount,
        drive_urls_replaced: driveUrlReplacedCount,
        remaining_needing_fetch: remainingCount
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});