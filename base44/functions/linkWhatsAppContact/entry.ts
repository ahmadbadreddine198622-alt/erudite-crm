import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Link WhatsApp conversation to a contact (or create new contact if needed)
 * Called when: WhatsApp message received OR contact created
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone_number, conversation_id, message_preview, create_if_missing } = await req.json();
    
    if (!phone_number || !conversation_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize phone number
    const normalized = normalizePhoneNumber(phone_number);
    if (!normalized) {
      return Response.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    // Search for existing contact with this phone number
    const leads = await base44.entities.Lead.list();
    let existingLead = leads.find(l => {
      if (l.phone && phonesMatch(l.phone, normalized)) return true;
      if (l.phones && Array.isArray(l.phones)) {
        return l.phones.some(p => phonesMatch(p.number, normalized));
      }
      return false;
    });

    // If no lead found and create_if_missing is true, create new contact
    if (!existingLead && create_if_missing) {
      existingLead = await base44.entities.Lead.create({
        name: `Contact ${normalized}`,
        phone: normalized,
        phones: [{ number: normalized, label: 'whatsapp', is_primary: true }],
        source: 'whatsapp',
        stage: 'new_lead',
        source_metadata: { whatsapp_id: conversation_id }
      });
    }

    // Update or create WhatsAppConversation
    const conversation = await base44.entities.WhatsAppConversation.list();
    let waConv = conversation.find(c => c.id === conversation_id);
    
    if (!waConv) {
      waConv = await base44.entities.WhatsAppConversation.create({
        phone_number: normalized,
        lead_id: existingLead?.id,
        status: 'open',
        last_message: message_preview,
        last_message_at: new Date().toISOString()
      });
    } else if (existingLead && !waConv.lead_id) {
      // Link existing conversation to lead
      await base44.entities.WhatsAppConversation.update(conversation_id, {
        lead_id: existingLead.id
      });
    }

    return Response.json({
      success: true,
      lead_id: existingLead?.id,
      conversation_id: waConv.id
    });
  } catch (error) {
    console.error('linkWhatsAppContact error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper functions (same as lib/phoneUtils.js)
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

function phonesMatch(phone1, phone2) {
  const norm1 = normalizePhoneNumber(phone1);
  const norm2 = normalizePhoneNumber(phone2);
  return norm1 && norm2 && norm1 === norm2;
}