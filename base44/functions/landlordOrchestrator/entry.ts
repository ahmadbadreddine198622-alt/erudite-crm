import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

/**
 * Landlord Orchestrator — the heartbeat. Runs hourly per active landlord.
 *
 * Reads:
 *   - Landlord record
 *   - All linked LandlordProperty rows
 *   - Mandate negotiation
 *   - Stakeholders
 *   - Recent activities (last 20)
 *   - Document checklist status
 *
 * Updates:
 *   - stage + sub_stage (if entry criteria of next stage met)
 *   - days_in_stage
 *   - trust_score, responsiveness_score
 *   - mandate_win_probability
 *   - urgency_score
 *   - rapport_level
 *   - red_flags, buying_signals
 *   - ai_rolling_summary
 *   - ai_coaching_for_agent
 *   - ai_next_best_action
 *   - ai_momentum + ai_strike_now
 *   - needs_human_review flag
 */

const STAGES = [
  'sourced', 'first_contact', 'property_discovery', 'pricing_alignment',
  'mandate_negotiation', 'form_a_drafting', 'form_a_signature',
  'documents_collection', 'marketing_live', 'viewings_flow',
  'offer_negotiation', 'form_f_and_deposit', 'closing', 'post_completion'
];

// The only valid TaskTemplate keys (seeded in the TaskTemplate library). Used both to
// constrain the model via the tool schema enum AND to validate the model's output in code
// (defence-in-depth: any hallucinated key is dropped before write-back).
const TASK_TEMPLATE_KEYS = [
  'chase_document', 'clarify_price', 'reduce_price', 'send_comps', 'book_call',
  'book_viewing', 'schedule_photographer', 'get_mandate_signed', 'follow_up_silence',
  'switch_channel', 'map_stakeholder', 'verify_permit', 'publish_listing'
];

const ORCHESTRATOR_SCHEMA = {
  type: 'object',
  properties: {
    new_stage: { type: ['string', 'null'] },
    sub_stage: { type: ['string', 'null'] },
    trust_score: { type: 'number' },
    responsiveness_score: { type: 'number' },
    mandate_win_probability: { type: 'number' },
    urgency_score: { type: 'number' },
    rapport_level: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
    buying_signals: { type: 'array', items: { type: 'string' } },
    ai_rolling_summary: { type: 'string' },
    ai_coaching_for_agent: { type: 'string' },
    ai_next_best_action: {
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
    },
    suggested_tasks: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      description: '3-5 recommended next tasks for this landlord, ranked most-important first.',
      items: {
        type: 'object',
        properties: {
          template_key: {
            type: 'string',
            enum: TASK_TEMPLATE_KEYS,
            description: 'Which TaskTemplate this suggestion maps to. MUST be one of the enumerated keys.'
          },
          reason: {
            type: 'string',
            description: 'One short sentence: why this task matters for THIS landlord right now.'
          }
        },
        required: ['template_key', 'reason']
      }
    },
    ai_momentum: { type: 'string', enum: ['accelerating', 'steady', 'slowing', 'stalled'] },
    ai_strike_now: { type: 'boolean' },
    needs_human_review: { type: 'boolean' },
    review_reason: { type: ['string', 'null'] }
  },
  required: ['trust_score', 'mandate_win_probability', 'ai_rolling_summary', 'ai_next_best_action']
};

async function callClaude(system, prompt, model = 'claude-opus-4-7') {
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'emit_orchestrator',
        description: 'Emit the landlord orchestration result with all required fields.',
        input_schema: ORCHESTRATOR_SCHEMA
      }],
      tool_choice: { type: 'tool', name: 'emit_orchestrator' }
    });
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    return toolBlock ? toolBlock.input : null;
  } catch (err) {
    console.error('Claude call failed:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, force = false } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    // Skip if recently run and not forced
    if (!force && landlord.last_orchestrator_run_at) {
      const hoursSince = (Date.now() - new Date(landlord.last_orchestrator_run_at).getTime()) / 3.6e6;
      if (hoursSince < 6) return Response.json({ skipped: 'recently_run', hours_since: hoursSince });
    }

    // Gather context
    const [properties, negotiation, stakeholders, activities, docs] = await Promise.all([
      base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id }).catch(() => []),
      base44.asServiceRole.entities.MandateNegotiation.filter({ landlord_id }).then(r => r?.[0]).catch(() => null),
      base44.asServiceRole.entities.LandlordStakeholder.filter({ landlord_id }).catch(() => []),
      base44.asServiceRole.entities.Activity.filter({ lead_id: landlord_id }, '-created_at', 20).catch(() => []),
      base44.asServiceRole.entities.DocumentChecklistItem.filter({ landlord_id }).catch(() => [])
    ]);

    const stageIdx = STAGES.indexOf(landlord.stage);
    const daysInStage = landlord.stage_entered_at
      ? Math.floor((Date.now() - new Date(landlord.stage_entered_at).getTime()) / 86400000)
      : 0;
    const docsReceived = docs.filter(d => d.status === 'received' || d.status === 'verified').length;
    const docsTotal = docs.filter(d => d.status !== 'not_required').length;
    const docsCompletionPct = docsTotal > 0 ? (docsReceived / docsTotal) * 100 : 0;

    const systemPrompt = `You are LANDLORD AURORA — an autonomous AI co-pilot for a Dubai real-estate agent pursuing landlord mandates.

You wake up hourly to assess a single landlord and decide:

1. STAGE PROGRESSION: Should the landlord move to the next stage? Detect sub-stages (e.g. "objection_resolution_in_progress").
2. SCORES: Recompute trust_score (0-100), responsiveness_score (0-100), mandate_win_probability (0-1), urgency_score (0-100).
3. RAPPORT LEVEL: cold → warming → rapport_built → trust_established → champion
4. SIGNALS: List buying signals (e.g. "asked about commission split") and red flags (e.g. "mentioned 3 other brokers in past 2 days").
5. ROLLING SUMMARY: 3-5 sentences narrating the relationship state.
6. COACHING: 1-2 specific actionable sentences for THIS agent on THIS landlord.
7. NEXT BEST ACTION: action + priority + scheduled_for + draft_message (in landlord's language) + reasoning + confidence.
8. MOMENTUM: accelerating | steady | slowing | stalled
9. STRIKE_NOW: true if momentum=accelerating AND urgency>70 AND mandate_win_probability>0.4
10. ESCALATION: needs_human_review = true if value >10M AED with red flag, OR competing_brokers_count >= 3, OR stuck >14d in same stage.
11. SUGGESTED TASKS: Recommend 3-5 concrete next tasks for this landlord, ranked most-important first. Each task MUST reference exactly one of these template keys: chase_document, clarify_price, reduce_price, send_comps, book_call, book_viewing, schedule_photographer, get_mandate_signed, follow_up_silence, switch_channel, map_stakeholder, verify_permit, publish_listing. Give a one-sentence reason per task, specific to THIS landlord. Choose keys that fit the current stage, document status, pricing gap, silence/responsiveness, and signals. Do NOT invent keys outside this list.

Rules:
- STRICT JSON output. No prose.
- Stage advances must be EARNED (have evidence in signals/activities). Don't move stages optimistically.
- Coaching: specific to this landlord. "Stay professional" is bad. "He's analytical — lead with DLD comp data, avoid emotional language" is good.
- Drafts in landlord's preferred_language.
- If there is insufficient contact/activity history to judge a score, return a low/neutral score AND include an entry like 'insufficient_contact_data' in red_flags. Never fabricate confident scores without evidence.`;

    const userPrompt = `LANDLORD: ${landlord.full_name_en || landlord.full_name || `${landlord.first_name} ${landlord.last_name}`}
Phone: ${landlord.phone}  |  Lang: ${landlord.preferred_language || 'en'}  |  Nationality: ${landlord.nationality || '?'}
Archetype: ${landlord.landlord_archetype || 'unknown'}
Stage: ${landlord.stage} (entered ${landlord.stage_entered_at || '?'}, ${daysInStage} days)
Mandate: ${landlord.mandate_type || 'none'} — status: ${landlord.mandate_status}
Source: ${landlord.source}
Prior brokerages: ${landlord.prior_brokerage_count || 0}  |  Competing brokers: ${landlord.competing_brokers_count || 0}
Currently listed with others: ${landlord.is_currently_listed_with_others ? 'YES' : 'no'}

PRIOR SCORES:
trust=${landlord.trust_score ?? '?'}  responsiveness=${landlord.responsiveness_score ?? '?'}  mandate_win=${landlord.mandate_win_probability ?? '?'}  urgency=${landlord.urgency_score ?? '?'}

PROPERTIES (${properties.length}):
${properties.slice(0, 5).map(p => `- ${p.title_deed_number || p.id}: asking ${p.asking_price_aed || '?'} AED, tenancy=${p.tenancy_status}, mortgage=${p.mortgage_status}`).join('\n') || '(none)'}

NEGOTIATION:
${negotiation ? JSON.stringify({
  asking: negotiation.asking_price_current,
  cma: negotiation.cma_value_aed,
  gap_pct: negotiation.pricing_gap_pct,
  commission: negotiation.commission_offered_pct,
  competitors: negotiation.competitor_offers?.length || 0
}) : '(none yet)'}

STAKEHOLDERS (${stakeholders.length}):
${stakeholders.map(s => `- ${s.name} (${s.role}, power=${s.decision_power}, sentiment=${s.sentiment})`).join('\n') || '(none mapped)'}

DOCUMENTS: ${docsReceived}/${docsTotal} received (${docsCompletionPct.toFixed(0)}%)
Pending: ${docs.filter(d => d.status === 'pending_request' || d.status === 'requested').map(d => d.document_type).join(', ') || 'none pending'}

RECENT ACTIVITIES (${activities.length}):
${activities.slice(0, 10).map(a => `- ${a.created_at}: ${a.type}/${a.outcome || '?'} — ${a.ai_summary || a.title || '?'}`).join('\n') || '(no activities yet)'}

PRIOR ROLLING SUMMARY:
${landlord.ai_rolling_summary || '(none)'}

Analyze and emit orchestrator JSON.`;

    const result = await callClaude(systemPrompt, userPrompt);

    if (!result) {
      return Response.json({ error: 'Claude call failed', last_run: new Date().toISOString() }, { status: 500 });
    }

    // Normalize/guard: ensure no undefined values are written, keep honest behavior for data-poor landlords
    const normalizeScore = (val, max) => {
      if (typeof val === 'number' && isFinite(val)) return Math.max(0, Math.min(max, val));
      return null;
    };
    const normalizedResult = {
      ...result,
      trust_score: normalizeScore(result.trust_score, 100),
      responsiveness_score: normalizeScore(result.responsiveness_score, 100),
      urgency_score: normalizeScore(result.urgency_score, 100),
      mandate_win_probability: normalizeScore(result.mandate_win_probability, 1),
      red_flags: Array.isArray(result.red_flags) ? result.red_flags : [],
      buying_signals: Array.isArray(result.buying_signals) ? result.buying_signals : [],
      // Validate AI-suggested tasks in code: drop non-objects and any key not in the library,
      // keep only {template_key, reason}, cap at 5, default to [] so a model miss is harmless.
      suggested_tasks: Array.isArray(result.suggested_tasks)
        ? result.suggested_tasks
            .filter(t => t && typeof t === 'object' && TASK_TEMPLATE_KEYS.includes(t.template_key))
            .slice(0, 5)
            .map(t => ({ template_key: t.template_key, reason: typeof t.reason === 'string' ? t.reason : '' }))
        : [],
    };

    const update = {
      sub_stage: normalizedResult.sub_stage,
      days_in_stage: daysInStage,
      trust_score: normalizedResult.trust_score,
      responsiveness_score: normalizedResult.responsiveness_score,
      mandate_win_probability: normalizedResult.mandate_win_probability,
      urgency_score: normalizedResult.urgency_score,
      rapport_level: normalizedResult.rapport_level,
      red_flags: normalizedResult.red_flags,
      buying_signals: normalizedResult.buying_signals,
      ai_rolling_summary: normalizedResult.ai_rolling_summary,
      ai_coaching_for_agent: normalizedResult.ai_coaching_for_agent,
      ai_next_best_action: normalizedResult.ai_next_best_action,
      ai_suggested_tasks: normalizedResult.suggested_tasks,
      ai_momentum: normalizedResult.ai_momentum,
      ai_strike_now: normalizedResult.ai_strike_now,
      needs_human_review: normalizedResult.needs_human_review,
      review_reason: normalizedResult.review_reason,
      last_orchestrator_run_at: new Date().toISOString(),
      ai_processed_at: new Date().toISOString(),
      ai_model_used: 'claude-opus-4-7',
      ai_processing_status: 'completed'
    };

    if (normalizedResult.new_stage && normalizedResult.new_stage !== landlord.stage && STAGES.indexOf(normalizedResult.new_stage) >= 0) {
      update.stage = normalizedResult.new_stage;
      update.stage_entered_at = new Date().toISOString();
      update.stage_history = [
        ...(landlord.stage_history || []),
        {
          stage: landlord.stage,
          entered_at: landlord.stage_entered_at,
          exited_at: new Date().toISOString(),
          duration_hours: daysInStage * 24
        }
      ];
    }

    await base44.asServiceRole.entities.Landlord.update(landlord.id, update);

    return Response.json({ ok: true, ...update });
  } catch (error) {
    console.error('landlordOrchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});