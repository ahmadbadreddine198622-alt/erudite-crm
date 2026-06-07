import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * PHASE 2 — Voice intelligence.
 * Transcribes an inbound WhatsApp voice note (Message entity) via OpenAI Whisper
 * with AUTO language detection (ar/en/ru/fr/…). Stores transcript, transcript_lang,
 * and (when not English) translated_text. Updates `text` so the transcript reads
 * inline in the existing thread. Fired by processInboundMedia after audio download.
 * Resilience: message already saved as a voice note; failures never break anything.
 * 3 inline Whisper attempts; on exhaustion → transcript_status='failed' + retry_count.
 * Secret: OPENAI_API_KEY.
 */

const MAX_ATTEMPTS = 3;

function normLang(l) {
  if (!l) return '';
  const s = String(l).toLowerCase().trim();
  const map = {
    english: 'en', arabic: 'ar', russian: 'ru', french: 'fr',
    hindi: 'hi', urdu: 'ur', spanish: 'es', german: 'de', italian: 'it',
    en: 'en', ar: 'ar', ru: 'ru', fr: 'fr',
  };
  return map[s] || s.slice(0, 2);
}

async function whisperTranscribe(apiKey, blob, filename) {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('model', 'whisper-1');
  fd.append('response_format', 'verbose_json');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Whisper ${r.status}: ${raw.slice(0, 200)}`);
  return JSON.parse(raw);
}

async function translateToEnglish(apiKey, text) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: 'You translate messages for a Dubai real estate CRM. Translate the user message to English, preserving meaning, names, numbers and tone. Output ONLY the translation — no preamble, no quotes.' },
        { role: 'user', content: text },
      ],
    }),
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Translate ${r.status}: ${raw.slice(0, 200)}`);
  const data = JSON.parse(raw);
  return (data?.choices?.[0]?.message?.content || '').trim();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const messageId = body.message_id;
  if (!messageId) return Response.json({ error: 'message_id required' }, { status: 400 });

  const apiKey = Deno.env.get('OPENAI_API_KEY') || '';

  const rows = await svc.entities.Message.filter({ id: messageId });
  const msg = rows?.[0];
  if (!msg) return Response.json({ error: 'message not found', messageId }, { status: 404 });

  const isVoice = msg.is_voice_note === true || msg.media_type === 'audio';
  if (!isVoice) return Response.json({ status: 'not_a_voice_note' });
  if (msg.transcript && msg.transcript_status === 'done') return Response.json({ status: 'already_done' });

  if (!apiKey) {
    try { await svc.entities.Message.update(messageId, { transcript_status: 'failed', transcript_error: 'OPENAI_API_KEY not set' }); } catch (_) {}
    return Response.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }
  if (!msg.media_url) {
    try { await svc.entities.Message.update(messageId, { transcript_status: 'failed', transcript_error: 'no media_url (audio not downloaded yet)' }); } catch (_) {}
    return Response.json({ status: 'no_media_url' });
  }

  try { await svc.entities.Message.update(messageId, { transcript_status: 'pending' }); } catch (_) {}

  let blob;
  try {
    const ar = await fetch(msg.media_url);
    if (!ar.ok) throw new Error(`media fetch ${ar.status}`);
    const buf = await ar.arrayBuffer();
    blob = new Blob([buf], { type: msg.media_mime || 'audio/ogg' });
  } catch (e) {
    const retries = (msg.transcript_retry_count || 0) + 1;
    await svc.entities.Message.update(messageId, { transcript_status: 'failed', transcript_retry_count: retries, transcript_error: ('audio fetch: ' + String(e?.message || e)).slice(0, 300) });
    return Response.json({ status: 'audio_fetch_failed', retries });
  }

  const filename = `voice_${messageId}.${(msg.media_mime || '').includes('mp4') ? 'mp4' : 'oga'}`;

  let lastErr = '';
  let result = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try { result = await whisperTranscribe(apiKey, blob, filename); break; }
    catch (e) {
      lastErr = String(e?.message || e);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (!result) {
    const retries = (msg.transcript_retry_count || 0) + 1;
    await svc.entities.Message.update(messageId, { transcript_status: 'failed', transcript_retry_count: retries, transcript_error: lastErr.slice(0, 300) });
    return Response.json({ status: 'transcription_failed', error: lastErr, retries });
  }

  const transcript = (result.text || '').trim();
  const lang = normLang(result.language);

  let translated = '';
  if (transcript && lang && lang !== 'en') {
    try { translated = await translateToEnglish(apiKey, transcript); } catch (_) { translated = ''; }
  }

  const displayText = transcript
    ? (translated ? `🎤 ${transcript}\n— ${translated}` : `🎤 ${transcript}`)
    : (msg.text || '🎤 Voice message');

  const update = {
    transcript,
    transcript_lang: lang,
    transcript_status: 'done',
    transcript_error: '',
    text: displayText,
  };
  if (translated) update.translated_text = translated;

  await svc.entities.Message.update(messageId, update);

  return Response.json({ status: 'ok', message_id: messageId, language: lang, translated: !!translated, chars: transcript.length });
});