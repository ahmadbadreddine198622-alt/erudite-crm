import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic function to check WhatsApp sync status
 * Returns recent webhook activity and message counts
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recent conversations
    const conversations = await base44.asServiceRole.entities.WhatsAppConversation.list('-last_message_at', 10);
    
    // Get message counts
    const allMessages = await base44.asServiceRole.entities.WhatsAppMessage.list('-timestamp', 100);
    
    // Check secrets
    const hasAccessToken = !!Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const hasPhoneNumberId = !!Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const hasVerifyToken = !!Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    
    // Get webhook URL
    const webhookUrl = 'https://dubai-estate-pro.base44.app/functions/whatsappWebhook';
    
    return Response.json({
      status: 'ok',
      secrets: {
        WHATSAPP_ACCESS_TOKEN: hasAccessToken ? '✅ Set' : '❌ Missing',
        WHATSAPP_PHONE_NUMBER_ID: hasPhoneNumberId ? '✅ Set' : '❌ Missing',
        WHATSAPP_VERIFY_TOKEN: hasVerifyToken ? '✅ Set' : '❌ Missing',
      },
      webhook_url: webhookUrl,
      conversations: {
        total: conversations.length,
        recent: conversations.map(c => ({
          id: c.id,
          phone: c.wa_phone_e164 || c.phone_number,
          display_name: c.wa_display_name || 'N/A',
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          unread_count: c.unread_count,
          message_count: 0 // will calculate below
        }))
      },
      messages: {
        total: allMessages.length,
        by_conversation: conversations.map(c => {
          const convMessages = allMessages.filter(m => m.conversation_id === c.id);
          return {
            conversation_id: c.id,
            count: convMessages.length,
            inbound: convMessages.filter(m => m.direction === 'inbound').length,
            outbound: convMessages.filter(m => m.direction === 'outbound').length
          };
        })
      },
      troubleshooting: {
        step1: 'Check if webhook is configured in Meta Developer Portal',
        step2: 'Verify webhook URL matches: ' + webhookUrl,
        step3: 'Ensure "messages" field is subscribed',
        step4: 'Send a test message from WhatsApp to your business number',
        step5: 'Check Base44 runtime logs for webhook activity'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});