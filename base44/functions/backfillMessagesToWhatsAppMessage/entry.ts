import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time backfill: Copy existing Message records to WhatsAppMessage entity.
 * - 500ms delay between creates to avoid rate limits
 * - Resume-safe via wa_message_id dedupe (re-runs are idempotent)
 * - If dedupe filter fails (rate limit), SKIP that message - never create unchecked
 * - Same pass: populate WhatsAppConversation.channel for conversations missing it
 * - If conversation has BOTH business AND personal messages, leave empty and list as ambiguous
 */

const DELAY_MS = 500;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[backfill] Starting backfill with 500ms delay between operations...');

    // Fetch all Message records
    const messages = await base44.asServiceRole.entities.Message.list('-timestamp', 5000);
    
    if (!messages || messages.length === 0) {
      return Response.json({ 
        status: 'complete',
        copied: 0,
        skipped_existing: 0,
        errors: 0,
        conversations_updated: 0,
        conversations_ambiguous: 0,
        message: 'No messages to backfill'
      });
    }

    console.log(`[backfill] Found ${messages.length} Message records to process`);

    let copied = 0;
    let skipped_existing = 0;
    let errors = 0;
    
    // Track conversation channel distribution
    const convChannelMap = new Map(); // convId -> {business: count, personal: count, phone: string}
    const conversationCache = {};

    for (const msg of messages) {
      try {
        // Skip if no wa_message_id (can't dedupe without it)
        if (!msg.wa_message_id) {
          console.warn(`[backfill] SKIP message ${msg.id} - no wa_message_id`);
          errors++;
          await new Promise((r) => setTimeout(r, DELAY_MS));
          continue;
        }

        // Check for duplicate in WhatsAppMessage - SKIP if rate limited
        let existing;
        try {
          existing = await base44.asServiceRole.entities.WhatsAppMessage.filter({
            wa_message_id: msg.wa_message_id
          });
        } catch (dedupeErr) {
          const errMsg = String(dedupeErr?.message || dedupeErr);
          const is429 = dedupeErr?.status === 429 || /rate limit|429|too many requests/i.test(errMsg);
          if (is429) {
            console.warn(`[backfill] SKIP message ${msg.id} - dedupe filter rate limited, will retry later`);
            errors++;
            await new Promise((r) => setTimeout(r, DELAY_MS));
            continue;
          }
          throw dedupeErr;
        }

        if (existing && existing.length > 0) {
          skipped_existing++;
          await new Promise((r) => setTimeout(r, DELAY_MS));
          continue;
        }

        // Get or create conversation
        const phoneKey = msg.phone;
        let conversation = conversationCache[phoneKey];
        
        if (!conversation) {
          try {
            const existingConvs = await base44.asServiceRole.entities.WhatsAppConversation.filter({
              wa_phone_e164: msg.phone.startsWith('+') ? msg.phone : '+' + msg.phone
            });
            
            if (existingConvs && existingConvs.length > 0) {
              conversation = existingConvs[0];
            } else {
              conversation = await base44.asServiceRole.entities.WhatsAppConversation.create({
                wa_phone_e164: msg.phone.startsWith('+') ? msg.phone : '+' + msg.phone,
                phone_number: msg.phone.startsWith('+') ? msg.phone : '+' + msg.phone,
                status: 'new',
                channel: msg.channel || 'personal',
              });
            }
            conversationCache[phoneKey] = conversation;
          } catch (convErr) {
            console.error(`[backfill] Error getting/creating conversation for ${msg.phone}:`, convErr.message);
            errors++;
            await new Promise((r) => setTimeout(r, DELAY_MS));
            continue;
          }
        }

        // Track channel distribution for this conversation
        const msgChannel = msg.channel || 'personal';
        if (!convChannelMap.has(conversation.id)) {
          convChannelMap.set(conversation.id, { 
            business: 0, 
            personal: 0,
            phone: conversation.wa_phone_e164 
          });
        }
        const channelCounts = convChannelMap.get(conversation.id);
        if (msgChannel === 'business') {
          channelCounts.business++;
        } else if (msgChannel === 'personal') {
          channelCounts.personal++;
        }

        // Map direction: incoming→inbound, outgoing→outbound
        const mappedDirection = msg.direction === 'incoming' ? 'inbound' : 'outbound';

        // Determine from_number and to_number
        const isOutbound = msg.direction === 'outgoing';
        const fromNumber = isOutbound ? (msg.channel === 'business' ? '+971582806000' : '+971581806000') : ('+' + msg.phone);
        const toNumber = isOutbound ? ('+' + msg.phone) : (msg.channel === 'business' ? '+971582806000' : '+971581806000');

        // Map media_type enum values
        let mappedMediaType = 'none';
        if (msg.media_type) {
          const mediaMap = {
            'image': 'image',
            'video': 'video',
            'audio': 'audio',
            'document': 'document',
            'sticker': 'none',
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
        console.log(`[backfill] Copied message ${msg.id} -> WhatsAppMessage (conversation=${conversation.id}, channel=${msgChannel})`);

        // Delay between creates
        await new Promise((r) => setTimeout(r, DELAY_MS));

      } catch (err) {
        console.error(`[backfill] Error processing message ${msg.id}:`, err.message);
        errors++;
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    // Update conversation channels where unambiguous
    console.log('[backfill] Updating conversation channels...');
    let conversations_updated = 0;
    const ambiguous_conversations = [];

    for (const [convId, counts] of convChannelMap.entries()) {
      try {
        // Get fresh conversation data
        const convList = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: convId });
        if (!convList || !convList[0]) continue;
        
        const conv = convList[0];
        const currentChannel = conv.channel;
        
        // Skip if already has a channel (not empty/null/unknown)
        if (currentChannel && currentChannel !== 'unknown' && currentChannel !== '') {
          console.log(`[backfill] SKIP conv ${convId} - already has channel: ${currentChannel}`);
          continue;
        }
        
        // Check if ambiguous (has BOTH business AND personal messages)
        if (counts.business > 0 && counts.personal > 0) {
          ambiguous_conversations.push({
            conversation_id: convId,
            phone: counts.phone,
            business_count: counts.business,
            personal_count: counts.personal,
          });
          console.log(`[backfill] AMBIGUOUS conv ${convId}: business=${counts.business}, personal=${counts.personal}`);
          continue;
        }
        
        // Determine channel
        let newChannel = null;
        if (counts.business > 0) {
          newChannel = 'business';
        } else if (counts.personal > 0) {
          newChannel = 'personal';
        }
        
        if (newChannel) {
          await base44.asServiceRole.entities.WhatsAppConversation.update(convId, { channel: newChannel });
          conversations_updated++;
          console.log(`[backfill] UPDATED conv ${convId} channel to ${newChannel}`);
        }
        
        // Delay between updates
        await new Promise((r) => setTimeout(r, DELAY_MS));
        
      } catch (e) {
        console.error(`[backfill] Error updating conversation ${convId}:`, e.message);
      }
    }

    return Response.json({
      status: 'complete',
      copied,
      skipped_existing,
      errors,
      total: messages.length,
      conversations_updated,
      conversations_ambiguous: ambiguous_conversations.length,
      ambiguous_conversations,
      message: `Backfilled ${copied} messages, skipped ${skipped_existing} duplicates, ${errors} errors, updated ${conversations_updated} conversation channels, ${ambiguous_conversations.length} ambiguous`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});