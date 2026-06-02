import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Send WhatsApp message from CRM (text, voice, files)
 * Used when user sends message directly from contact profile
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      phone_number,
      message_text,
      media_url,
      media_type // 'text' | 'image' | 'audio' | 'document' | 'video'
    } = await req.json();

    if (!phone_number || (!message_text && !media_url)) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      return Response.json({ error: 'WhatsApp credentials not configured' }, { status: 500 });
    }

    // Normalize phone number
    const normalized = normalizePhoneNumber(phone_number);
    if (!normalized) {
      return Response.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const recipientPhone = normalized.replace('+', '');
    let messagePayload = {};

    // Build message based on type
    if (message_text && media_type === 'text') {
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { body: message_text }
      };
    } else if (media_url) {
      const mediaTypeMap = {
        'image': 'image',
        'audio': 'audio',
        'video': 'video',
        'document': 'document'
      };

      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: mediaTypeMap[media_type] || 'document',
        [mediaTypeMap[media_type] || 'document']: {
          link: media_url,
          ...(message_text && { caption: message_text })
        }
      };
    }

    // Send via WhatsApp API
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    if (!response.ok) {
      const error = await response.json();
      return Response.json({ error: error.message || 'Failed to send message' }, { status: response.status });
    }

    const result = await response.json();

    // Create message record in database
    const conversations = await base44.entities.WhatsAppConversation.list();
    const conversation = conversations.find(c => c.phone_number === normalized);

    if (conversation && conversation.lead_id) {
      await base44.entities.WhatsAppMessage.create({
        conversation_id: conversation.id,
        lead_id: conversation.lead_id,
        wa_message_id: result.messages[0].id,
        direction: 'outbound',
        body: message_text || `[${media_type}]`,
        media_url: media_url,
        media_type: media_type === 'text' ? 'none' : media_type,
        status: 'sent',
        timestamp: new Date().toISOString(),
        from_number: `+${phoneNumberId}`,
        to_number: normalized
      });

      // Update conversation
      await base44.entities.WhatsAppConversation.update(conversation.id, {
        last_message: message_text || `[${media_type}]`,
        last_message_at: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      message_id: result.messages[0].id
    });
  } catch (error) {
    console.error('sendWhatsAppMessageFromCRM error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper function
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('971') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 10 && cleaned.substring(1).startsWith('5')) {
    return `+971${cleaned.substring(1)}`;
  }
  if (cleaned.length >= 10 && cleaned.length <= 15) return `+${cleaned}`;
  return null;
}