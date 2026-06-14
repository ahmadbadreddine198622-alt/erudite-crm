import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic function to probe why landlord profile photos aren't appearing.
 * Compares Landlord phone fields against WhatsAppConversation phone fields.
 * READ-ONLY — no writes.
 */

// Normalize phone for matching: strip +, spaces, dashes, parentheses, leading zeros; key on last 9-12 digits
function normalizePhone(phone) {
  if (!phone) return '';
  const stripped = phone.replace(/[\s+\-()]/g, '');
  const noLeadingZeros = stripped.replace(/^0+/, '');
  return noLeadingZeros.slice(-12);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch 20 landlords
    const landlords = await base44.entities.Landlord.list('-created_date', 20);
    
    // Fetch all WhatsApp conversations (we need to match against all of them)
    const conversations = await base44.entities.WhatsAppConversation.list(null, 2000);

    const results = [];
    let exactMatchCount = 0;
    let normalizedMatchCount = 0;
    let hasPhotoCount = 0;
    let landlordsWithPhoneCount = 0;

    for (const landlord of landlords) {
      // Collect all phone-like fields that exist on this landlord
      const phoneFields = {
        phone: landlord.phone || null,
        whatsapp: landlord.whatsapp || null,
        additional_phones: landlord.additional_phones || null,
        phone_e164: landlord.phone_e164 || null,
      };

      // Build a list of all phone values to try matching
      const allPhones = [
        landlord.phone,
        landlord.whatsapp,
        ...(landlord.additional_phones || []),
        landlord.phone_e164,
      ].filter(Boolean);

      if (allPhones.length > 0) landlordsWithPhoneCount++;

      // Try to find a matching conversation
      let exactMatch = null;
      let normalizedMatch = null;

      for (const conv of conversations) {
        // Exact match on wa_phone_e164 or phone_number
        for (const lpPhone of allPhones) {
          if (conv.wa_phone_e164 === lpPhone || conv.phone_number === lpPhone) {
            exactMatch = conv;
            break;
          }
        }
        if (exactMatch) break;

        // Normalized match
        for (const lpPhone of allPhones) {
          const normLp = normalizePhone(lpPhone);
          const normConv1 = normalizePhone(conv.wa_phone_e164);
          const normConv2 = normalizePhone(conv.phone_number);
          if (normLp && (normLp === normConv1 || normLp === normConv2)) {
            normalizedMatch = conv;
            break;
          }
        }
        if (normalizedMatch) break;
      }

      const match = exactMatch || normalizedMatch;
      const matchType = exactMatch ? 'exact' : (normalizedMatch ? 'normalized' : null);

      if (exactMatch) exactMatchCount++;
      else if (normalizedMatch) normalizedMatchCount++;

      let photoInfo = null;
      if (match) {
        const photoUrl = match.wa_profile_pic_url;
        const hasPhoto = !!photoUrl;
        const isDrive = photoUrl?.includes('drive.google.com') || false;
        const isCdn = photoUrl?.includes('pps.whatsapp.net') || false;
        
        photoInfo = {
          has_photo: hasPhoto,
          url: photoUrl,
          is_drive_url: isDrive,
          is_cdn_url: isCdn,
          wa_phone_e164: match.wa_phone_e164,
        };

        if (hasPhoto && !isDrive) hasPhotoCount++;
      }

      results.push({
        landlord_id: landlord.id,
        landlord_name: landlord.full_name_en || landlord.full_name || 'Unknown',
        phone_fields: phoneFields,
        all_phones_tried: allPhones,
        match_type: matchType,
        matched_conversation_id: match?.id || null,
        matched_wa_phone_e164: match?.wa_phone_e164 || null,
        photo_info: photoInfo,
      });
    }

    const summary = {
      total_landlords: landlords.length,
      landlords_with_any_phone: landlordsWithPhoneCount,
      exact_matches: exactMatchCount,
      normalized_matches: normalizedMatchCount,
      total_matches: exactMatchCount + normalizedMatchCount,
      matched_with_usable_photo: hasPhotoCount,
    };

    return Response.json({
      status: 'success',
      summary,
      details: results,
    });
  } catch (err) {
    return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});