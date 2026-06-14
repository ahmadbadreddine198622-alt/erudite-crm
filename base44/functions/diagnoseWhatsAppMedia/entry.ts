import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch 10 most recent WhatsAppMessage records overall
    const recentMessages = await base44.entities.WhatsAppMessage.list('-timestamp', 10);
    
    // Fetch up to 10 messages with media_type set (filter for media messages)
    // We'll need to check what fields actually exist first
    const allMessages = await base44.entities.WhatsAppMessage.list('-timestamp', 200);
    const mediaMessages = allMessages.filter(m => m.media_type).slice(0, 10);
    
    // Helper to extract fields (null-fill what doesn't exist)
    const extractFields = (msg) => {
      return {
        id: msg.id || null,
        conversation_id: msg.conversation_id || null,
        wa_message_id: msg.wa_message_id || null,
        direction: msg.direction || null,
        status: msg.status || null,
        body: msg.body || null,
        media_type: msg.media_type || null,
        media_url: msg.media_url || null,
        media_mime_type: msg.media_mime_type || msg.media_mime || null,
        timestamp: msg.timestamp || null,
      };
    };
    
    // Calculate summary statistics
    const totalCount = allMessages.length;
    const withMediaUrl = allMessages.filter(m => m.media_url).length;
    const withoutMediaUrl = totalCount - withMediaUrl;
    
    // Breakdown by media_type
    const mediaTypeBreakdown = {};
    allMessages.forEach(m => {
      const mt = m.media_type || '(no media_type)';
      mediaTypeBreakdown[mt] = (mediaTypeBreakdown[mt] || 0) + 1;
    });
    
    return Response.json({
      recent_messages: recentMessages.map(extractFields),
      media_messages: mediaMessages.map(extractFields),
      summary: {
        total_count: totalCount,
        with_media_url: withMediaUrl,
        without_media_url: withoutMediaUrl,
        media_type_breakdown: mediaTypeBreakdown,
      },
      note: 'Fields shown: id, conversation_id, wa_message_id, direction, status, body, media_type, media_url, media_mime_type (or media_mime if that field exists), timestamp',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});