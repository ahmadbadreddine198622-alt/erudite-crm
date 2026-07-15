import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * speechifyTTS — Speechify Studio API text-to-speech.
 *
 * Generates audio via Speechify, uploads it to file storage, and returns
 * a hosted URL the browser can play natively (no base64/blob issues).
 *
 * POST { text, voice_id?, language?, model? }
 * Returns { ok, url, model, voice_id }
 *
 * Model auto-selection:
 *   - English (or omitted) → simba-3.2
 *   - Any other language → simba-multilingual
 */

const API_URL = 'https://api.speechify.ai/v1/audio/speech';
const DEFAULT_VOICE = 'geffen_32';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json(401, { error: 'Unauthorized' });

    const body = await req.json().catch(() => ({}));
    const { text, voice_id, language, model } = body;
    if (!text || typeof text !== 'string') return json(400, { error: 'text is required' });
    if (text.length > 5000) return json(400, { error: 'text exceeds 5000 character limit' });

    const apiKey = Deno.env.get('SPEECHIFY_API_KEY');
    if (!apiKey) return json(500, { error: 'SPEECHIFY_API_KEY not configured' });

    const useMultilingual = language && language !== 'en';
    const chosenModel = model || (useMultilingual ? 'simba-multilingual' : 'simba-3.2');
    const voice = voice_id || DEFAULT_VOICE;

    console.log(`[speechifyTTS] Generating ${text.length} chars, model=${chosenModel}, voice=${voice}, lang=${language || 'auto'}`);

    const speechRes = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        voice_id: voice,
        audio_format: 'mp3',
        model: chosenModel,
      }),
    });

    if (!speechRes.ok) {
      const detail = await speechRes.text().catch(() => '');
      console.error(`[speechifyTTS] Speechify API ${speechRes.status}: ${detail.slice(0, 300)}`);
      return json(502, { error: `Speechify API ${speechRes.status}: ${detail.slice(0, 300)}` });
    }

    const audioBuf = await speechRes.arrayBuffer();
    console.log(`[speechifyTTS] Got ${Math.round(audioBuf.byteLength / 1024)}KB audio, uploading to file storage…`);

    // Upload to file storage so the browser gets a hosted URL it can play natively
    const audioFile = new File([audioBuf], `tts_${Date.now()}.mp3`, { type: 'audio/mpeg' });
    const uploadRes = await base44.integrations.Core.UploadFile({ file: audioFile });
    const fileUrl = uploadRes?.file_url || uploadRes?.data?.file_url;

    if (!fileUrl) throw new Error('File upload returned no URL');

    console.log(`[speechifyTTS] Uploaded: ${fileUrl.slice(0, 80)}…`);

    return json(200, {
      ok: true,
      url: fileUrl,
      model: chosenModel,
      voice_id: voice,
    });
  } catch (error) {
    console.error('[speechifyTTS] error:', error);
    return json(500, { error: String(error?.message || error).slice(0, 500) });
  }
});