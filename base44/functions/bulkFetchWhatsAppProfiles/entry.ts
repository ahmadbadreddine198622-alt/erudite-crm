import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Bulk fetch WhatsApp profile names for all conversations missing display names
 * Run this periodically to enrich contact data
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use management token for profile lookups
    const accessToken = Deno.env.get('WHATSAPP_MANAGEMENT_TOKEN') || Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_WABA_ID') || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    
    if (!accessToken || !phoneNumberId) {
      return Response.json({ error: 'WhatsApp secrets not configured' }, { status: 500 });
    }

    // Find conversations missing display names
    const conversations = await base44.asServiceRole.entities.WhatsAppConversation.list('', 500);
    const missingNames = conversations.filter(c => !c.wa_display_name || c.wa_display_name.trim() === '');

    if (missingNames.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'All conversations have profile names',
        processed: 0 
      });
    }

    const results = [];
    
    // WhatsApp Cloud API doesn't allow fetching arbitrary user profiles
    // Instead, we'll try to match with existing leads/landlords
    const leads = await base44.asServiceRole.entities.Lead.list('', 500);
    const landlords = await base44.asServiceRole.entities.Landlord.list('', 500);
    
    for (const conv of missingNames) {
      try {
        const phone = conv.wa_phone_e164 || conv.phone_number;
        if (!phone) continue;

        // Try to find matching lead by phone
        const normalizedPhone = phone.replace(/[^\d+]/g, '');
        const matchingLead = leads.find(lead => {
          const leadPhone = lead.phone?.replace(/[^\d+]/g, '');
          const leadWhatsapp = lead.whatsapp?.replace(/[^\d+]/g, '');
          return leadPhone === normalizedPhone || leadWhatsapp === normalizedPhone;
        });

        // Try to find matching landlord by phone
        const matchingLandlord = landlords.find(ll => {
          const llPhone = ll.phone?.replace(/[^\d+]/g, '');
          const llAdditional = ll.additional_phones?.some(p => p.replace(/[^\d+]/g, '') === normalizedPhone);
          return llPhone === normalizedPhone || llAdditional;
        });

        const displayName = matchingLandlord?.full_name_en || matchingLead?.full_name || '';

        if (displayName) {
          await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, {
            wa_display_name: displayName
          });
          results.push({ 
            conversation_id: conv.id, 
            phone, 
            profile_name: displayName,
            source: matchingLandlord ? 'landlord' : 'lead',
            status: 'updated' 
          });
        } else {
          results.push({ 
            conversation_id: conv.id, 
            phone, 
            status: 'no_match' 
          });
        }
      } catch (err) {
        console.error(`Failed to match profile for ${conv.id}:`, err);
        results.push({ 
          conversation_id: conv.id, 
          phone: conv.wa_phone_e164 || conv.phone_number,
          status: 'error',
          error: err.message 
        });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const noProfile = results.filter(r => r.status === 'no_profile').length;
    const failed = results.filter(r => r.status === 'fetch_failed' || r.status === 'error').length;

    return Response.json({
      success: true,
      summary: `${updated} updated, ${noProfile} no profile, ${failed} failed`,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('bulkFetchWhatsAppProfiles error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});