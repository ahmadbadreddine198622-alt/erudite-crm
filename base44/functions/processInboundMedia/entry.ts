import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * PHASE 1 — Inbound media downloader (fired async by evolutionWebhook).
 *
 * Given a Message id (already saved with media metadata + media_status='pending'),
 * downloads the media bytes from Evolution, persists them to Base44 storage, and
 * writes media_url back on the Message. For voice notes, hands off to Phase 2
 * (transcribeVoiceMessage) — which no-ops gracefully until OPENAI_API_KEY is set.
 *
 * Resilience: up to 3 inline download attempts; on exhaustion the Message is left
 * media_status='download_failed' (with media_retry_count) so a sweep can retry —
 * the message itself is never lost (it was saved by the webhook).
 *
 * Secrets: EVOLUTION_API_URL, EVOLUTION_API_KEY.
 * Evolution v2 endpoint: POST {URL}/chat/getBase64FromMediaMessage/{instance}
 *   body { message: { key: { remoteJid, fromMe, id } }, convertToMp4: false }
 *   → { base64, mimetype, fileName? }
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
  const instance = (body.instance || 'erudite_whatsapp');
  if (!messageId) return Response.json({ error: 'message_id required' }, { status: 400 });

  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

  // Load the message
  const rows = await svc.entities.Message.filter({ id: messageId });
  const msg = rows?.[0];
  if (!msg) return Response.json({ error: 'message not found', messageId }, { status: 404 });
  if (!msg.media_type) return Response.json({ status: 'no_media' });
  if (msg.media_status === 'ready' && msg.media_url) return Response.json({ status: 'already_done' });

  if (!apiUrl || !apiKey) {
    await svc.entities.Message.update(messageId, { media_status: 'download_failed', media_error: 'Evolution secrets missing' });
    return Response.json({ error: 'Evolution secrets missing' }, { status: 500 });
  }

  const remoteJid = `${msg.phone}@s.whatsapp.net`;
  const waId = msg.wa_message_id;
  const endpoint = `${apiUrl}/chat/getBase64FromMediaMessage/${instance}`;
  const payload = { message: { key: { remoteJid, fromMe: false, id: waId } }, convertToMp4: false };

  let lastErr = '';
  let base64 = '';
  let mimetype = msg.media_mime || '';
  let fileName = msg.media_filename || '';

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
        mimetype = parsed.mimetype || mimetype;
        fileName = parsed.fileName || fileName;
        break;
      } else { lastErr = 'no base64 in response'; }
    } catch (e) {
      lastErr = String(e?.message || e);
    }
    // small linear backoff between attempts
    if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
  }

  if (!base64) {
    const retries = (msg.media_retry_count || 0) + 1;
    await svc.entities.Message.update(messageId, {
      media_status: 'download_failed',
      media_retry_count: retries,
      media_error: lastErr.slice(0, 300),
    });
    return Response.json({ status: 'download_failed', error: lastErr, retries });
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
    const retries = (msg.media_retry_count || 0) + 1;
    await svc.entities.Message.update(messageId, {
      media_status: 'upload_failed',
      media_retry_count: retries,
      media_error: ('upload: ' + String(e?.message || e)).slice(0, 300),
    });
    return Response.json({ status: 'upload_failed', error: String(e?.message || e), retries });
  }

  await svc.entities.Message.update(messageId, {
    media_url: fileUrl,
    media_mime: mimetype,
    media_status: 'ready',
    media_error: '',
  });

  // Phase 2 handoff: voice notes → transcription (no-ops until OPENAI_API_KEY is set)
  if (msg.is_voice_note || msg.media_type === 'audio') {
    svc.functions.invoke('transcribeVoiceMessage', { message_id: messageId }).catch(() => {});
  }

  return Response.json({ status: 'ready', media_url: fileUrl, message_id: messageId });
});
