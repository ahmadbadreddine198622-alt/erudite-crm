import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const toLast9Digits = (phone) => {
      if (!phone) return null;
      let digits = String(phone).replace(/\D/g, '');
      while (digits.startsWith('00')) digits = digits.slice(2);
      if (digits.startsWith('0') && digits.length === 10) digits = '971' + digits.slice(1);
      if (digits.length < 9) return digits.length > 0 ? digits : null;
      return digits.slice(-9);
    };

    // Sample: Get first 100 conversations without wa_saved_name
    const convs = await base44.entities.WhatsAppConversation.list(undefined, 100);
    const convsNoSavedName = convs.filter(c => !c.wa_saved_name || !c.wa_saved_name.trim());
    const convsWithSavedName = convs.filter(c => c.wa_saved_name && c.wa_saved_name.trim());

    // Get all Contacts
    const contacts = await base44.entities.Contact.list(undefined, 200);

    const stats = {
      sampleSize: convs.length,
      withSavedName: convsWithSavedName.length,
      emptySavedName: convsNoSavedName.length,
      contactsLoaded: contacts.length,
    };

    const missedMatches = [];

    for (const conv of convsNoSavedName) {
      const convPhone = conv.wa_phone_e164 || conv.phone_number;
      const last9 = toLast9Digits(convPhone);
      if (!last9) continue;

      for (const contact of contacts) {
        const cp = toLast9Digits(contact.phone);
        const cw = toLast9Digits(contact.whatsapp);
        if (cp === last9 || cw === last9) {
          missedMatches.push({
            wa_phone_e164: convPhone,
            wa_display_name: conv.wa_display_name || '(none)',
            contact_full_name: contact.full_name,
          });
          break;
        }
      }
    }

    stats.missedMatches = missedMatches.length;

    // Extrapolate for full dataset
    const extrapolatedTotal = convs.length > 0 
      ? Math.round((missedMatches.length / convs.length) * (convs.length * 10)) 
      : 0;

    return Response.json({
      summary: stats,
      missedMatches,
      note: 'Sample of 100 conversations. Extrapolated estimate based on sample.',
      extrapolatedMissedMatchesInFullDataset: extrapolatedTotal,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});