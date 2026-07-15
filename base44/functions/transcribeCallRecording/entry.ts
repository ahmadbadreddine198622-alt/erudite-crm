import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * transcribeCallRecording — transcribes a call recording via Deepgram
 * (pre-recorded API, nova-2 + auto language detect) and persists the text to
 * the call record's `transcript` field.
 *
 * Supports two entities:
 *   • AircallCall (provider: aircall / vapi) — recording_url is publicly fetchable,
 *     so Deepgram is given the URL directly.
 *   • CallLog (provider: twilio) — recording_url requires Twilio HTTP Basic Auth,
 *     so we fetch the bytes server-side and send them raw to Deepgram.
 *
 * Input:   { call_id, entity }   (entity: 'AircallCall' | 'CallLog')
 *          { aircall_call_id }    (legacy alias for entity='AircallCall')
 * Output:  { ok, transcript, cached? }
 */

async function transcribeWithDeepgram({ url, audioBytes, contentType }) {
  const key = Deno.env.get("DEEPGRAM_API_KEY");
  if (!key) throw new Error('DEEPGRAM_API_KEY not configured');
  const qs = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    punctuate: 'true',
    detect_language: 'true',
  });
  let res;
  if (url) {
    res = await fetch(`https://api.deepgram.com/v1/listen?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } else {
    res = await fetch(`https://api.deepgram.com/v1/listen?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${key}`, 'Content-Type': contentType || 'audio/mpeg' },
      body: audioBytes,
    });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Deepgram failed (${res.status}): ${t.slice(0, 220)}`);
  }
  const data = await res.json();
  return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const entity = body.entity === 'CallLog' ? 'CallLog' : 'AircallCall';
    const recordId = body.call_id || body.aircall_call_id;
    if (!recordId) return Response.json({ error: 'call_id is required' }, { status: 400 });

    const repo = entity === 'CallLog'
      ? base44.asServiceRole.entities.CallLog
      : base44.asServiceRole.entities.AircallCall;

    const call = await repo.get(recordId).catch(() => null);
    if (!call) return Response.json({ error: 'Call not found' }, { status: 404 });

    // Already transcribed → return cached transcript.
    if (call.transcript && String(call.transcript).trim()) {
      return Response.json({ ok: true, transcript: String(call.transcript).trim(), cached: true });
    }

    const recordingUrl = call.recording_url || call.voicemail_url || '';
    if (!recordingUrl) return Response.json({ error: 'No recording available for this call' }, { status: 400 });

    let transcript;
    if (entity === 'CallLog' && /twilio\.com/i.test(recordingUrl)) {
      // Twilio recordings require HTTP Basic Auth — fetch bytes, send raw to Deepgram.
      const creds = await base44.asServiceRole.entities.TwilioCredential.list();
      const c = creds?.[0];
      if (!c?.account_sid || !c?.auth_token) {
        return Response.json({ error: 'Twilio not configured' }, { status: 400 });
      }
      const authHeader = `Basic ${btoa(`${c.account_sid}:${c.auth_token}`)}`;
      const twRes = await fetch(recordingUrl, { headers: { Authorization: authHeader } });
      if (!twRes.ok) return Response.json({ error: `Twilio fetch failed: ${twRes.status}` }, { status: 400 });
      const contentType = twRes.headers.get('content-type') || 'audio/mpeg';
      const audioBytes = await twRes.arrayBuffer();
      transcript = await transcribeWithDeepgram({ audioBytes, contentType });
    } else {
      // Aircall/Vapi recordings are publicly fetchable — pass the URL to Deepgram.
      transcript = await transcribeWithDeepgram({ url: recordingUrl });
    }

    if (!transcript || !String(transcript).trim()) {
      return Response.json({ error: 'Transcription returned no text' }, { status: 500 });
    }

    await repo.update(recordId, { transcript: String(transcript).trim() });
    return Response.json({ ok: true, transcript: String(transcript).trim() });
  } catch (error) {
    return Response.json({ error: error.message || 'transcribeCallRecording failed' }, { status: 500 });
  }
});