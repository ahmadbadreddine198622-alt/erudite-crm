import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// AI conversation analysis for a landlord's WhatsApp thread (Evolution/Message
// entity). Reads all Message records for the landlord, asks Claude Opus to
// produce a strict-JSON analysis, and upserts a ConversationInsight record.
//
// Named analyzeLandlordConversation to avoid clobbering the legacy
// `analyzeConversation` (WhatsAppConversation/InvokeLLM, still called in 4 places).
//
// Debounced (trailing-edge): skips if analyzed in the last 30s, and waits ~10s
// then aborts if a newer message arrived (so a burst -> one analysis).
//
// Autonomy: writes ONLY ConversationInsight. Never creates Followup/Meeting/
// Viewing/Call — those are user one-click actions in the UI.
//
// Secret: ANTHROPIC_API_KEY (Base44 env). Model: claude-opus-4-8.

const MODEL = 'claude-opus-4-8';
const SETTLE_MS = 10000;       // wait for the burst to settle
const COOLDOWN_MS = 30000;     // skip if analyzed within this window

function stripFences(s) {
  return String(s || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}
function asText(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) { /* none */ }
  const landlord_id = body.landlord_id;
  if (!landlord_id) return Response.json({ error: 'landlord_id is required' }, { status: 400 });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not set in Base44 env' }, { status: 500 });
  }

  // ---- cooldown: skip if analyzed very recently ----
  const existingList = await svc.entities.ConversationInsight.filter({ landlord_id });
  const existing = existingList && existingList[0];
  if (existing?.last_analyzed_at) {
    const age = Date.now() - new Date(existing.last_analyzed_at).getTime();
    if (age >= 0 && age < COOLDOWN_MS) {
      return Response.json({ status: 'skipped_recent_analysis', age_ms: age });
    }
  }

  // ---- load thread (oldest -> newest) ----
  const load = () => svc.entities.Message.filter({ landlord_id }, 'timestamp', 200);
  let messages = await load();
  if (!messages || messages.length === 0) return Response.json({ status: 'no_messages' });

  // ---- trailing-edge debounce: settle, then abort if a newer message arrived ----
  const latestTs = (arr) => (arr.length ? arr[arr.length - 1].timestamp : null);
  const before = latestTs(messages);
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  messages = await load();
  if (latestTs(messages) !== before) {
    return Response.json({ status: 'superseded_newer_message' });
  }

  // ---- build transcript ----
  const transcript = messages
    .map((m) => `[${m.direction === 'outgoing' ? 'Agent' : 'Landlord'} ${m.timestamp || ''}]: ${m.text || ''}`)
    .join('\n');

  const systemPrompt = `You analyze a WhatsApp conversation between a Dubai real estate agent and a property owner (landlord) for a CRM.
Return ONLY a single strict JSON object — no prose, no markdown, no code fences. Shape:
{
  "summary": string,
  "conversation_stage": string,
  "temperature": "hot" | "warm" | "cold",
  "key_facts": string,            // price expectations, timeline, objections
  "outstanding_items": string,    // what is unresolved
  "language": string,             // the language the LANDLORD writes in
  "suggestions": [
    { "type": "followup"|"meeting"|"viewing"|"call", "title": string, "reason": string,
      "suggested_message": string, "suggested_datetime": string|null }
  ]
}
LANGUAGE RULE: Detect the language the LANDLORD writes in. Write "summary" and every "suggested_message" in THAT language (e.g. a Russian-speaking landlord -> Russian). Put the detected language in "language". "type" and "temperature" stay as the exact English tokens above. "suggested_datetime" must be an ISO 8601 string or null.`;

  // ---- call Claude Opus ----
  let claudeText = '';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Conversation transcript (oldest first):\n\n${transcript}` }],
      }),
    });
    const raw = await resp.text();
    if (!resp.ok) {
      return Response.json({ error: 'Anthropic API error', status: resp.status, detail: raw.slice(0, 800) }, { status: 502 });
    }
    const data = JSON.parse(raw);
    claudeText = (data?.content || []).map((b) => b?.text || '').join('').trim();
  } catch (e) {
    return Response.json({ error: 'Anthropic call failed', detail: String(e && e.message ? e.message : e) }, { status: 502 });
  }

  // ---- parse strict JSON (tolerate accidental fences) ----
  let parsed;
  try {
    parsed = JSON.parse(stripFences(claudeText));
  } catch (e) {
    return Response.json({ error: 'Model returned malformed JSON', raw: claudeText.slice(0, 800) }, { status: 502 });
  }

  // ---- normalize to the ConversationInsight schema ----
  const temp = ['hot', 'warm', 'cold'].includes(parsed.temperature) ? parsed.temperature : 'warm';
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map((s) => ({
    type: ['followup', 'meeting', 'viewing', 'call'].includes(s?.type) ? s.type : 'followup',
    title: asText(s?.title),
    reason: asText(s?.reason),
    suggested_message: asText(s?.suggested_message),
    suggested_datetime: s?.suggested_datetime || null,
  })) : [];

  const record = {
    landlord_id,
    summary: asText(parsed.summary),
    conversation_stage: asText(parsed.conversation_stage),
    temperature: temp,
    key_facts: asText(parsed.key_facts),
    outstanding_items: asText(parsed.outstanding_items),
    language: asText(parsed.language),
    suggestions,
    last_analyzed_at: new Date().toISOString(),
  };

  // ---- upsert ConversationInsight (only this entity is written) ----
  try {
    if (existing) {
      await svc.entities.ConversationInsight.update(existing.id, record);
    } else {
      await svc.entities.ConversationInsight.create(record);
    }
  } catch (e) {
    return Response.json({ error: 'Failed to write ConversationInsight', detail: String(e && e.message ? e.message : e), record }, { status: 500 });
  }

  return Response.json({ status: 'ok', landlord_id, temperature: temp, suggestions: suggestions.length, language: record.language });
});
