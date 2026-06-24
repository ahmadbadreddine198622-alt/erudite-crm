import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * metaDownloadVoice — fetch a Meta Cloud API voice/audio note by its media_id, store it to Base44
 * file storage, set Message.media_url, then hand off to transcribeVoiceMessage so the landlord brain
 * reads the actual words instead of the "🎤 Voice message" placeholder.
 *
 * WHY THIS EXISTS: Meta delivers inbound media as a media_id (not a downloadable URL), and the URL it
 * resolves to also requires the Bearer token — so metaWhatsAppWebhook can't transcribe inline. It
 * fires this function fire-and-forget off the webhook hot path.
 *
 * Mirrors the proven Evolution path (processInboundMedia): download → Core.UploadFile → set media_url
 * → invoke transcribeVoiceMessage. FULLY DEGRADE-SAFE: every failure records media_status/media_error
 * and returns; it never throws, so it can never affect the webhook or the landlord's existing row. If
 * this function isn't deployed yet, the webhook's invoke just no-ops (caught) and voice stays as the
 * placeholder — i.e. exactly today's behaviour.
 *
 * Reuses the same Meta auth as sendWhatsAppMessage (WHATSAPP_ACCESS_TOKEN, Graph v21.0).
 *
 * Body: { message_id: string, media_id: string }
 */

// mime → file extension, matching the audio types Meta/WhatsApp emit for voice notes.
const EXT = {
  'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'audio/amr': 'amr', 'audio/wav': 'wav', 'audio/webm': 'webm',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const messageId = String(body.message_id || '');
    const mediaId = String(body.media_id || '');
    if (!messageId || !mediaId) {
      return Response.json({ error: 'message_id and media_id required' }, { status: 400 });
    }

    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';
    if (!token) return Response.json({ error: 'WHATSAPP_ACCESS_TOKEN not set' }, { status: 500 });

    // Record a failure on the Message and return — never throw (keeps the placeholder row intact).
    const fail = async (status, error) => {
      await svc.entities.Message.update(messageId, {
        media_status: status,
        media_error: String(error).slice(0, 300),
      }).catch(() => {});
      return Response.json({ status, error: String(error) }, { status: 502 });
    };

    // 1) media_id → temporary download URL (Graph). Same token/version as sendWhatsAppMessage.
    const lookupRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!lookupRes.ok) return await fail('download_failed', `meta media lookup ${lookupRes.status}`);
    const lookup = await lookupRes.json().catch(() => ({}));
    const mediaUrl = lookup?.url;
    const mime = lookup?.mime_type || 'audio/ogg';
    if (!mediaUrl) return await fail('download_failed', 'meta media lookup returned no url');

    // 2) download the bytes — the lookaside URL ALSO requires the Bearer token.
    const binRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) return await fail('download_failed', `meta media download ${binRes.status}`);
    const buf = await binRes.arrayBuffer();
    if (!buf || buf.byteLength === 0) return await fail('download_failed', 'empty media body');

    // 3) persist to Base44 storage → fetchable URL (transcribeVoiceMessage fetches media_url).
    let fileUrl = '';
    try {
      const ext = EXT[mime] || EXT[String(mime).split(';')[0].trim()] || 'ogg';
      const file = new File([new Uint8Array(buf)], `voice_${mediaId}.${ext}`, { type: mime });
      const up = await base44.integrations.Core.UploadFile({ file });
      fileUrl = up?.file_url || up?.data?.file_url || '';
    } catch (e) {
      return await fail('upload_failed', 'upload: ' + (e?.message || e));
    }
    if (!fileUrl) return await fail('upload_failed', 'UploadFile returned no file_url');

    // 4) set media_url so the transcriber can read it (mirrors processInboundMedia's update).
    await svc.entities.Message.update(messageId, {
      media_url: fileUrl,
      media_mime: mime,
      media_type: 'audio',
      is_voice_note: true,
      media_status: 'ready',
      media_error: '',
    }).catch(() => {});

    // 5) hand off to the existing transcription pipeline (Whisper + language detect + translate;
    //    it updates transcript/transcript_lang/translated_text AND the Message.text the brain reads).
    svc.functions.invoke('transcribeVoiceMessage', { message_id: messageId }).catch(() => {});

    return Response.json({ ok: true, message_id: messageId, media_url: fileUrl, mime });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
