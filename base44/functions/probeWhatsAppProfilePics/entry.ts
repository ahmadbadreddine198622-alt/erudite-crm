import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch 15 most recent WhatsAppConversation records
    const conversations = await base44.entities.WhatsAppConversation.list('-last_message_at', 15);
    
    // Fetch all conversations for summary statistics
    const allConversations = await base44.entities.WhatsAppConversation.list(undefined, 500);
    
    // Summary statistics
    const totalCount = allConversations.length;
    const withProfilePic = allConversations.filter(c => c.wa_profile_pic_url).length;
    const withoutProfilePic = totalCount - withProfilePic;
    
    // Channel breakdown
    const channelBreakdown = {};
    allConversations.forEach(c => {
      const ch = c.channel || '(no channel field)';
      channelBreakdown[ch] = (channelBreakdown[ch] || 0) + 1;
    });
    
    // Try to fetch Evolution API instance info (for personal/ Evolution channel)
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    let evolutionInstanceInfo = null;
    let evolutionProfilePic = null;
    
    if (evolutionApiUrl && evolutionApiKey) {
      try {
        // Fetch instance info
        const instanceRes = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
          headers: { 'apikey': evolutionApiKey }
        });
        if (instanceRes.ok) {
          evolutionInstanceInfo = await instanceRes.json();
        }
        
        // Try to get profile picture for a sample number
        const sampleConv = conversations.find(c => c.channel === 'personal' && c.wa_phone_e164);
        if (sampleConv) {
          const phone = sampleConv.wa_phone_e164.replace('+', '');
          const picRes = await fetch(`${evolutionApiUrl}/chat/profilePictureUrl`, {
            method: 'POST',
            headers: { 
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number: phone })
          });
          if (picRes.ok) {
            evolutionProfilePic = await picRes.json();
          }
        }
      } catch (e) {
        evolutionInstanceInfo = { error: `Failed to fetch: ${e.message}` };
      }
    }
    
    // Try Meta/WhatsApp Business API profile pic (for business channel)
    const waAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const waPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    
    let metaProfilePic = null;
    if (waAccessToken && waPhoneNumberId) {
      try {
        // Get business profile
        const profileRes = await fetch(
          `https://graph.facebook.com/v20.0/${waPhoneNumberId}?fields=profile_photo_url&access_token=${waAccessToken}`
        );
        if (profileRes.ok) {
          metaProfilePic = await profileRes.json();
        }
      } catch (e) {
        metaProfilePic = { error: `Failed to fetch: ${e.message}` };
      }
    }
    
    return Response.json({
      conversations: conversations,
      summary: {
        total_count: totalCount,
        with_profile_pic: withProfilePic,
        without_profile_pic: withoutProfilePic,
        channel_breakdown: channelBreakdown,
      },
      evolution_api: {
        configured: !!(evolutionApiUrl && evolutionApiKey),
        instance_info: evolutionInstanceInfo,
        sample_profile_pic_attempt: evolutionProfilePic,
      },
      meta_whatsapp_api: {
        configured: !!(waAccessToken && waPhoneNumberId),
        business_profile_attempt: metaProfilePic,
      },
      note: 'Full raw records returned above. wa_profile_pic_url is null because webhooks are not fetching it. Use Evolution /chat/profilePictureUrl or Meta Graph API to populate.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});