import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fetch WhatsApp profile information for a phone number using the WhatsApp Cloud API
 * Updates the conversation's wa_display_name field with the actual profile name
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversation_id, phone_number } = await req.json();
    
    if (!phone_number) {
      return Response.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Use management token for profile lookups
    const accessToken = Deno.env.get('WHATSAPP_MANAGEMENT_TOKEN') || Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_WABA_ID') || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    
    if (!accessToken || !phoneNumberId) {
      return Response.json({ error: 'WhatsApp secrets not configured' }, { status: 500 });
    }

    // Fetch contact info from WhatsApp API
    const contactUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/contacts?numbers=${encodeURIComponent(phone_number)}`;
    const contactResponse = await fetch(contactUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!contactResponse.ok) {
      const errorData = await contactResponse.json().catch(() => ({}));
      console.error('WhatsApp contact fetch failed:', errorData);
      return Response.json({ 
        error: 'Failed to fetch profile', 
        whatsapp_error: errorData 
      }, { status: 500 });
    }

    const contactData = await contactResponse.json();
    const contact = contactData?.data?.[0];

    if (!contact) {
      return Response.json({ 
        success: false, 
        message: 'Contact not found on WhatsApp' 
      });
    }

    const profileName = contact.profile?.name || '';
    const waId = contact.wa_id;

    // Update the conversation with profile name
    if (conversation_id && profileName) {
      await base44.entities.WhatsAppConversation.update(conversation_id, {
        wa_display_name: profileName,
        wa_phone_e164: waId || phone_number
      });
    }

    return Response.json({
      success: true,
      profile_name: profileName,
      wa_id: waId,
      conversation_id: conversation_id
    });
  } catch (error) {
    console.error('fetchWhatsAppProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});