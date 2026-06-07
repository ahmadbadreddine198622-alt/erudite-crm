import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// AI conversation analysis for a landlord's WhatsApp thread.
// Writes:
//   - ConversationInsight (summary, temperature, suggestions, etc.)
//   - Landlord fields: trust_score, responsiveness_score, mandate_win_probability, urgency_score
//     + rationale fields: trust_score_rationale, urgency_score_rationale, mandate_win_rationale
//
// Also triggers detectLandlordStakeholders (fire-and-forget) so coalition map stays current.
//
// Debounced: skips if analyzed in the last 30s.

const MODEL = 'claude-opus-4-8';
const SETTLE_MS = 10000;
const COOLDOWN_MS = 30000;

function stripFences(s) {
  return String(s || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}
function asText(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}
function clamp(n, min, max) {
  if (typeof n !== 'number' || isNaN(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// --- Deterministic responsiveness score from message data ---
function computeResponsiveness(messages) {
  const pairs = [];
  // Find outgoing→incoming reply pairs (agent sends, landlord replies)
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].direction === 'outgoing' && messages[i + 1].direction === 'incoming') {
      const sent = new Date(messages[i].timestamp).getTime();
      const replied = new Date(messages[i + 1].timestamp).getTime();
      const diffMin = (replied - sent) / 60000;
      if (diffMin > 0 && diffMin < 7 * 24 * 60) { // ignore if > 7 days (stale)
        pairs.push(diffMin);
      }
    }
  }

  const totalOutgoing = messages.filter(m => m.direction === 'outgoing').length;
  const totalReplies = pairs.length;
  const replyRate = totalOutgoing > 0 ? totalReplies / totalOutgoing : 0;

  if (pairs.length === 0) return totalOutgoing > 0 ? 20 : null; // messaged but no reply yet

  const avgMin = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  // Speed score: <5 min = 100, <30 min = 80, <2h = 60, <24h = 40, <7d = 20
  let speedScore;
  if (avgMin < 5) speedScore = 100;
  else if (avgMin < 30) speedScore = 80;
  else if (avgMin < 120) speedScore = 60;
  else if (avgMin < 1440) speedScore = 40;
  else speedScore = 20;

  const rateScore = Math.round(replyRate * 100);
  return Math.round(speedScore * 0.6 + rateScore * 0.4);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const landlord_id = body.landlord_id;
  if (!landlord_id) return Response.json({ error: 'landlord_id is required' }, { status: 400 });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  // Cooldown check
  const existingList = await svc.entities.ConversationInsight.filter({ landlord_id });
  const existing = existingList?.[0];
  if (existing?.last_analyzed_at) {
    const age = Date.now() - new Date(existing.last_analyzed_at).getTime();
    if (age >= 0 && age < COOLDOWN_MS) {
      return Response.json({ status: 'skipped_recent_analysis', age_ms: age });
    }
  }

  // Load thread
  const load = () => svc.entities.Message.filter({ landlord_id }, 'timestamp', 200);
  let messages = await load();
  if (!messages || messages.length === 0) return Response.json({ status: 'no_messages' });

  // Trailing-edge debounce
  const latestTs = (arr) => (arr.length ? arr[arr.length - 1].timestamp : null);
  const before = latestTs(messages);
  await new Promise(r => setTimeout(r, SETTLE_MS));
  messages = await load();
  if (latestTs(messages) !== before) return Response.json({ status: 'superseded_newer_message' });

  // Compute deterministic responsiveness
  const responsivenessScore = computeResponsiveness(messages);

  // Build transcript
  const transcript = messages
    .map(m => `[${m.direction === 'outgoing' ? 'Agent' : 'Landlord'} ${m.timestamp || ''}]: ${m.text || ''}`)
    .join('\n');

  const systemPrompt = `You analyze a WhatsApp conversation between a Dubai real estate agent and a property owner (landlord) for a CRM.
Return ONLY a single strict JSON object — no prose, no markdown, no code fences. Shape:
{
  "summary": string,
  "conversation_stage": string,
  "temperature": "hot" | "warm" | "cold",
  "key_facts": string,
  "outstanding_items": string,
  "language": string,
  "suggestions": [
    { "type": "followup"|"meeting"|"viewing"|"call", "title": string, "reason": string,
      "suggested_message": string, "suggested_datetime": string|null }
  ],
  "trust_score": number,
  "trust_score_rationale": string,
  "mandate_win_probability": number,
  "mandate_win_rationale": string,
  "urgency_score": number,
  "urgency_score_rationale": string
}
SCORING RULES:
- trust_score: 0–100. Consider: openness, consistency, willingness to share info, positive sentiment, time invested.
- mandate_win_probability: 0–1. How likely is this landlord to sign with us? Consider: stage, rapport, competitors mentioned, objections, exclusivity interest.
- urgency_score: 0–100. How urgently does the landlord need to transact? Consider: mentioned deadlines, financial pressure, tenant leaving, already listed, timeline.
LANGUAGE RULE: Write summary and suggested_messages in the landlord's detected language. type/temperature stay English.`;

  let claudeText = '';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Conversation transcript (oldest first):\n\n${transcript}` }],
      }),
    });
    const raw = await resp.text();
    if (!resp.ok) return Response.json({ error: 'Anthropic API error', status: resp.status, detail: raw.slice(0, 800) }, { status: 502 });
    const data = JSON.parse(raw);
    claudeText = (data?.content || []).map(b => b?.text || '').join('').trim();
  } catch (e) {
    return Response.json({ error: 'Anthropic call failed', detail: String(e?.message || e) }, { status: 502 });
  }

  let parsed;
  try {
    parsed = JSON.parse(stripFences(claudeText));
  } catch (e) {
    return Response.json({ error: 'Model returned malformed JSON', raw: claudeText.slice(0, 800) }, { status: 502 });
  }

  const temp = ['hot', 'warm', 'cold'].includes(parsed.temperature) ? parsed.temperature : 'warm';
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map(s => ({
    type: ['followup', 'meeting', 'viewing', 'call'].includes(s?.type) ? s.type : 'followup',
    title: asText(s?.title),
    reason: asText(s?.reason),
    suggested_message: asText(s?.suggested_message),
    suggested_datetime: s?.suggested_datetime || null,
  })) : [];

  // Persist ConversationInsight
  const insightRecord = {
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

  try {
    if (existing) {
      await svc.entities.ConversationInsight.update(existing.id, insightRecord);
    } else {
      await svc.entities.ConversationInsight.create(insightRecord);
    }
  } catch (e) {
    return Response.json({ error: 'Failed to write ConversationInsight', detail: String(e?.message || e), insightRecord }, { status: 500 });
  }

  // Persist scorecards on Landlord record
  const scorecardUpdate = {};
  const ts = clamp(parsed.trust_score, 0, 100);
  const us = clamp(parsed.urgency_score, 0, 100);
  const mw = typeof parsed.mandate_win_probability === 'number' ? Math.min(1, Math.max(0, parsed.mandate_win_probability)) : null;

  if (ts !== null) scorecardUpdate.trust_score = ts;
  if (us !== null) scorecardUpdate.urgency_score = us;
  if (mw !== null) scorecardUpdate.mandate_win_probability = mw;
  if (responsivenessScore !== null) scorecardUpdate.responsiveness_score = Math.min(100, Math.max(0, responsivenessScore));
  if (parsed.trust_score_rationale) scorecardUpdate.trust_score_rationale = asText(parsed.trust_score_rationale);
  if (parsed.mandate_win_rationale) scorecardUpdate.mandate_win_rationale = asText(parsed.mandate_win_rationale);
  if (parsed.urgency_score_rationale) scorecardUpdate.urgency_score_rationale = asText(parsed.urgency_score_rationale);
  scorecardUpdate.ai_processed_at = new Date().toISOString();

  if (Object.keys(scorecardUpdate).length > 0) {
    await svc.entities.Landlord.update(landlord_id, scorecardUpdate).catch(err => {
      console.warn('Failed to update landlord scorecards:', err.message);
    });
  }

  // Fire-and-forget: auto-detect stakeholders from same thread
  svc.functions.invoke('detectLandlordStakeholders', { landlord_id }).catch(() => {});

  return Response.json({
    status: 'ok',
    landlord_id,
    temperature: temp,
    suggestions: suggestions.length,
    language: insightRecord.language,
    scorecards: { trust_score: ts, urgency_score: us, mandate_win_probability: mw, responsiveness_score: scorecardUpdate.responsiveness_score }
  });
});