import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

// Normalize phone for comparison: strip +, spaces, dashes, parentheses, leading zeros
function normalizePhone(phone) {
  if (!phone) return '';
  const stripped = phone.replace(/[\s+\-()]/g, '');
  // Remove leading zeros but keep country code
  const noLeadingZeros = stripped.replace(/^0+/, '');
  // Return last 10-12 digits for comparison
  return noLeadingZeros.slice(-12);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch 15 recent Leads
    const leads = await base44.entities.Lead.list('-created_date', 15);
    
    if (!leads || leads.length === 0) {
      return Response.json({
        status: 'success',
        message: 'No leads found',
        results: [],
        summary: { total: 0, has_phone: 0, exact_match: 0, normalized_match: 0, with_photo: 0 }
      });
    }

    // Fetch all WhatsApp conversations (we'll match in memory)
    const conversations = await base44.entities.WhatsAppConversation.list(null, 500);
    
    const results = [];
    let hasPhoneCount = 0;
    let exactMatchCount = 0;
    let normalizedMatchCount = 0;
    let withPhotoCount = 0;

    for (const lead of leads) {
      // Dump all phone-like fields from Lead
      const leadPhones = {
        phone: lead.phone || null,
        whatsapp: lead.whatsapp || null,
        phone_e164: lead.phone_e164 || null,
        mobile: lead.mobile || null,
        primary_phone: lead.primary_phone || null
      };

      // Collect all non-null phone values from lead
      const allLeadPhoneValues = Object.values(leadPhones).filter(v => v !== null && v !== '');
      
      if (allLeadPhoneValues.length === 0) {
        results.push({
          lead_id: lead.id,
          lead_name: lead.full_name || lead.first_name || 'Unknown',
          lead_phones: leadPhones,
          match_status: 'no_phone_on_lead',
          exact_match: false,
          normalized_match: false,
          matched_conversation: null
        });
        continue;
      }

      hasPhoneCount++;

      // Try to find matching conversation
      let exactMatch = null;
      let normalizedMatch = null;

      // Try exact match first
      for (const leadPhone of allLeadPhoneValues) {
        exactMatch = conversations.find(conv => 
          (conv.wa_phone_e164 === leadPhone) || 
          (conv.phone_number === leadPhone)
        );
        if (exactMatch) break;
      }

      // Try normalized match
      if (!exactMatch) {
        for (const leadPhone of allLeadPhoneValues) {
          const normalizedLead = normalizePhone(leadPhone);
          normalizedMatch = conversations.find(conv => {
            const normalizedConvWa = normalizePhone(conv.wa_phone_e164);
            const normalizedConvPhone = normalizePhone(conv.phone_number);
            return normalizedLead && (normalizedLead === normalizedConvWa || normalizedLead === normalizedConvPhone);
          });
          if (normalizedMatch) break;
        }
      }

      const matchedConv = exactMatch || normalizedMatch;
      const hasPhoto = matchedConv?.wa_profile_pic_url ? true : false;

      if (exactMatch) exactMatchCount++;
      if (normalizedMatch && !exactMatch) normalizedMatchCount++;
      if (hasPhoto) withPhotoCount++;

      results.push({
        lead_id: lead.id,
        lead_name: lead.full_name || lead.first_name || 'Unknown',
        lead_phones: leadPhones,
        match_status: exactMatch ? 'exact' : (normalizedMatch ? 'normalized' : (matchedConv ? 'normalized' : 'no_match')),
        exact_match: !!exactMatch,
        normalized_match: !!(normalizedMatch || exactMatch),
        matched_conversation: matchedConv ? {
          conversation_id: matchedConv.id,
          wa_phone_e164: matchedConv.wa_phone_e164,
          phone_number: matchedConv.phone_number,
          has_profile_pic: hasPhoto,
          wa_profile_pic_url: matchedConv.wa_profile_pic_url || null
        } : null
      });
    }

    return Response.json({
      status: 'success',
      message: `Processed ${leads.length} leads`,
      results,
      summary: {
        total: leads.length,
        has_phone: hasPhoneCount,
        exact_match: exactMatchCount,
        normalized_match: normalizedMatchCount,
        total_matched: exactMatchCount + normalizedMatchCount,
        with_photo: withPhotoCount
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});