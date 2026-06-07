import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time backfill: Copy existing Message records to WhatsAppMessage entity.
 * Maps fields and creates WhatsAppConversation records as needed.
 * Skips duplicates by wa_message_id.
 * Does NOT delete Message entity - leaves it as backup.
 */

async function findOrCreateConversation(serviceRole, phoneNumber, channel) {
  // Normalize phone - remove + prefix
  const digits = phoneNumber.replace(/^\+/, '');
  
  // Try to find existing conversation
  const existing = await serviceRole.entities.WhatsAppConversation.filter({
    wa_phone_e164: '+' + digits
  });
  
  if (existing && existing.length > 0) {
    return existing[0];
  }
  
  // Create new conversation
  const conversation = await serviceRole.entities.WhatsAppConversation.create({
    wa_phone_e164: '+' + digits,
    phone_number: '+' + digits,
    status: 'new',
    channel: channel || 'personal',
  });
  
  // Update conversation channel if it was unknown
  if (!conversation.channel || conversation.channel === 'unknown') {
    await serviceRole.entities.WhatsAppConversation.update(conversation.id, {
      channel: channel || 'personal'
    });
  }
  
  return conversation;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all Message records
    const messages = await base44.asServiceRole.entities.Message.list('-timestamp', 5000);
    
    if (!messages || messages.length === 0) {
      return Response.json({ 
        status: 'complete',
        copied: 0,
        skipped: 0,
        message: 'No messages to backfill'
      });
    }

    let copied = 0;
    let skipped = 0;
    let errors = 0;
    const conversationCache = {};

    for (const msg of messages) {
      try {
        // Skip if no wa_message_id (can't dedupe without it)
        if (!msg.wa_message_id) {
          errors++;
          continue;
        }

        // Check for duplicate in WhatsAppMessage
        const existing = await base44.asServiceRole.entities.WhatsAppMessage.filter({
          wa_message_id: msg.wa_message_id
        });

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        // Get or create conversation
        const phoneKey = msg.phone;
        let conversation = conversationCache[phoneKey];
        
        if (!conversation) {
          conversation = await findOrCreateConversation(
            base44.asServiceRole,
            msg.phone,
            msg.channel || 'personal'
          );
          conversationCache[phoneKey] = conversation;
        }

        // Map direction: incoming→inbound, outgoing→outbound
        const mappedDirection = msg.direction === 'incoming' ? 'inbound' : 'outbound';

        // Determine from_number and to_number
        const isOutbound = msg.direction === 'outgoing';
        const fromNumber = isOutbound ? '+971581806000' : ('+' + msg.phone);
        const toNumber = isOutbound ? ('+' + msg.phone) : '+971581806000';

        // Map media_type enum values
        let mappedMediaType = 'none';
        if (msg.media_type) {
          const mediaMap = {
            'image': 'image',
            'video': 'video',
            'audio': 'audio',
            'document': 'document',
            'sticker': 'none', // WhatsAppMessage doesn't have sticker
            'none': 'none'
          };
          mappedMediaType = mediaMap[msg.media_type] || 'none';
        }

        // Create WhatsAppMessage record
        const waMessage = {
          conversation_id: conversation.id,
          lead_id: msg.landlord_id || null,
          wa_message_id: msg.wa_message_id,
          direction: mappedDirection,
          body: msg.text || msg.caption || '',
          media_url: msg.media_url || null,
          media_type: mappedMediaType,
          status: msg.status || 'sent',
          timestamp: msg.timestamp,
          from_number: fromNumber,
          to_number: toNumber,
          channel: msg.channel || 'personal',
          is_deleted: msg.is_deleted || false,
        };

        // Add transcription fields if present
        if (msg.transcript) {
          waMessage.transcription = msg.transcript;
          waMessage.detected_language = msg.transcript_lang || null;
        }

        await base44.asServiceRole.entities.WhatsAppMessage.create(waMessage);
        copied++;

      } catch (err) {
        console.error(`[backfill] Error processing message ${msg.id}:`, err.message);
        errors++;
      }
    }

    return Response.json({
      status: 'complete',
      copied,
      skipped,
      errors,
      total: messages.length,
      message: `Backfilled ${copied} messages, skipped ${skipped} duplicates, ${errors} errors`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});