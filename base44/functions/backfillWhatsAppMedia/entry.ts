import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * backfillWhatsAppMedia — Scans existing WhatsAppMessage records that have
 * a media_type (image/video/audio) but no media_url, downloads the media
 * from Evolution API, uploads to Base44 storage, and stamps media_url.
 *
 * Inlined (no cross-function invoke) for reliability. Processes up to 40
 * records per run (to stay within the timeout). Old messages may return
 * "Message not found" from Evolution (media expires ~30 days).
 */
function b64ToBytes(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const EXT = { image: 'jpg', video: 'mp4', audio: 'ogg', sticker: 'webp', document: 'bin' };

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

  const svc = base44.asServiceRole;
  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!apiUrl || !apiKey) return Response.json({ error: 'Evolution secrets missing' }, { status: 500 });

  const all = await svc.entities.WhatsAppMessage.list('-created_date', 500);
  const candidates = (all || []).filter(m =>
    m.media_type && m.media_type !== 'none' && !m.media_url && m.direction === 'inbound' && m.wa_message_id
  );

  let downloaded = 0;
  let failed = 0;
  let alreadyExpired = 0;

  for (const msg of candidates.slice(0, 40)) {
    try {
      const instance = msg.channel === 'business' ? 'erudite'
        : msg.channel === 'malik' ? 'Malik'
        : msg.channel === 'sameie' ? 'Samy'
        : msg.channel === 'dari' ? 'Dari'
        : 'erudite_whatsapp';

      const rawPayload = msg.raw_payload || {};
      const rawKey = rawPayload.key || {};
      const remoteJid = rawKey.remoteJid || `${(msg.from_number || '').replace(/\D/g, '')}@s.whatsapp.net`;

      if (!remoteJid || !msg.wa_message_id) { failed++; continue; }

      const endpoint = `${apiUrl}/chat/getBase64FromMediaMessage/${instance}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ message: { key: { remoteJid, fromMe: false, id: msg.wa_message_id } }, convertToMp4: false }),
      });
      const raw = await resp.text();
      let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; }

      if (!resp.ok || !parsed?.base64) {
        if (resp.status === 400 || resp.status === 404) alreadyExpired++;
        else failed++;
        continue;
      }

      const bytes = b64ToBytes(parsed.base64);
      const mimetype = parsed.mimetype || '';
      const fileName = parsed.fileName || '';
      const ext = (fileName && fileName.includes('.')) ? '' : ('.' + (EXT[msg.media_type] || 'bin'));
      const name = (fileName || `${msg.media_type}_${msg.wa_message_id}`) + ext;
      const file = new File([bytes], name, { type: mimetype || 'application/octet-stream' });
      const up = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = up?.file_url || up?.data?.file_url || '';

      if (fileUrl) {
        await svc.entities.WhatsAppMessage.update(msg.id, { media_url: fileUrl });
        downloaded++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      console.error(`[backfillWhatsAppMedia] failed for ${msg.id}:`, e?.message || e);
    }
  }

  return Response.json({
    status: 'ok',
    scanned: all?.length || 0,
    candidates: candidates.length,
    downloaded,
    failed,
    alreadyExpired,
  });
});