import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// buyerBrainQualify — BRAIN QUALIFY for leads (BUYER BRAIN V1 B4a; twin of the landlord
// live-call auto-fill, collapsed to its essence).
//
// Input: a call transcript (passed directly, or pulled from the lead's latest
// AircallCall/CallLog row that carries one). Output: PROPOSED Lead field updates —
// budget, beds, timeline, financing, move-in, cheques, areas, intent — each with the
// lead's verbatim quote as evidence.
//
// WRITES NOTHING. The human reviews each proposal in the Lead Command Center and applies
// it with a click (the click IS the confirmation; the client performs the Lead.update).
// Model: Haiku cold tier — this is extraction, not synthesis.

const MODEL = 'claude-haiku-4-5-20251001';

// Whitelisted proposable fields — value shapes validated in CODE before returning.
const FIELD_ENUMS = {
  move_in_timeline: ['immediate', '1_month', '3_months', '6_months', '12_months', 'flexible', 'investor_no_move_in'],
  financing_method: ['cash', 'mortgage', 'installments', 'mixed', 'unknown'],
  intent: ['buyer', 'tenant'],
  transaction_type: ['primary_residence', 'second_home', 'investment', 'short_term_rental', 'commercial'],
};
const NUMBER_FIELDS = new Set(['budget_min', 'budget_max', 'bedrooms_min', 'bedrooms_max', 'cheques_count']);
const ARRAY_FIELDS = new Set(['preferred_locations']);

const QUALIFY_SCHEMA = {
  type: 'object',
  properties: {
    proposed_updates: {
      type: 'array', maxItems: 12,
      description: 'One entry per Lead field the transcript ACTUALLY answers. Never guess — only propose what the lead said.',
      items: {
        type: 'object',
        properties: {
          field_key: { type: 'string', enum: ['budget_min', 'budget_max', 'bedrooms_min', 'bedrooms_max', 'move_in_timeline', 'financing_method', 'cheques_count', 'preferred_locations', 'intent', 'transaction_type'] },
          value: { description: 'The proposed value. Numbers for budget/beds/cheques (AED absolute for budget - convert "2.5M" to 2500000; ANNUAL rent for tenants). Enum string for timeline/financing/intent/transaction. Array of area names for preferred_locations.' },
          quote: { type: 'string', description: "The lead's verbatim words that justify this value (short)." },
        },
        required: ['field_key', 'value', 'quote'],
      },
    },
    call_summary: { type: 'string', description: '2-3 sentence factual summary of what the call established.' },
  },
  required: ['proposed_updates', 'call_summary'],
};

function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}

// Pull the newest transcript-bearing call row for this lead (AircallCall by lead_id,
// CallLog by phone variants). Degrades to null.
async function findTranscript(svc, lead) {
  const rows = [];
  const air = await svc.entities.AircallCall.filter({ lead_id: lead.id }, '-started_at', 5).catch(() => []);
  for (const c of (air || [])) if (c?.transcript) rows.push({ t: new Date(c.started_at || c.created_date || 0).getTime(), text: c.transcript, src: `AircallCall ${c.id}` });
  const variants = phoneVariants(lead.phone || lead.whatsapp);
  if (variants.length) {
    const logs = await svc.entities.CallLog.filter({ to_number: { $in: variants } }, '-started_at', 5).catch(() => []);
    const logs2 = await svc.entities.CallLog.filter({ from_number: { $in: variants } }, '-started_at', 5).catch(() => []);
    for (const c of [...(logs || []), ...(logs2 || [])]) if (c?.transcript) rows.push({ t: new Date(c.started_at || c.created_date || 0).getTime(), text: c.transcript, src: `CallLog ${c.id}` });
  }
  rows.sort((a, b) => b.t - a.t);
  return rows[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { lead_id } = body;
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });
    const lead = await svc.entities.Lead.get(lead_id).catch(() => null);
    if (!lead) return Response.json({ error: 'lead not found' }, { status: 404 });

    let transcript = typeof body.transcript === 'string' && body.transcript.trim() ? body.transcript.trim() : null;
    let source = 'provided';
    if (!transcript) {
      const found = await findTranscript(svc, lead);
      if (!found) return Response.json({ ok: false, no_transcript: true, error: 'No call transcript found for this lead — record or transcribe a call first.' }, { status: 404 });
      transcript = found.text;
      source = found.src;
    }

    const isRent = lead.intent === 'tenant';
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: `You extract PROPOSED CRM field updates for a Dubai real-estate ${isRent ? 'TENANT' : 'buyer'} lead from a call transcript. HARD RULES:
- Only propose a field when the lead's own words answer it — the quote must justify the value. Never infer, never guess.
- Budget numbers are ABSOLUTE AED (convert "2.5M" → 2500000, "120k" → 120000). ${isRent ? 'This lead is on the RENT track: budget figures are ANNUAL RENT per year; cheque counts matter (cheques_count 1-12).' : 'If the lead reveals they are actually renting (not buying), propose intent=tenant; the money they name is then annual rent.'}
- move_in_timeline maps to the nearest enum bucket (immediate/1_month/3_months/6_months/12_months/flexible/investor_no_move_in).
- Emit via the tool only. An empty proposed_updates array is a perfectly good answer for an uninformative call.`,
      messages: [{ role: 'user', content: `LEAD ON RECORD: ${lead.full_name || '?'} | intent ${lead.intent || 'unknown'} | budget ${lead.budget_min || '?'}-${lead.budget_max || '?'} | ${lead.bedrooms_min ?? '?'}-${lead.bedrooms_max ?? '?'}BR | timeline ${lead.move_in_timeline || '?'} | financing ${lead.financing_method || '?'} | areas ${(lead.preferred_locations || []).join(', ') || '?'}\n\nCALL TRANSCRIPT:\n${String(transcript).slice(0, 12000)}\n\nExtract the proposed field updates now.` }],
      tools: [{ name: 'emit_qualify', description: 'Emit proposed Lead field updates with evidence quotes.', input_schema: QUALIFY_SCHEMA }],
      tool_choice: { type: 'tool', name: 'emit_qualify' },
    });
    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    const result = toolBlock ? toolBlock.input : null;
    if (!result) return Response.json({ error: 'extraction failed' }, { status: 502 });

    // CODE-side validation — only whitelisted fields with type-correct values survive.
    const proposals = (Array.isArray(result.proposed_updates) ? result.proposed_updates : []).map((p) => {
      if (!p || typeof p.field_key !== 'string') return null;
      const k = p.field_key;
      let v = p.value;
      if (NUMBER_FIELDS.has(k)) {
        v = Number(v);
        if (!isFinite(v) || v < 0) return null;
        if (k === 'cheques_count' && (v < 1 || v > 12)) return null;
        if (k.startsWith('bedrooms') && v > 20) return null;
      } else if (ARRAY_FIELDS.has(k)) {
        v = Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 8) : null;
        if (!v || !v.length) return null;
      } else if (FIELD_ENUMS[k]) {
        if (!FIELD_ENUMS[k].includes(v)) return null;
      } else {
        return null;
      }
      const current = lead[k];
      const unchanged = Array.isArray(v) ? JSON.stringify(v) === JSON.stringify(current || []) : v === current;
      return { field_key: k, value: v, quote: String(p.quote || '').slice(0, 240), current: current ?? null, unchanged };
    }).filter(Boolean).filter((p) => !p.unchanged);

    return Response.json({
      ok: true,
      lead_id,
      transcript_source: source,
      call_summary: String(result.call_summary || '').slice(0, 600),
      proposed_updates: proposals,
      usage: { input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens },
    });
  } catch (error) {
    console.error('buyerBrainQualify error:', error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
