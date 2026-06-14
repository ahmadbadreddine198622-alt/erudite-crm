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
    
    // Channel breakdown (if channel field exists)
    const channelBreakdown = {};
    allConversations.forEach(c => {
      const ch = c.channel || '(no channel field)';
      channelBreakdown[ch] = (channelBreakdown[ch] || 0) + 1;
    });
    
    // Check for any photo-related fields in the sample
    const photoFieldAnalysis = (() => {
      const photoFields = {};
      conversations.forEach(c => {
        Object.keys(c).forEach(key => {
          if (key.toLowerCase().includes('photo') || 
              key.toLowerCase().includes('avatar') || 
              key.toLowerCase().includes('pic') ||
              key.toLowerCase().includes('image') ||
              key.toLowerCase().includes('profile')) {
            photoFields[key] = (photoFields[key] || 0) + 1;
          }
        });
      });
      return photoFields;
    })();
    
    // Check for contact/ID fields that might be usable
    const idFieldAnalysis = (() => {
      const idFields = {};
      conversations.forEach(c => {
        Object.keys(c).forEach(key => {
          if (key.toLowerCase().includes('contact') || 
              key.toLowerCase().includes('jid') ||
              key.toLowerCase().includes('wa_id') ||
              key.toLowerCase().includes('id') ||
              key.toLowerCase().includes('source')) {
            idFields[key] = (idFields[key] || 0) + 1;
          }
        });
      });
      return idFields;
    })();
    
    return Response.json({
      conversations: conversations,
      summary: {
        total_count: totalCount,
        with_profile_pic: withProfilePic,
        without_profile_pic: withoutProfilePic,
        channel_breakdown: channelBreakdown,
      },
      field_analysis: {
        photo_related_fields: photoFieldAnalysis,
        id_contact_fields: idFieldAnalysis,
      },
      note: 'Full raw records returned above. Check wa_profile_pic_url, wa_profile_pic, avatar_url, contact_id, or any photo-related fields.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});