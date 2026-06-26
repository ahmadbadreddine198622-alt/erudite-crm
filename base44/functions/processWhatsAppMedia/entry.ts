import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * processWhatsAppMedia — Downloads media for a WhatsAppMessage record and
 * writes media_url back onto it.
 *
 * The evolutionWebhook stores media_type + raw_payload on WhatsAppMessage but
 * does NOT download the actual image/video/audio. This function fetches the
 * media bytes from Evolution API (getBase64FromMediaMessage), uploads them to
 * Base44 storage, and stamps media_url on the WhatsAppMessage so the inbox /
 * landlord detail thread can render it inline.
 *
 * Payload: { message_id, instance }
 * instance defaults to 'erudite_whatsapp' (personal channel).
 */
function b64ToBytes(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const EXT = {
  image: 'jpg', video: 'mp4', audio: 'ogg', sticker: 'webp', document: 'bin',
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) { /* none */ }
  const messageId = body.message_id;
  const instance = body.instance || 'erudite_whatsapp';
  if (!messageId) return Response.json({ error: 'message_id required' }, { status: 400 });

  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

  // Load the WhatsAppMessage
  const rows = await svc.entities.WhatsAppMessage.filter({ id: messageId });
  const msg = rows?.[0];
  if (!msg) return Response.json({ error: 'whatsapp message not found', messageId }, { status: 404 });
  if (!msg.media_type || msg.media_type === 'none') return Response.json({ status: 'no_media' });
  if (msg.media_url) return Response.json({ status: 'already_done', media_url: msg.media_url });

  if (!apiUrl || !apiKey) {
    return Response.json({ error: 'Evolution secrets missing' }, { status: 500 });
  }

  // Extract wa_message_id and remoteJid from the message record or raw_payload
  const waId = msg.wa_message_id;
  const rawPayload = msg.raw_payload || {};
  const rawKey = rawPayload.key || {};
  const remoteJid = rawKey.remoteJid || `${(msg.direction === 'inbound' ? msg.from_number : msg.to_number || '').replace(/\D/g, '')}@s.whatsapp.net`;
  const fromMe = msg.direction === 'outbound';

  if (!waId || !remoteJid) {
    return Response.json({ error: 'missing wa_message_id or remoteJid for media fetch', messageId }, { status: 422 });
  }

  const endpoint = `${apiUrl}/chat/getBase64FromMediaMessage/${instance}`;
  const payload = { message: { key: { remoteJid, fromMe, id: waId } }, convertToMp4: false };

  let lastErr = '';
  let base64 = '';
  let mimetype = '';
  let fileName = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify(payload),
      });
      const raw = await resp.text();
      let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; }
      if (!resp.ok) { lastErr = `HTTP ${resp.status}: ${raw.slice(0, 200)}`; }
      else if (parsed?.base64) {
        base64 = parsed.base64;
        mimetype = parsed.mimetype || '';
        fileName = parsed.fileName || '';
        break;
      } else { lastErr = 'no base64 in response'; }
    } catch (e) {
      lastErr = String(e?.message || e);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
  }

  if (!base64) {
    await svc.entities.WhatsAppMessage.update(messageId, { media_error: lastErr.slice(0, 300) }).catch(() => {});
    return Response.json({ status: 'download_failed', error: lastErr, messageId });
  }

  // Persist to Base44 storage
  let fileUrl = '';
  try {
    const bytes = b64ToBytes(base64);
    const ext = (fileName && fileName.includes('.')) ? '' : ('.' + (EXT[msg.media_type] || 'bin'));
    const name = (fileName || `${msg.media_type}_${waId || messageId}`) + ext;
    const file = new File([bytes], name, { type: mimetype || 'application/octet-stream' });
    const up = await base44.integrations.Core.UploadFile({ file });
    fileUrl = up?.file_url || up?.data?.file_url || '';
  } catch (e) {
    await svc.entities.WhatsAppMessage.update(messageId, { media_error: ('upload: ' + String(e?.message || e)).slice(0, 300) }).catch(() => {});
    return Response.json({ status: 'upload_failed', error: String(e?.message || e), messageId });
  }

  await svc.entities.WhatsAppMessage.update(messageId, {
    media_url: fileUrl,
  });

  // Voice note handoff to transcription
  if (msg.is_voice_note || msg.media_type === 'audio') {
    svc.functions.invoke('transcribeVoiceMessage', { message_id: messageId, entity: 'WhatsAppMessage' }).catch(() => {});
  }

  return Response.json({ status: 'ready', media_url: fileUrl, message_id: messageId });
});