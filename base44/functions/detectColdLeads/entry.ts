import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all conversations
    const allConvs = await base44.asServiceRole.entities.WhatsAppConversation.list('-last_message_at', 1000);
    
    const coldLeads = [];
    const now = Date.now();
    const COLD_THRESHOLD_DAYS = 7;
    const COLD_THRESHOLD_MS = COLD_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    for (const conv of allConvs) {
      const lastMessageTime = new Date(conv.last_message_at).getTime();
      const daysSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60 * 24);

      let isCold = false;
      const reasons = [];

      // Rule 1: No activity for 7+ days
      if (daysSinceLastMessage >= COLD_THRESHOLD_DAYS) {
        isCold = true;
        reasons.push(`no_activity_${Math.floor(daysSinceLastMessage)}_days`);
      }

      // Rule 2: Sentiment trending negative
      if (conv.ai_sentiment === 'negative') {
        reasons.push('negative_sentiment');
        if (daysSinceLastMessage > 3) isCold = true;
      }

      // Rule 3: Urgency dropped significantly
      if (conv.ai_urgency === 'low' && conv.unread_count === 0) {
        reasons.push('low_urgency_no_follow_up');
        if (daysSinceLastMessage > 5) isCold = true;
      }

      // Rule 4: No messages ever sent to lead
      const messages = await base44.asServiceRole.entities.WhatsAppMessage.filter({
        conversation_id: conv.id,
        direction: 'outbound',
      });

      if (messages.length === 0 && daysSinceLastMessage > 3) {
        isCold = true;
        reasons.push('no_outbound_messages');
      }

      if (isCold) {
        // Update conversation
        await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, {
          metadata: {
            ...conv.metadata,
            is_cold: true,
            cold_reasons: reasons,
            cold_detected_at: new Date().toISOString(),
          },
        });

        // Add cold tag if not already present
        const tags = conv.manual_tags || [];
        if (!tags.includes('cold_lead')) {
          tags.push('cold_lead');
          await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, {
            manual_tags: tags,
          });
        }

        coldLeads.push({
          conversation_id: conv.id,
          lead_id: conv.lead_id,
          phone_number: conv.phone_number,
          days_since_contact: Math.floor(daysSinceLastMessage),
          reasons,
        });
      }
    }

    return Response.json({
      cold_leads_detected: coldLeads.length,
      leads: coldLeads,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});