import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * fetchProfilePicBase64 — resolves a landlord's WhatsApp profile picture and
 * returns it as a base64 data URL so the client can embed it into a vCard PHOTO
 * field (CORS blocks the browser from reading Evolution CDN image bytes).
 *
 * Lookup order:
 *   1. Landlord.wa_profile_pic_url (synced by syncPeninsulaProfilePics)
 *   2. WhatsAppConversation.wa_profile_pic_url matching the landlord's phone
 *   3. Live Evolution API fetchProfilePictureUrl (fallback)
 *
 * Returns { dataUrl, contentType } or { dataUrl: null } when no photo exists.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const landlordId = payload.landlord_id;
    const directUrl = payload.url;

    if (!landlordId && !directUrl) {
      return Response.json({ error: 'landlord_id or url required' }, { status: 400 });
    }

    let url = directUrl || null;
    let phone = null;

    if (!url && landlordId) {
      const landlord = await base44.entities.Landlord.get(landlordId).catch(() => null);
      if (landlord) {
        if (landlord.wa_profile_pic_url && landlord.wa_profile_pic_url !== 'no_photo') {
          url = landlord.wa_profile_pic_url;
        }
        phone = landlord.phone || landlord.whatsapp || (landlord.additional_phones || [])[0] || null;
      }
    }

    // Fallback: WhatsAppConversation lookup by phone.
    if (!url && phone) {
      const norm = (p) => { if (!p) return ''; const s = p.replace(/[\s+\-()]/g, '').replace(/^0+/, ''); return s.slice(-12); };
      const target = norm(phone);
      const convs = await base44.entities.WhatsAppConversation.filter(
        { wa_profile_pic_url: { $ne: null } },
        null,
        2000,
      ).catch(() => []);
      const match = (convs || []).find((c) => norm(c.wa_phone_e164 || c.phone_number) === target);
      if (match && match.wa_profile_pic_url && !match.wa_profile_pic_url.includes('drive.google.com')) {
        url = match.wa_profile_pic_url;
      }
    }

    // Fallback: live Evolution API.
    if (!url && phone) {
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
      const instance = Deno.env.get('EVOLUTION_INSTANCE') || 'erudite_whatsapp';
      if (evolutionApiUrl && evolutionApiKey) {
        try {
          const res = await fetch(`${evolutionApiUrl}/chat/fetchProfilePictureUrl/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
            body: JSON.stringify({ number: phone.replace(/[^\d]/g, '') }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.profilePictureUrl) url = data.profilePictureUrl;
        } catch { /* ignore */ }
      }
    }

    if (!url || url === 'no_photo') {
      return Response.json({ dataUrl: null, reason: 'no_photo' });
    }

    // Fetch the image bytes and base64-encode.
    const imgRes = await fetch(url);
    if (!imgRes.ok) return Response.json({ dataUrl: null, reason: `fetch_failed_${imgRes.status}` });
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buf = await imgRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Base64 encode in chunks (btoa on large strings can overflow).
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${contentType};base64,${base64}`;

    return Response.json({ dataUrl, contentType });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});