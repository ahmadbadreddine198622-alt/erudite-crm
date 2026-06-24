import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * landlordOrchestrator V2 — the landlord intelligence brain.
 *
 * V1 (audit): read only Landlord + LandlordProperty + MandateNegotiation + LandlordStakeholder
 * + Activity(20) + DocumentChecklistItem; read NONE of the conversation, notes, tasks, appointments,
 * or qualifications; wrote only Landlord fields via one Landlord.update; regenerated every field
 * each run (stateless); claude-opus-4-7; triggered by the UI buttons, routeWhatsAppMessage, and the
 * backfill. It never created task/note/appointment entities, so it was never the source of the
 * duplicate-entity writes (those came from the UI; now double-submit-guarded).
 *
 * V2 changes:
 *  - READS EVERYTHING by landlord_id: Message (conversation), LandlordNote (human notes weighted
 *    heavily), LandlordTask (open+done), LandlordAppointment, Followup/Call/Meeting/Viewing,
 *    CallQualification, LandlordProperty (valuation), plus the V1 reads — for ONE coherent picture.
 *  - RECONCILES price vs valuation (asking / CallQualification.price_expectation_aed vs
 *    LandlordProperty.ai_estimated_value_aed) and surfaces the gap.
 *  - STATE-AWARE / idempotent: never suggests a task/follow-up that already exists as an open or
 *    done entity (filtered in code by template_key AND surfaced to the model by title); reflects
 *    already-scheduled appointments in the summary instead of re-suggesting them. Writes only
 *    Landlord fields via a single update, so human-edited task/note entities are never clobbered.
 *  - MESSAGE DRAFTS: ai_suggested_messages — full-tier = 2-3 send-ready reply drafts advancing the
 *    next-best-action; cold-tier = 2-3 personal, tower/unit-specific cold-open first-contact drafts.
 *  - TIERS: tier:'full' (default) = claude-opus-4-8, full read + full output; tier:'cold' (on
 *    record creation, no conversation yet) = lighter claude-haiku-4-5 call, urgency + archetype +
 *    next-best-action + brief summary + cold-open drafts only.
 *  - Stamps ai_processed_at + ai_model_used.
 *
 * Triggers (V2): manual UI button (full), routeWhatsAppMessage on inbound (full), landlord
 * creation (cold), stage change + new CallQualification (full) — wired in their code paths.
 */

// Live Landlord stage taxonomy — MUST match Landlord.jsonc `stage` enum exactly. (V1 shipped the
// stale pre-migration taxonomy here, which silently disabled stage progression: the write guard
// STAGES.indexOf(new_stage) never matched the live enum, so update.stage was never set.)
const STAGES = [
  'initial_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation', 'form_a_signing',
  'owner_documents', 'photos_videos', 'photographer_scheduling', 'listing_creation',
  'internal_verification', 'listing_publication', 'final_confirmation', 'marketing_agents',
  'marketing_network', 'open_house', 'client_blast', 'deal_closed'
];

const TASK_TEMPLATE_KEYS = [
  'chase_document', 'clarify_price', 'reduce_price', 'send_comps', 'book_call',
  'book_viewing', 'schedule_photographer', 'get_mandate_signed', 'follow_up_silence',
  'switch_channel', 'map_stakeholder', 'verify_permit', 'publish_listing'
];

const FOLLOWUP_TEMPLATE_KEYS = [
  'post_call_recap', 'silence_nudge_24h', 'silence_nudge_72h', 'docs_reminder',
  'price_check_in', 'post_viewing_followup', 'weekly_touch', 'mandate_renewal_warn'
];

const FULL_MODEL = 'claude-opus-4-8';            // strongest — quality matters for the brain
const COLD_MODEL = 'claude-haiku-4-5-20251001';  // lighter — used only when there's no conversation yet

// Shape of ai_suggested_messages items (matches the live Landlord schema). Shared by both tiers.
const MESSAGE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Ready to send, in the landlord\'s language, NO placeholders.' },
    language: { type: 'string' },
    channel: { type: 'string', enum: ['whatsapp', 'call', 'email'] },
    tone: { type: 'string' },
    intent: { type: 'string' },
    mode: { type: 'string', enum: ['reply', 'cold_open'] },
    rationale: { type: 'string' }
  },
  required: ['text', 'language', 'channel', 'mode']
};

const NBA_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
    scheduled_for: { type: 'string' },
    draft_message: { type: 'string' },
    draft_language: { type: 'string' },
    reasoning: { type: 'string' },
    confidence: { type: 'number' }
  }
};

const FULL_SCHEMA = {
  type: 'object',
  properties: {
    new_stage: { type: ['string', 'null'], enum: [...STAGES, null] },
    sub_stage: { type: ['string', 'null'] },
    trust_score: { type: 'number' },
    responsiveness_score: { type: 'number' },
    mandate_win_probability: { type: 'number' },
    urgency_score: { type: 'number' },
    trust_score_rationale: { type: 'string' },
    responsiveness_score_rationale: { type: 'string' },
    mandate_win_rationale: { type: 'string' },
    urgency_score_rationale: { type: 'string' },
    estimated_commission_aed: { type: ['number', 'null'] },
    rapport_level: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
    buying_signals: { type: 'array', items: { type: 'string' } },
    ai_objections: { type: 'array', items: { type: 'string' } },
    ai_rolling_summary: { type: 'string' },
    ai_deal_thesis: { type: 'string', description: 'Persistent strategic narrative for winning THIS mandate — durable across runs (evolve the prior thesis, don\'t restate the tactical summary). 2-4 sentences.' },
    ai_open_questions: {
      type: 'array', minItems: 0, maxItems: 3,
      description: '0-3 specific uncertainties a HUMAN can resolve (e.g. "Is the spouse a co-decision-maker?"). Only when genuinely unsure — empty is correct when nothing is blocking.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question for the agent, one sentence.' },
          why: { type: 'string', description: 'Why it matters / what it unblocks.' }
        },
        required: ['question']
      }
    },
    ai_coaching_for_agent: { type: 'string' },
    ai_next_best_action: NBA_SCHEMA,
    suggested_tasks: {
      type: 'array', minItems: 0, maxItems: 5,
      description: '0-5 NEW recommended tasks, ranked. MUST NOT include any task that already exists open or done (those are listed in the prompt) — reference those as pending in the summary instead.',
      items: {
        type: 'object',
        properties: {
          template_key: { type: 'string', enum: TASK_TEMPLATE_KEYS, description: 'One of the enumerated TaskTemplate keys.' },
          reason: { type: 'string', description: 'One sentence: why this task matters for THIS landlord now.' }
        },
        required: ['template_key', 'reason']
      }
    },
    suggested_followups: {
      type: 'array', minItems: 0, maxItems: 4,
      description: '0-4 NEW time-based follow-ups. MUST NOT duplicate an already-scheduled appointment/follow-up (listed in the prompt).',
      items: {
        type: 'object',
        properties: {
          template_key: { type: 'string', enum: FOLLOWUP_TEMPLATE_KEYS },
          when_offset_days: { type: 'number' },
          suggested_hour: { type: 'number' },
          channel: { type: 'string', enum: ['whatsapp', 'call', 'email'] },
          reason: { type: 'string' }
        },
        required: ['template_key', 'when_offset_days', 'channel', 'reason']
      }
    },
    ai_suggested_messages: {
      type: 'array', minItems: 0, maxItems: 3,
      description: '2-3 send-ready WhatsApp REPLY drafts (mode="reply") in the landlord\'s language that advance the next-best-action. Vary the angle (direct vs soft). No placeholders.',
      items: MESSAGE_ITEM_SCHEMA
    },
    ai_momentum: { type: 'string', enum: ['accelerating', 'steady', 'slowing', 'stalled'] },
    ai_strike_now: { type: 'boolean' },
    needs_human_review: { type: 'boolean' },
    review_reason: { type: ['string', 'null'] }
  },
  required: ['trust_score', 'mandate_win_probability', 'ai_rolling_summary', 'ai_next_best_action']
};

const COLD_SCHEMA = {
  type: 'object',
  properties: {
    urgency_score: { type: 'number' },
    urgency_score_rationale: { type: 'string' },
    rapport_level: { type: 'string' },
    landlord_archetype: { type: 'string' },
    ai_rolling_summary: { type: 'string' },
    ai_next_best_action: NBA_SCHEMA,
    ai_suggested_messages: {
      type: 'array', minItems: 0, maxItems: 3,
      description: '2-3 personal first-contact WhatsApp COLD-OPEN drafts (mode="cold_open") tailored to this owner\'s tower/unit/project and archetype — never generic blasts. No placeholders.',
      items: MESSAGE_ITEM_SCHEMA
    }
  },
  required: ['urgency_score', 'ai_next_best_action']
};

async function callClaude(system, prompt, model, schema) {
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ name: 'emit_orchestrator', description: 'Emit the landlord orchestration result.', input_schema: schema }],
      tool_choice: { type: 'tool', name: 'emit_orchestrator' }
    });
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    return toolBlock ? toolBlock.input : null;
  } catch (err) {
    console.error('Claude call failed:', err);
    return null;
  }
}

const fmtDate = (d) => { if (!d) return '?'; const x = new Date(d); return isNaN(x) ? String(d) : x.toISOString().slice(0, 16).replace('T', ' '); };
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
const normScore = (v, max) => (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(max, v)) : null;

// Normalize the model's ai_suggested_messages into the live schema shape; drop empties, cap at 3.
const normalizeMessages = (raw, defaultMode, landlord) => (Array.isArray(raw) ? raw : [])
  .filter(m => m && typeof m === 'object' && typeof m.text === 'string' && m.text.trim())
  .slice(0, 3)
  .map(m => ({
    text: m.text.trim(),
    language: (typeof m.language === 'string' && m.language) ? m.language : (landlord.preferred_language || 'en'),
    channel: ['whatsapp', 'call', 'email'].includes(m.channel) ? m.channel : 'whatsapp',
    tone: typeof m.tone === 'string' ? m.tone : '',
    intent: typeof m.intent === 'string' ? m.intent : '',
    mode: (m.mode === 'reply' || m.mode === 'cold_open') ? m.mode : defaultMode,
    rationale: typeof m.rationale === 'string' ? m.rationale : ''
  }));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, force = false, tier = 'full' } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });
    const svc = base44.asServiceRole;

    const landlord = await svc.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    // Skip if recently run and not forced (debounce auto-triggers).
    if (!force && landlord.last_orchestrator_run_at) {
      const hoursSince = (Date.now() - new Date(landlord.last_orchestrator_run_at).getTime()) / 3.6e6;
      if (hoursSince < 6) return Response.json({ skipped: 'recently_run', hours_since: hoursSince });
    }

    // READ EVERYTHING (service role bypasses RLS on Message/CallQualification/etc.). Each read is
    // resilient — a missing entity or query error degrades to [] rather than failing the run.
    const [
      properties, messages, notes, tasks, appointments, followups, calls, meetings, viewings,
      qualifications, negotiation, stakeholders, activities, docs
    ] = await Promise.all([
      svc.entities.LandlordProperty.filter({ landlord_id }).catch(() => []),
      svc.entities.Message.filter({ landlord_id }, '-timestamp', 60).catch(() => []),
      svc.entities.LandlordNote.filter({ landlord_id }, '-created_date', 30).catch(() => []),
      svc.entities.LandlordTask.filter({ landlord_id }, '-created_date', 50).catch(() => []),
      svc.entities.LandlordAppointment.filter({ landlord_id }, '-datetime', 20).catch(() => []),
      svc.entities.Followup.filter({ landlord_id }, '-scheduled_at', 20).catch(() => []),
      svc.entities.Call.filter({ landlord_id }, '-scheduled_at', 20).catch(() => []),
      svc.entities.Meeting.filter({ landlord_id }, '-scheduled_at', 20).catch(() => []),
      svc.entities.Viewing.filter({ landlord_id }, '-scheduled_at', 20).catch(() => []),
      svc.entities.CallQualification.filter({ landlord_id }, '-call_date', 10).catch(() => []),
      svc.entities.MandateNegotiation.filter({ landlord_id }).then(r => r?.[0]).catch(() => null),
      svc.entities.LandlordStakeholder.filter({ landlord_id }).catch(() => []),
      svc.entities.Activity.filter({ lead_id: landlord_id }, '-created_at', 20).catch(() => []),
      svc.entities.DocumentChecklistItem.filter({ landlord_id }).catch(() => [])
    ]);

    // Derived context
    const prop = properties[0] || {};
    const daysInStage = landlord.stage_entered_at
      ? Math.floor((Date.now() - new Date(landlord.stage_entered_at).getTime()) / 86400000) : 0;
    const docsReceived = docs.filter(d => d.status === 'received' || d.status === 'verified').length;
    const docsTotal = docs.filter(d => d.status !== 'not_required').length;

    // Existing task/follow-up STATE — used both to inform the model and to dedupe its output in code.
    const openTasks = tasks.filter(t => !t.done);
    const doneTasks = tasks.filter(t => t.done);
    const existingTaskKeys = new Set(tasks.filter(t => typeof t.ai_source === 'string').map(t => t.ai_source));
    const scheduledAppts = appointments.filter(a => a.status === 'scheduled');
    const scheduledTouchpoints = [
      ...scheduledAppts.map(a => ({ kind: a.type || 'appointment', when: a.datetime, channel: a.channel, src: a.ai_source })),
      ...followups.filter(f => f.status === 'pending').map(f => ({ kind: 'followup', when: f.scheduled_at, src: f.ai_source })),
      ...calls.filter(c => c.status === 'pending').map(c => ({ kind: 'call', when: c.scheduled_at })),
      ...meetings.filter(m => m.status === 'pending').map(m => ({ kind: 'meeting', when: m.scheduled_at })),
      ...viewings.filter(v => v.status === 'pending').map(v => ({ kind: 'viewing', when: v.scheduled_at }))
    ];
    const existingFollowupKeys = new Set([
      ...scheduledAppts.filter(a => typeof a.ai_source === 'string').map(a => a.ai_source),
      ...followups.filter(f => f.status === 'pending' && typeof f.ai_source === 'string').map(f => f.ai_source)
    ]);

    // Price vs valuation
    const valuation = num(prop.ai_estimated_value_aed);
    const latestQual = qualifications[0] || null;
    const askingPrice = num(landlord.asking_price_aed) ?? num(prop.asking_price_aed) ?? (latestQual ? num(latestQual.price_expectation_aed) : null);
    const priceGapPct = (askingPrice && valuation) ? Math.round(((askingPrice - valuation) / valuation) * 100) : null;

    const effectiveTier = tier === 'cold' ? 'cold' : 'full';

    let result = null;
    let modelUsed = FULL_MODEL;

    if (effectiveTier === 'cold') {
      // COLD: no conversation yet (record just created). Light, cheap, minimal output.
      modelUsed = COLD_MODEL;
      const coldSystem = `You are LANDLORD AURORA (cold-tier) — assessing a brand-new Dubai landlord lead with NO conversation history yet. Output only: urgency_score (0-100) + rationale, rapport_level (likely "cold"), a best-guess landlord_archetype, a 1-2 sentence ai_rolling_summary, a concrete ai_next_best_action to make first contact, and ai_suggested_messages: 2-3 PERSONAL first-contact WhatsApp openers (mode="cold_open", channel="whatsapp", in the landlord's preferred language) tailored to this owner's tower/unit/project and archetype — never generic blasts; each with tone, intent, rationale. Do not fabricate scores you cannot justify. STRICT tool output.`;
      const coldPrompt = `NEW LANDLORD: ${landlord.full_name_en || landlord.full_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`}
Phone: ${landlord.phone || '?'} | Lang: ${landlord.preferred_language || 'en'} | Nationality: ${landlord.nationality || '?'}
Source: ${landlord.source || '?'} | Stage: ${landlord.stage || 'initial_contact'}
Archetype hint: ${landlord.landlord_archetype || 'unknown'}
Project/unit: ${landlord.project_name || prop.project_name || '?'} ${landlord.unit_reference || prop.unit_reference || ''}
Currently listed with others: ${landlord.is_currently_listed_with_others ? 'YES' : 'no'} | Competing brokers: ${landlord.competing_brokers_count || 0}
Property: ${prop.id ? `unit known${valuation ? `, AI valuation ${valuation} AED` : ''}` : 'none linked yet'}
No conversation, notes, tasks, or calls exist yet. Emit the cold-tier assessment.`;
      result = await callClaude(coldSystem, coldPrompt, COLD_MODEL, COLD_SCHEMA);
    } else {
      // FULL: reason over the entire landlord picture.
      modelUsed = FULL_MODEL;
      const convo = messages.slice().reverse().map(m => {
        const who = m.direction === 'incoming' ? 'LANDLORD' : 'AGENT';
        const body = m.is_voice_note ? `[voice] ${m.transcript || ''}${m.translated_text ? ` (EN: ${m.translated_text})` : ''}` : (m.text || m.caption || `[${m.media_type || 'media'}]`);
        return `[${fmtDate(m.timestamp)}] ${who}: ${String(body).slice(0, 500)}`;
      }).join('\n');

      const humanNotes = notes.filter(n => !n.created_from_ai);
      const notesBlock = humanNotes.length
        ? humanNotes.map(n => `- [${fmtDate(n.created_date)}] ${n.author_name || n.author_email || 'agent'}: ${String(n.body || '').slice(0, 600)}`).join('\n')
        : '(no human notes)';

      const qualBlock = latestQual ? JSON.stringify({
        when: fmtDate(latestQual.call_date), motivation: latestQual.motivation, timeline: latestQual.timeline_urgency,
        price_expectation_aed: latestQual.price_expectation_aed, price_vs_valuation: latestQual.price_vs_valuation,
        mandate_openness: latestQual.mandate_openness, outcome: latestQual.call_outcome, next_step: latestQual.next_step,
        notes: latestQual.agent_notes
      }) : '(no qualification logged)';

      const systemPrompt = `You are LANDLORD AURORA — an autonomous AI co-pilot for a Dubai real-estate agent pursuing landlord mandates. You reason over the ENTIRE context below (conversation, the agent's own notes, logged calls, the unit valuation, and everything already actioned/scheduled) and produce ONE coherent, internally-consistent picture.

Decide and emit:
1. STAGE PROGRESSION: new_stage only if EARNED by evidence; detect sub_stage. new_stage MUST be one of (or null): ${STAGES.join(', ')}.
2. SCORES (with one-line rationales each): trust_score (0-100), responsiveness_score (0-100), mandate_win_probability (0-1), urgency_score (0-100). estimated_commission_aed if derivable from asking/valuation × commission %.
3. RAPPORT: cold → warming → rapport_built → trust_established → champion.
4. SIGNALS: buying_signals[] and red_flags[]. OBJECTIONS: ai_objections[] (the landlord's stated/implied hesitations).
5. ROLLING SUMMARY: 3-5 sentences. It MUST reflect what is already scheduled (e.g. "call already booked for X") and what tasks are already pending/done — do not describe those as if they still need creating.
6. COACHING: 1-2 specific sentences for THIS agent on THIS landlord.
7. NEXT BEST ACTION: action + priority + scheduled_for + draft_message (in the landlord's language) + reasoning + confidence.
8. MOMENTUM: accelerating | steady | slowing | stalled. STRIKE_NOW: momentum=accelerating AND urgency>70 AND mandate_win>0.4.
9. ESCALATION: needs_human_review if value >10M AED with a red flag, OR competing brokers ≥3, OR stuck >14d in stage.
10. PRICE ↔ VALUATION RECONCILIATION (critical): cross-reference the asking price (or the landlord's stated expectation) against the AI valuation. If the asking is unrealistic vs valuation, say so explicitly in the summary AND add it to ai_objections. If there is NO asking price yet but a valuation exists, the next-best-action should use the valuation as the hook.
11. SUGGESTED TASKS (state-aware): recommend NEW tasks ONLY, each referencing one of: ${TASK_TEMPLATE_KEYS.join(', ')}. Do NOT suggest anything that already exists as an open or done task (listed below) — reference those as pending instead. 0 is valid if everything is already covered.
12. SUGGESTED FOLLOW-UPS (state-aware): recommend NEW time-based follow-ups ONLY, each referencing one of: ${FOLLOWUP_TEMPLATE_KEYS.join(', ')}, with when_offset_days, suggested_hour (0-23 Asia/Dubai), channel. Do NOT duplicate an already-scheduled appointment/follow-up (listed below).
13. SUGGESTED MESSAGES (reply mode): 2-3 send-ready WhatsApp drafts (mode="reply", channel="whatsapp") in the landlord's preferred_language that advance the next-best-action — ready to send, NO placeholders. Vary the angle (e.g. direct vs soft). Each with tone, intent, rationale. Ground them in the actual conversation and the price reality.
14. DEAL THESIS (persistent — EVOLVE, don't reset): ai_deal_thesis is the durable 2-4 sentence strategy for winning THIS mandate — the through-line that should hold across many runs (who the decision-maker is, the core lever, the path to signature, the main risk). You are given the PRIOR thesis below: keep what is still true, revise only what genuinely changed, and let it accrue. This is DISTINCT from ai_rolling_summary (which is the tactical current-state) — do not just repeat the summary here.
15. OPEN QUESTIONS (ask-the-agent — be honest about uncertainty): ai_open_questions is 0-3 specific things a HUMAN could answer that would materially sharpen the strategy (e.g. "Is the owner's spouse a co-decision-maker?", "Did the last viewing actually happen?"). Each with a one-line 'why'. Return an EMPTY array when nothing is genuinely blocking — do not invent questions to fill the slot.

Rules: STRICT tool output. Drafts in the landlord's preferred_language. Weight the AGENT'S OWN NOTES heavily — they are direct operator intelligence. Never fabricate confident scores without evidence; if data is thin, return low/neutral scores and add 'insufficient_contact_data' to red_flags.`;

      const userPrompt = `LANDLORD: ${landlord.full_name_en || landlord.full_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`}
Phone: ${landlord.phone || '?'} | Lang: ${landlord.preferred_language || 'en'} | Nationality: ${landlord.nationality || '?'} | Archetype: ${landlord.landlord_archetype || 'unknown'}
Stage: ${landlord.stage} (entered ${fmtDate(landlord.stage_entered_at)}, ${daysInStage}d) | Mandate: ${landlord.mandate_type || 'none'}/${landlord.mandate_status || '?'} | Commission negotiated: ${landlord.commission_pct_negotiated ?? '?'}%
Form A contracts: ${Array.isArray(landlord.form_a_contracts) ? landlord.form_a_contracts.length : 0}
Prior brokerages: ${landlord.prior_brokerage_count || 0} | Competing brokers: ${landlord.competing_brokers_count || 0} | Listed elsewhere: ${landlord.is_currently_listed_with_others ? 'YES' : 'no'}

PRICE & VALUATION:
asking_price_aed = ${askingPrice ?? 'NONE SET'}
AI valuation = ${valuation ?? '?'} AED${prop.ai_estimated_price_sqft ? ` (${prop.ai_estimated_price_sqft}/sqft)` : ''} | confidence: ${prop.ai_valuation_confidence || '?'}
valuation basis: ${prop.ai_valuation_basis || '?'}
price gap vs valuation: ${priceGapPct != null ? `${priceGapPct}%` : '(cannot compute — missing asking or valuation)'}

LATEST CALL QUALIFICATION: ${qualBlock}

CONVERSATION (last ${messages.length} messages, oldest→newest):
${convo || '(no messages yet)'}

AGENT'S OWN NOTES (human-written, high signal):
${notesBlock}

EXISTING TASKS — OPEN (${openTasks.length}): ${openTasks.map(t => `"${t.title}"${t.ai_source ? ` [${t.ai_source}]` : ''}`).join(', ') || '(none)'}
EXISTING TASKS — DONE (${doneTasks.length}): ${doneTasks.map(t => `"${t.title}"`).join(', ') || '(none)'}
ALREADY SCHEDULED (${scheduledTouchpoints.length}): ${scheduledTouchpoints.map(s => `${s.kind}@${fmtDate(s.when)}${s.channel ? `/${s.channel}` : ''}`).join(', ') || '(none)'}

DOCUMENTS: ${docsReceived}/${docsTotal} received. Pending: ${docs.filter(d => d.status === 'pending_request' || d.status === 'requested').map(d => d.document_type).join(', ') || 'none'}
STAKEHOLDERS (${stakeholders.length}): ${stakeholders.map(s => `${s.name}(${s.role})`).join(', ') || '(none)'}
NEGOTIATION: ${negotiation ? JSON.stringify({ asking: negotiation.asking_price_current, cma: negotiation.cma_value_aed, gap_pct: negotiation.pricing_gap_pct }) : '(none)'}
PRIOR ROLLING SUMMARY (refine, don't blindly restate): ${landlord.ai_rolling_summary || '(none)'}
PRIOR DEAL THESIS (evolve it — keep what holds, revise only what changed): ${landlord.ai_deal_thesis || '(none yet — establish it)'}

Reason over all of the above and emit the orchestrator result.`;

      result = await callClaude(systemPrompt, userPrompt, FULL_MODEL, FULL_SCHEMA);
    }

    if (!result) {
      return Response.json({ error: 'Claude call failed', tier: effectiveTier, last_run: new Date().toISOString() }, { status: 500 });
    }

    // TEMP DIAGNOSTIC (remove after investigation): prove whether the model emitted ai_deal_thesis.
    console.log('[THESIS-DIAG] result keys:', Object.keys(result || {}).join(', '));
    console.log('[THESIS-DIAG] has ai_deal_thesis key:', Object.prototype.hasOwnProperty.call(result || {}, 'ai_deal_thesis'));
    console.log('[THESIS-DIAG] ai_deal_thesis value:', JSON.stringify(result?.ai_deal_thesis));
    console.log('[THESIS-DIAG] has ai_open_questions key:', Object.prototype.hasOwnProperty.call(result || {}, 'ai_open_questions'));
    console.log('[THESIS-DIAG] ai_open_questions value:', JSON.stringify(result?.ai_open_questions));

    // Build the Landlord.update — only fields the tier produced; always idempotent (single update).
    const update = {
      last_orchestrator_run_at: new Date().toISOString(),
      ai_processed_at: new Date().toISOString(),
      ai_model_used: modelUsed,
      ai_processing_status: 'completed'
    };

    if (effectiveTier === 'cold') {
      if (result.urgency_score != null) { update.urgency_score = normScore(result.urgency_score, 100); update.urgency_score_rationale = result.urgency_score_rationale || null; }
      if (result.rapport_level) update.rapport_level = result.rapport_level;
      if (result.landlord_archetype) update.landlord_archetype = result.landlord_archetype;
      if (result.ai_rolling_summary) update.ai_rolling_summary = result.ai_rolling_summary;
      if (result.ai_next_best_action) update.ai_next_best_action = result.ai_next_best_action;
      update.ai_suggested_messages = normalizeMessages(result.ai_suggested_messages, 'cold_open', landlord);
    } else {
      // State-aware dedupe: drop any suggested task/follow-up whose template_key already exists as an
      // open/done entity (defence-in-depth on top of the prompt instruction).
      const suggestedTasks = (Array.isArray(result.suggested_tasks) ? result.suggested_tasks : [])
        .filter(t => t && typeof t === 'object' && TASK_TEMPLATE_KEYS.includes(t.template_key) && !existingTaskKeys.has(t.template_key))
        .slice(0, 5)
        .map(t => ({ template_key: t.template_key, reason: typeof t.reason === 'string' ? t.reason : '' }));
      const suggestedFollowups = (Array.isArray(result.suggested_followups) ? result.suggested_followups : [])
        .filter(f => f && typeof f === 'object' && FOLLOWUP_TEMPLATE_KEYS.includes(f.template_key) && !existingFollowupKeys.has(f.template_key))
        .slice(0, 4)
        .map(f => ({
          template_key: f.template_key,
          when_offset_days: (typeof f.when_offset_days === 'number' && isFinite(f.when_offset_days)) ? Math.max(0, Math.round(f.when_offset_days)) : 1,
          suggested_hour: (typeof f.suggested_hour === 'number' && isFinite(f.suggested_hour)) ? Math.min(23, Math.max(0, Math.round(f.suggested_hour))) : 10,
          channel: ['whatsapp', 'call', 'email'].includes(f.channel) ? f.channel : 'whatsapp',
          reason: typeof f.reason === 'string' ? f.reason : ''
        }));

      Object.assign(update, {
        sub_stage: result.sub_stage,
        days_in_stage: daysInStage,
        trust_score: normScore(result.trust_score, 100),
        trust_score_rationale: result.trust_score_rationale || null,
        responsiveness_score: normScore(result.responsiveness_score, 100),
        responsiveness_score_rationale: result.responsiveness_score_rationale || null,
        mandate_win_probability: normScore(result.mandate_win_probability, 1),
        mandate_win_rationale: result.mandate_win_rationale || null,
        urgency_score: normScore(result.urgency_score, 100),
        urgency_score_rationale: result.urgency_score_rationale || null,
        estimated_commission_aed: num(result.estimated_commission_aed),
        rapport_level: result.rapport_level,
        red_flags: Array.isArray(result.red_flags) ? result.red_flags : [],
        buying_signals: Array.isArray(result.buying_signals) ? result.buying_signals : [],
        ai_objections: Array.isArray(result.ai_objections) ? result.ai_objections : [],
        ai_rolling_summary: result.ai_rolling_summary,
        ai_coaching_for_agent: result.ai_coaching_for_agent,
        ai_next_best_action: result.ai_next_best_action,
        ai_suggested_tasks: suggestedTasks,
        ai_suggested_followups: suggestedFollowups,
        ai_suggested_messages: normalizeMessages(result.ai_suggested_messages, 'reply', landlord),
        ai_momentum: result.ai_momentum,
        ai_strike_now: result.ai_strike_now,
        needs_human_review: result.needs_human_review,
        review_reason: result.review_reason
      });

      if (result.new_stage && result.new_stage !== landlord.stage && STAGES.indexOf(result.new_stage) >= 0) {
        update.stage = result.new_stage;
        update.stage_entered_at = new Date().toISOString();
        // stage_history item shape matches the live Landlord schema: {stage, entered_at, duration_days}.
        update.stage_history = [
          ...(Array.isArray(landlord.stage_history) ? landlord.stage_history : []),
          { stage: landlord.stage, entered_at: landlord.stage_entered_at, duration_days: daysInStage }
        ];
      }
    }

    await svc.entities.Landlord.update(landlord.id, update);

    // V3 Phase 2 (REMEMBER): persistent deal thesis + ask-the-agent open questions, written in a
    // SEPARATE, non-fatal update. If these two fields are not yet live in the Base44 schema, a rejected
    // write degrades HERE instead of bricking the core orchestrator update above; once the fields are
    // applied it simply starts persisting. Full tier only (cold has no thesis); skipped if the model
    // returned neither. An empty ai_open_questions array is intentional — it clears stale questions.
    if (effectiveTier === 'full') {
      const memoryUpdate = {};
      if (typeof result.ai_deal_thesis === 'string' && result.ai_deal_thesis.trim()) {
        memoryUpdate.ai_deal_thesis = result.ai_deal_thesis.trim();
      }
      if (Array.isArray(result.ai_open_questions)) {
        memoryUpdate.ai_open_questions = result.ai_open_questions
          .filter(q => q && typeof q === 'object' && typeof q.question === 'string' && q.question.trim())
          .slice(0, 3)
          .map(q => ({ question: q.question.trim(), why: typeof q.why === 'string' ? q.why.trim() : '' }));
      }
      console.log('[THESIS-DIAG] memoryUpdate to write:', JSON.stringify(memoryUpdate));
      if (Object.keys(memoryUpdate).length) {
        try {
          await svc.entities.Landlord.update(landlord.id, memoryUpdate);
          console.log('[THESIS-DIAG] memoryUpdate write SUCCEEDED');
        } catch (memErr) {
          console.error('[THESIS-DIAG] memoryUpdate write FAILED (full error):', memErr);
          console.error('ai_deal_thesis/ai_open_questions write failed (non-fatal — apply live schema):', memErr?.message);
        }
      } else {
        console.log('[THESIS-DIAG] memoryUpdate is EMPTY — nothing to write (model omitted thesis & questions)');
      }
    }

    // KEEP IN SYNC across all 3 writers (landlordOrchestrator, backfillLandlordBrainV2,
    // backfillLandlordAIAnalysis). Append-only score snapshot — exactly ONE per successful
    // Landlord.update, built from the values just written. Non-fatal: a failure here must never
    // break the writer. Forward-only — never fabricates historical snapshots.
    // Logic identical across all 3 EXCEPT (1) payload var name (update vs updatePayload),
    // (2) the orchestrator's days_in_stage falls back to the computed daysInStage variable
    // (in scope here only) — do NOT "fix" it to null to match the backfills.
    try {
      await svc.entities.LandlordScoreSnapshot.create({
        landlord_id: landlord.id,
        captured_at: new Date().toISOString(),
        orchestrator_run_at: update.last_orchestrator_run_at || update.ai_processed_at || new Date().toISOString(),
        ai_model_used: update.ai_model_used || null,
        stage: update.stage || landlord.stage || null,
        sub_stage: (update.sub_stage != null) ? update.sub_stage : (landlord.sub_stage || null),
        days_in_stage: (typeof update.days_in_stage === 'number') ? update.days_in_stage : daysInStage,
        trust_score: (update.trust_score != null) ? update.trust_score : null,
        responsiveness_score: (update.responsiveness_score != null) ? update.responsiveness_score : null,
        mandate_win_probability: (update.mandate_win_probability != null) ? update.mandate_win_probability : null,
        urgency_score: (update.urgency_score != null) ? update.urgency_score : null,
        rapport_level: update.rapport_level || null,
        ai_momentum: update.ai_momentum || null,
        ai_strike_now: (update.ai_strike_now != null) ? update.ai_strike_now : null,
        needs_human_review: (update.needs_human_review != null) ? update.needs_human_review : null,
        review_reason: update.review_reason || null,
      });
    } catch (snapErr) {
      console.error('LandlordScoreSnapshot create failed (non-fatal):', snapErr?.message);
    }

    return Response.json({ ok: true, tier: effectiveTier, ...update });
  } catch (error) {
    console.error('landlordOrchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});