import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic function to map WhatsApp channels and identify 400 errors
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  try {
    // Get all conversations
    const conversations = await svc.entities.WhatsAppConversation.list('-last_message_at', 500);
    
    // Get all messages from both entities
    const waMessages = await svc.entities.WhatsAppMessage.list('-timestamp', 1000);
    const messages = await svc.entities.Message.list('-timestamp', 1000);
    
    // Get landlords and leads
    const landlords = await svc.entities.Landlord.list('-created_date', 2000);
    const leads = await svc.entities.Lead.list('-created_date', 2000);
    
    // Build phone maps
    const landlordPhones = new Map();
    landlords.forEach(ll => {
      if (ll.phone) landlordPhones.set(ll.phone.replace(/^\+/, ''), ll);
      if (ll.whatsapp) landlordPhones.set(ll.whatsapp.replace(/^\+/, ''), ll);
      if (ll.additional_phones) {
        ll.additional_phones.forEach(p => landlordPhones.set(p.replace(/^\+/, ''), ll));
      }
    });
    
    const leadPhones = new Map();
    leads.forEach(l => {
      if (l.phone) leadPhones.set(l.phone.replace(/^\+/, ''), l);
      if (l.whatsapp) leadPhones.set(l.whatsapp.replace(/^\+/, ''), l);
    });
    
    // Analyze conversations
    const channelMap = { business: 0, personal: 0, unknown: 0 };
    const unmatchedPhones = [];
    const convsWithoutLead = [];
    
    conversations.forEach(conv => {
      const channel = conv.channel || 'unknown';
      channelMap[channel] = (channelMap[channel] || 0) + 1;
      
      const phone = (conv.wa_phone_e164 || conv.phone_number || '').replace(/^\+/, '');
      const hasLandlord = !!conv.lead_id || landlordPhones.has(phone);
      const hasLead = !!conv.lead_id || leadPhones.has(phone);
      
      if (!hasLandlord && !hasLead) {
        unmatchedPhones.push({
          phone: conv.wa_phone_e164 || conv.phone_number,
          channel: conv.channel,
          status: conv.status,
          last_message_at: conv.last_message_at
        });
      }
      
      if (!conv.lead_id) {
        convsWithoutLead.push({
          id: conv.id,
          phone: conv.wa_phone_e164 || conv.phone_number,
          channel: conv.channel,
          status: conv.status
        });
      }
    });
    
    // Check recent messages for duplicates
    const messageCounts = new Map();
    waMessages.forEach(msg => {
      const key = `${msg.conversation_id}-${msg.wa_message_id}`;
      messageCounts.set(key, (messageCounts.get(key) || 0) + 1);
    });
    
    const duplicates = [];
    messageCounts.forEach((count, key) => {
      if (count > 1) duplicates.push({ key, count });
    });
    
    // Check entity field mappings
    const sampleWaMessage = waMessages[0];
    const sampleMessage = messages[0];
    
    return Response.json({
      summary: {
        total_conversations: conversations.length,
        business_channel: channelMap.business,
        personal_channel: channelMap.personal,
        unknown_channel: channelMap.unknown,
        unmatched_phones: unmatchedPhones.length,
        convs_without_lead: convsWithoutLead.length,
        wa_messages: waMessages.length,
        messages: messages.length,
        duplicate_messages: duplicates.length
      },
      unmatchedPhones: unmatchedPhones.slice(0, 20),
      convsWithoutLead: convsWithoutLead.slice(0, 20),
      duplicates: duplicates.slice(0, 10),
      sampleWaMessage: sampleWaMessage ? {
        id: sampleWaMessage.id,
        direction: sampleWaMessage.direction,
        from_number: sampleWaMessage.from_number,
        to_number: sampleWaMessage.to_number,
        conversation_id: sampleWaMessage.conversation_id
      } : null,
      sampleMessage: sampleMessage ? {
        id: sampleMessage.id,
        direction: sampleMessage.direction,
        phone: sampleMessage.phone,
        channel: sampleMessage.channel
      } : null,
      channelAnalysis: {
        businessMeta: 'Meta Cloud API / +971582806000 / erudite instance',
        personalEvolution: 'Evolution API (Baileys) / +971581806000 / personal instance',
        note: 'Business channel uses Meta Graph API, Personal uses Evolution webhook'
      }
    });
  } catch (e) {
    return Response.json({
      error: e?.message || String(e),
      stack: e?.stack
    }, { status: 500 });
  }
});