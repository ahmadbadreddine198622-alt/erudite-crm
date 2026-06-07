import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Sends a media file (PDF/image) via Evolution API sendMedia endpoint.
 * Payload: { landlord_id, file_url, file_name, media_type }
 * media_type: "document" | "image"
 */

function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').replace(/\s/g, '');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { landlord_id, file_url, file_name, media_type = 'document' } = await req.json();
  if (!landlord_id || !file_url) {
    return Response.json({ error: 'landlord_id and file_url are required' }, { status: 400 });
  }

  const landlord = await base44.entities.Landlord.filter({ id: landlord_id });
  const l = Array.isArray(landlord) ? landlord[0] : landlord;
  if (!l) return Response.json({ error: 'Landlord not found' }, { status: 404 });

  const rawPhone = l.whatsapp || l.phone;
  if (!rawPhone) return Response.json({ error: 'Landlord has no phone number' }, { status: 400 });

  const digitsPhone = stripPlus(rawPhone);
  const remoteJid = `${digitsPhone}@s.whatsapp.net`;

  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  const INSTANCE = 'erudite_whatsapp';

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return Response.json({ error: 'Evolution API not configured' }, { status: 500 });
  }

  const endpoint = `${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE}`;

  const payload = {
    number: remoteJid,
    mediatype: media_type,
    mimetype: media_type === 'document' ? 'application/pdf' : 'image/jpeg',
    caption: file_name || '',
    media: file_url,
    fileName: file_name || 'attachment',
  };

  const evoRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!evoRes.ok) {
    const errText = await evoRes.text();
    return Response.json({ error: 'Evolution API error', detail: errText }, { status: 502 });
  }

  const evoData = await evoRes.json();

  // Save the media message to Message entity for thread display
  const timestamp = new Date().toISOString();
  await base44.asServiceRole.entities.Message.create({
    landlord_id,
    phone: digitsPhone,
    direction: 'outgoing',
    text: `📎 ${file_name || 'Attachment'}`,
    timestamp,
    status: 'sent',
    wa_message_id: evoData?.key?.id || null,
  });

  return Response.json({ ok: true, evo: evoData });
});