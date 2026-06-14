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

    // Get Google Drive access token
    const { accessToken: driveToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    if (!driveToken) {
      return Response.json({ error: 'Google Drive not connected' }, { status: 500 });
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

        if (!fetchRes.ok || !fetchData.profilePictureUrl) {
          reportEntry.error = fetchData.message?.[0] || `HTTP ${fetchRes.status}`;
          results.push(reportEntry);
          continue;
        }

        const cdnUrl = fetchData.profilePictureUrl;

        // Download the image from WhatsApp CDN
        const imageRes = await fetch(cdnUrl);
        if (!imageRes.ok) {
          reportEntry.error = `Failed to download image: HTTP ${imageRes.status}`;
          results.push(reportEntry);
          continue;
        }

        const arrayBuffer = await imageRes.arrayBuffer();
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // Upload to Google Drive
        const metadata = {
          name: `profile_${phone.replace('+', '')}.jpg`,
          parents: ['root'],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([arrayBuffer], { type: 'image/jpeg' }));

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${driveToken}` },
          body: form,
        });

        if (!uploadRes.ok) {
          reportEntry.error = `Drive upload failed: ${uploadRes.status}`;
          results.push(reportEntry);
          continue;
        }

        const uploadData = await uploadRes.json();
        const fileId = uploadData.id;
        const permanentUrl = `https://drive.google.com/uc?id=${fileId}&export=view`;

        // Make file publicly viewable
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${driveToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'anyone',
            role: 'reader',
          }),
        });

        // Update all conversations with this phone number
        for (const conv of convos) {
          await base44.entities.WhatsAppConversation.update(conv.id, {
            wa_profile_pic_url: permanentUrl
          });
        }

        reportEntry.success = true;
        reportEntry.profile_pic_url = permanentUrl;
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