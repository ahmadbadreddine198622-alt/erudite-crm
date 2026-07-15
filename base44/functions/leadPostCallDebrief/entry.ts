import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// leadPostCallDebrief — POST-CALL DEBRIEF for leads (BUYER BRAIN V1 B4c; twin of the
// landlord copilotCallComplete rolling-summary delta + the orchestrator's aurora proposals,
// collapsed into one lead-side writer).
//
// After a CallLog/AircallCall for a lead, this:
//   1. summarizes the call (Haiku — provided transcript, or the newest transcript/summary
//      on the lead's call rows, or the call's notes as a last resort),
//   2. appends a DATED DELTA to Lead.ai_rolling_summary (never replaces; tail-truncated
//      to 6000 chars — same discipline as the landlord twin),
//   3. materializes up to 2 suggested follow-ups as Reminder rows with origin='aurora'
//      and proposal_status='proposed' — they render in the LCC Aurora strip where a HUMAN
//      approves or dismisses. Quiet-hours-clamped (09:00-21:00 Dubai).
//
// NEVER sends anything, NEVER writes stage. Wired non-fatally from aircallWebhook for
// lead-matched calls; also invocable from the LCC ("Debrief last call").

const MODEL = 'claude-haiku-4-5-20251001';
const FOLLOWUP_TEMPLATE_KEYS = ['day2_matched_listing_drop', 'day5_checkin_call', 'day9_voice_note', 'day14_market_snapshot', 'nurture_monthly'];

const DEBRIEF_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '3-5 sentence factual debrief: what the call established, what the lead wants, what was promised, what changed.' },
    followups: {
      type: 'array', maxItems: 2,
      description: '0-2 follow-ups the call actually calls for (a promised send, a viewing to book, a check-in) - never generic.',
      items: {
        type: 'object',
        properties: {
          template_key: { type: 'string', enum: ['day2_matched_listing_drop', 'day5_checkin_call', 'day9_voice_note', 'day14_market_snapshot', 'nurture_monthly'] },
          when_offset_days: { type: 'number' },
          suggested_hour: { type: 'number', description: '9-21 Asia/Dubai' },
          channel: { type: 'string', enum: ['whatsapp', 'call', 'email', 'sms'] },
          reason: { type: 'string' },
        },
        required: ['template_key', 'when_offset_days', 'suggested_hour', 'channel', 'reason'],
      },
    },
  },
  required: ['summary', 'followups'],
};

function phoneVariants(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return [];
  return cleaned.startsWith('+') ? [cleaned, cleaned.slice(1)] : [cleaned, '+' + cleaned];
}

async function findCallText(svc, lead) {
  const rows = [];
  const air = await svc.entities.AircallCall.filter({ lead_id: lead.id }, '-started_at', 5).catch(() => []);
  for (const c of (air || [])) { const text = c?.transcript || c?.summary || c?.notes; if (text) rows.push({ t: new Date(c.started_at || c.created_date || 0).getTime(), text, src: `AircallCall ${c.id}` }); }
  const variants = phoneVariants(lead.phone || lead.whatsapp);
  if (variants.length) {
    for (const key of ['to_number', 'from_number']) {
      const logs = await svc.entities.CallLog.filter({ [key]: { $in: variants } }, '-started_at', 5).catch(() => []);
      for (const c of (logs || [])) { const text = c?.transcript || c?.summary || c?.notes; if (text) rows.push({ t: new Date(c.started_at || c.created_date || 0).getTime(), text, src: `CallLog ${c.id}` }); }
    }
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

    let callText = typeof body.transcript === 'string' && body.transcript.trim() ? body.transcript.trim() : null;
    let source = 'provided';
    if (!callText) {
      const found = await findCallText(svc, lead);
      if (!found) return Response.json({ ok: false, no_call: true, error: 'No call transcript/summary/notes found for this lead.' }, { status: 404 });
      callText = found.text;
      source = found.src;
    }

    const isRent = lead.intent === 'tenant';
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You debrief one phone call between an Erudite Real Estate agent and a Dubai ${isRent ? 'TENANT (rent track: money = ANNUAL rent)' : 'buyer'} lead. Factual, specific, no invention. Follow-ups only when the call content actually calls for one; suggested_hour must be 9-21 Asia/Dubai. Emit via the tool only.`,
      messages: [{ role: 'user', content: `LEAD: ${lead.full_name || '?'} | stage ${lead.stage} | intent ${lead.intent || 'unknown'}\nPRIOR ROLLING SUMMARY (context; do not repeat it):\n${String(lead.ai_rolling_summary || '(none)').slice(0, 1500)}\n\nCALL (${source}):\n${String(callText).slice(0, 10000)}\n\nDebrief now.` }],
      tools: [{ name: 'emit_debrief', description: 'Emit the call debrief.', input_schema: DEBRIEF_SCHEMA }],
      tool_choice: { type: 'tool', name: 'emit_debrief' },
    });
    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    const result = toolBlock ? toolBlock.input : null;
    if (!result || !result.summary) return Response.json({ error: 'debrief failed' }, { status: 502 });

    // 1. Rolling-summary DELTA — append, never replace; tail-truncate to 6000 (landlord parity).
    const dateTag = new Date().toISOString().slice(0, 10);
    const delta = `\n\n[${dateTag} · call debrief] ${String(result.summary).trim()}`;
    let rolling = String(lead.ai_rolling_summary || '') + delta;
    if (rolling.length > 6000) rolling = rolling.slice(rolling.length - 6000);
    await svc.entities.Lead.update(lead_id, { ai_rolling_summary: rolling });

    // 2. Materialize follow-ups as aurora PROPOSALS (human verdict in the LCC strip).
    // Dedupe: never a second live aurora proposal for the same template_key.
    const created = [];
    try {
      const existing = await svc.entities.Reminder.filter({ lead_id, origin: 'aurora', proposal_status: 'proposed', status: 'pending' }, '-created_date', 10).catch(() => []);
      const liveKeys = new Set((existing || []).map((r) => r.ai_source).filter(Boolean));
      for (const f of (Array.isArray(result.followups) ? result.followups : []).slice(0, 2)) {
        if (!f || !FOLLOWUP_TEMPLATE_KEYS.includes(f.template_key) || liveKeys.has(f.template_key)) continue;
        const due = new Date();
        due.setDate(due.getDate() + Math.max(0, Math.min(30, Number(f.when_offset_days) || 1)));
        due.setHours(Math.min(21, Math.max(9, Number(f.suggested_hour) || 10)), 0, 0, 0);
        const row = await svc.entities.Reminder.create({
          lead_id, lead_name: lead.full_name || '',
          title: `Aurora: ${f.template_key.replace(/_/g, ' ')}${f.channel ? ` (${f.channel})` : ''}`,
          notes: String(f.reason || '').slice(0, 400),
          type: 'follow_up', status: 'pending', due_date: due.toISOString(),
          assigned_to: lead.assigned_agent_email || '',
          origin: 'aurora', proposal_status: 'proposed', ai_source: f.template_key,
        }).catch(() => null);
        if (row) { created.push({ id: row.id, template_key: f.template_key }); liveKeys.add(f.template_key); }
      }
    } catch (_) { /* proposals must never break the debrief */ }

    return Response.json({
      ok: true,
      lead_id,
      source,
      summary: result.summary,
      proposals_created: created,
      usage: { input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens },
    });
  } catch (error) {
    console.error('leadPostCallDebrief error:', error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
