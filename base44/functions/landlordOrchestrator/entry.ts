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
  'initial_contact', 'attempted_to_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation',
  'form_a_signing', 'owner_documents', 'photos_videos', 'photographer_scheduling', 'listing_creation',
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
  'price_check_in', 'post_viewing_followup', 'weekly_touch', 'mandate_renewal_warn',
  // Sales Doctrine — the 14-Day Law cadence + unsold competitor watch
  'rule5_day2_value_drop', 'rule5_day5_call', 'rule5_day9_voice_note',
  'rule5_day14_snapshot', 'law14_nurture', 'unsold_competitor_watch_30'
];

// Sales Doctrine — the non-negotiable rules every AI output must obey.
const DOCTRINE_RULES = `
SALES DOCTRINE (non-negotiable — every message, action, and follow-up MUST obey):
1. ONE clear ask per message. Never bundle multiple requests. The landlord should know exactly what to do next.
2. Next step is ALWAYS scheduled. No message leaves the landlord hanging — every outbound either proposes a specific time or references an already-scheduled touch.
3. VALUE BEFORE PRICE. Lead with what the landlord gains (data, market insight, buyer access, saved time) before discussing commission or asking price. Never open with price.
4. FOLLOW UP UNTIL SIGNED OR DEFINITIVE NO. Silence is not a "no". A landlord who ghosted is a landlord still in play — the cadence continues until you have a signed mandate or an explicit, unambiguous "no".
5. THE 14-DAY LAW: no landlord in an active stage goes 14 days without a scheduled next touch. If the landlord has NO pending Followup, NO upcoming LandlordAppointment, and NO scheduled task/call/meeting/viewing, that is a DOCTRINE VIOLATION. The next-best-action MUST be "schedule_next_touch" and a follow-up from the cadence below MUST be proposed.
6. THE CADENCE (pick the right one based on stage, days_in_stage, and last-contact recency):
   - rule5_day2_value_drop   → day 2 after last contact: deliver a piece of value (a comp, a market data point, a buyer persona) — NO ask.
   - rule5_day5_call         → day 5: a short call to check in (not a hard pitch).
   - rule5_day9_voice_note   → day 9: a personal voice note (warmth + presence).
   - rule5_day14_snapshot    → day 14: a "where we are" snapshot message — restate value + the one ask.
   - law14_nurture           → beyond 14 days with no response: shift to long-horizon nurture (monthly value touch, no pressure).
   - unsold_competitor_watch_30 → when the unit is listed with others and not selling: every 30 days, send a market-reality check (days on market of comparable listings, price drops nearby) to gently pull the mandate toward us.`;

const FULL_MODEL = 'claude-opus-4-8';            // strongest — quality matters for the brain
const COLD_MODEL = 'claude-haiku-4-5-20251001';  // lighter — used only when there's no conversation yet

// ───────────────────────────────────────────────────────────────────────────
// KEEP IN SYNC across all 3 writers (landlordOrchestrator, backfillLandlordBrainV2,
// backfillLandlordAIAnalysis). Engagement-wins tier routing with a force_cold escape hatch.
//
// Engagement signals (ANY one ⇒ engaged):
//   • stage beyond initial_contact
//   • rapport beyond cold
//   • any inbound message OR any activity on record
//
// Resolution order:
//   1. forceCold === true → 'cold'  (explicit, deliberate bulk cost-control — overrides engagement)
//   2. engaged            → 'full'  (auto-upgrade — an engaged lead is never thesis-starved)
//   3. otherwise          → requestedTier === 'full' ? 'full' : 'cold'
//
// requestedTier is the caller's hint ('full' | 'cold' | undefined). It can only be UPGRADED by
// engagement, never used to downgrade an engaged lead — only forceCold downgrades.
function resolveTier({ landlord, hasInbound, hasActivity, forceCold = false, requestedTier }) {
  if (forceCold === true) return 'cold';
  const stageEngaged = !!landlord.stage && landlord.stage !== 'initial_contact';
  const rapportEngaged = !!landlord.rapport_level && landlord.rapport_level !== 'cold';
  const contactEngaged = !!hasInbound || !!hasActivity;
  if (stageEngaged || rapportEngaged || contactEngaged) return 'full';
  return requestedTier === 'full' ? 'full' : 'cold';
}

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
    review_reason: { type: ['string', 'null'] },
    // ── BRAIN V4 P3 (CORTEX) additions ──
    ai_confidence: {
      type: 'object',
      description: 'How sure you are in each score given the DEPTH of evidence (0-1 each). Thin data ⇒ low confidence, never inflated. overall = your holistic confidence in this whole analysis.',
      properties: {
        trust: { type: 'number' },
        urgency: { type: 'number' },
        win_prob: { type: 'number' },
        overall: { type: 'number' }
      },
      required: ['trust', 'urgency', 'win_prob', 'overall']
    },
    ai_highest_leverage_unknown: {
      type: 'string',
      description: 'The ONE fact that, if known, would most change your conclusion about this landlord — the highest expected-information-value unknown. One sentence.'
    },
    ai_reasoning_trace: {
      type: 'array', minItems: 2, maxItems: 8,
      description: 'The evidence trail for your MAJOR outputs (next-best-action, win probability, chosen channel/angle, stage recommendation, campaign choices). Each claim cites its grounds: deed:<unit+date> | doctrine:<rule> | prior:<bucket> | note:<date> | message:<date> | qualification:<date> | portfolio | calibration | tool:<name>. A claim you cannot ground must be weakened or dropped.',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string', description: 'One-sentence claim underlying a major output.' },
          grounds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5, description: 'Evidence citations for this claim.' }
        },
        required: ['claim', 'grounds']
      }
    },
    self_critique: {
      type: 'object',
      description: 'MANDATORY final pass before emitting: identify the two weakest claims in your own analysis and state how you adjusted scores/confidence because of them.',
      properties: {
        weakest_claims: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
        adjustments_applied: { type: 'string', description: 'What you changed after the critique (scores lowered, confidence reduced, question added) — or why nothing needed changing.' }
      },
      required: ['weakest_claims', 'adjustments_applied']
    },
    ai_campaign_plan: {
      type: 'object',
      description: 'BRAIN V4 P5: the 14-30 day multi-touch campaign plan. Touch #1 IS the next-best-action. Cadence-native (rule5_* keys), engagement-decay-aware, quiet-hours-safe. Suggestions only — a human sends every message.',
      properties: {
        objective: { type: 'string', description: 'The single outcome this campaign drives toward (e.g. "signed exclusive Form A before the competitor mandate expires").' },
        touches: {
          type: 'array', minItems: 2, maxItems: 8,
          items: {
            type: 'object',
            properties: {
              day_offset: { type: 'number', description: 'Days from today (0-30).' },
              channel: { type: 'string', enum: ['whatsapp', 'imessage', 'telegram', 'sms', 'email', 'call'] },
              angle: { type: 'string', description: 'Strategic angle for this touch (value_drop, direct_status, ...).' },
              template_key: { type: 'string', description: `Cadence key when one fits (${FOLLOWUP_TEMPLATE_KEYS.join(', ')}) — else empty.` },
              freeform_intent: { type: 'string', description: 'One sentence: what this touch delivers/asks.' },
              hour: { type: 'number', description: 'Send hour 9-21 Asia/Dubai (quiet hours 21:00-09:00 are FORBIDDEN).' },
              success_criteria: { type: 'string', description: 'What outcome marks this touch successful.' }
            },
            required: ['day_offset', 'channel', 'freeform_intent', 'hour']
          }
        },
        exit_conditions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4, description: 'When the plan STOPS or REPLANS (owner replies → collapse to the reply branch; mandate signed → stop; definitive no → stop).' }
      },
      required: ['objective', 'touches', 'exit_conditions']
    }
  },
  required: ['trust_score', 'mandate_win_probability', 'ai_rolling_summary', 'ai_next_best_action', 'ai_confidence', 'self_critique', 'ai_campaign_plan']
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

async function callClaude(system, prompt, model, schema, maxTokens = 4096) {
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
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

// ── BRAIN V4 P3 CORTEX: the bounded agentic investigation loop ─────────────────
// The full tier no longer takes one static dump and answers in one shot: the model may PULL
// exactly what its hypothesis needs through READ-ONLY investigation tools (≤ MAX_TOOL_CALLS,
// hard wall-clock budget), then MUST finish by calling emit_orchestrator. All V3 packs remain
// pre-fetched context — the tools go DEEPER, they never replace the doctrine or the packs.
// Cold tier stays one-shot Haiku (callClaude above).
const MAX_TOOL_CALLS = 6;
const TOOL_PHASE_BUDGET_MS = 60_000;

const INVESTIGATION_TOOLS = [
  {
    name: 'lookup_comps',
    description: 'Deed comparables for a project + unit type from the analyzed MarketReport transactions (DLD deed data — the value truth). Use when your pricing hypothesis needs deeper/different comps than the MARKET PACK already shows (another type for ladder context, a longer window, a different project the owner also holds in).',
    input_schema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: "Project name (defaults to this landlord's project)." },
        unit_type: { type: 'string', enum: ['studio', '1br', '2br', '3br', '4plus'], description: 'Bedroom type — comps are ALWAYS type-pure.' },
        months: { type: 'number', description: 'Lookback window in months (default 6).' }
      }
    }
  },
  {
    name: 'lookup_owner_portfolio',
    description: "The owner's FULL unit registry portfolio (every unit they hold across projects). Use when deciding whether to widen the mandate or when a cross-holding could change the strategy.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'lookup_cohort_prior',
    description: "Measured outreach outcomes for a cohort from this brokerage's own ledger (reply rates, latency, best hours, mandates). Aggregates only. Use to test a channel/angle hypothesis beyond the PLAYBOOK PRIORS already shown.",
    input_schema: {
      type: 'object',
      properties: {
        archetype: { type: 'string', description: "Landlord archetype (defaults to this landlord's)." },
        nationality: { type: 'string', description: "Nationality (defaults to this landlord's; bucketed coarsely)." },
        channel: { type: 'string', enum: ['whatsapp', 'imessage', 'telegram', 'sms', 'email', 'call'] }
      }
    }
  },
  {
    name: 'lookup_outcome_history',
    description: "THIS landlord's outcome ledger: every recorded send (with angle), reply (with latency), qualification, appointment outcome, and lifecycle event. Use to see what has actually been tried on this owner and what worked.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'lookup_pipeline_context',
    description: "AGGREGATE pipeline context for this landlord's project: how many sibling owners are in the pipeline, their stage distribution, how many are listed with competitors. NEVER returns another owner's name, unit, price, or conversation. Use when competition inside the tower could change urgency or framing.",
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'check_calendar_conflicts',
    description: "The assigned agent's upcoming scheduled load (appointments per day, pending follow-ups) for the next 14 days — aggregate counts only. Use before proposing a specific call slot or a dense cadence.",
    input_schema: {
      type: 'object',
      properties: { agent_email: { type: 'string', description: "Agent email (defaults to this landlord's assigned agent)." } }
    }
  }
];

// Executors are built per-run (closure over svc + landlord + pre-gathered packs). Every executor
// is READ-ONLY and degrade-safe: it returns a string, never throws, never writes.
function buildInvestigationExecutors(svc, landlord, prectx) {
  const clip = (s, n) => String(s || '').slice(0, n);
  return {
    lookup_comps: async (input) => {
      try {
        const projName = clip(input?.project || landlord.project_name || '', 80);
        if (!projName) return 'no project known for this landlord — cannot look up comps';
        const months = (typeof input?.months === 'number' && input.months > 0 && input.months <= 24) ? input.months : 6;
        const reports = await svc.entities.MarketReport.filter({ status: 'analyzed' }, '-report_date', 40).catch(() => []);
        const report = (Array.isArray(reports) ? reports : []).find(r => matchProjectName(projName, r.project_name));
        if (!report) return `no analyzed MarketReport matches project "${projName}" — do not quote figures for it`;
        const txs = await svc.entities.MarketTransaction.filter({ market_report_id: report.id }, '-transaction_date', 500).catch(() => []);
        const cutoff = new Date(Date.now() - months * 30 * 86400000).toISOString().slice(0, 10);
        let clean = (Array.isArray(txs) ? txs : []).filter(t => !t.is_outlier && String(t.transaction_date || '') >= cutoff);
        if (input?.unit_type) clean = clean.filter(t => t.bedrooms === input.unit_type);
        if (!clean.length) return `no ${input?.unit_type || ''} deeds in the last ${months} months for ${report.project_name} — widen the window or use the report medians`;
        const psf = clean.map(t => t.price_per_sqft).filter(v => typeof v === 'number');
        const med = psf.length ? psf.slice().sort((a, b) => a - b)[Math.floor(psf.length / 2)] : null;
        const rows = clean.slice(0, 12).map(t => `${t.transaction_date} ${t.unit_number} ${t.bedrooms || '?'} ${t.area_sqft || '?'}sqft AED ${Number(t.price_aed).toLocaleString('en-US')} @${t.price_per_sqft ?? '?'}/sqft`);
        return `${report.project_name} — ${clean.length} ${input?.unit_type || 'all-type'} deeds in last ${months}mo${med ? ` | median ${med} AED/sqft` : ''} (TYPE DISCIPLINE: quote the owner only their own type):\n${rows.join('\n')}`;
      } catch (e) { return `lookup_comps failed: ${e?.message || e}`; }
    },
    lookup_owner_portfolio: async () => {
      try {
        if (prectx.ownerPortfolio) return clip(prectx.ownerPortfolio, 4000);
        const fresh = await gatherOwnerPortfolio(svc, landlord);
        return fresh ? clip(fresh, 4000) : 'no registry match — the owner holds no other known units';
      } catch (e) { return `lookup_owner_portfolio failed: ${e?.message || e}`; }
    },
    lookup_cohort_prior: async (input) => {
      try {
        const arch = clip(input?.archetype || landlord.landlord_archetype || '', 60);
        const nb = natBucket(input?.nationality || landlord.nationality);
        const rows = await svc.entities.PlaybookPrior.filter({}, '-sample_size', 500).catch(() => []);
        const rel = (Array.isArray(rows) ? rows : []).filter(p => {
          if (p.landlord_archetype !== 'any' && p.landlord_archetype !== arch) return false;
          if (p.nationality_bucket !== 'any' && p.nationality_bucket !== nb) return false;
          if (input?.channel && p.channel !== input.channel) return false;
          return true;
        }).slice(0, 10);
        if (!rel.length) return `no measured priors yet for cohort (${arch || 'any'} × ${nb}) — say so rather than inventing a rate`;
        return rel.map(p => `[${p.channel}${p.angle_used !== 'any' ? ` × ${p.angle_used}` : ''}${p.landlord_archetype !== 'any' ? ` × ${p.landlord_archetype}` : ''}${p.nationality_bucket !== 'any' ? ` × ${p.nationality_bucket}` : ''}] reply ${Math.round((p.reply_rate || 0) * 100)}% (n=${p.sample_size}${typeof p.median_latency_hours === 'number' ? `, median ${p.median_latency_hours}h` : ''}${typeof p.best_hour_dubai === 'number' ? `, best hour ${p.best_hour_dubai}:00` : ''})${p.low_confidence ? ' LOW CONFIDENCE' : ''}`).join('\n');
      } catch (e) { return `lookup_cohort_prior failed: ${e?.message || e}`; }
    },
    lookup_outcome_history: async () => {
      try {
        const evs = await svc.entities.OutcomeEvent.filter({ landlord_id: landlord.id }, '-created_date', 50).catch(() => []);
        if (!Array.isArray(evs) || !evs.length) return 'no outcome ledger entries yet for this landlord';
        const lines = evs.slice().reverse().map(e => {
          const when = (e.sent_at || e.responded_at || e.created_date || '').slice(0, 16).replace('T', ' ');
          const bits = [e.kind, e.channel !== 'other' ? e.channel : null, e.angle_used ? `angle:${e.angle_used}` : null,
            typeof e.latency_hours === 'number' ? `latency ${e.latency_hours}h` : null, e.template_key ? `template:${e.template_key}` : null].filter(Boolean);
          return `[${when}] ${bits.join(' · ')}`;
        });
        return clip(lines.join('\n'), 4000);
      } catch (e) { return `lookup_outcome_history failed: ${e?.message || e}`; }
    },
    lookup_pipeline_context: async () => {
      try {
        const projName = landlord.project_name || '';
        if (!projName) return 'no project known — no pipeline context';
        const sibs = await svc.entities.Landlord.filter({ project_name: projName }, '-updated_date', 500).catch(() => []);
        const arr = (Array.isArray(sibs) ? sibs : []).filter(s => s.id !== landlord.id);
        if (!arr.length) return `no sibling owners in the pipeline for ${projName}`;
        const byStage = {};
        let listedElsewhere = 0, signed = 0;
        for (const s of arr) {
          byStage[s.stage || 'unknown'] = (byStage[s.stage || 'unknown'] || 0) + 1;
          if (s.is_currently_listed_with_others) listedElsewhere++;
          if (s.mandate_status === 'form_a_signed') signed++;
        }
        const stageLine = Object.entries(byStage).sort((a, b) => b[1] - a[1]).map(([st, n]) => `${st}: ${n}`).join(', ');
        return `${projName} pipeline (AGGREGATES ONLY — never name another owner): ${arr.length} sibling owners | stages → ${stageLine} | listed with competitors: ${listedElsewhere} | signed mandates: ${signed}`;
      } catch (e) { return `lookup_pipeline_context failed: ${e?.message || e}`; }
    },
    check_calendar_conflicts: async (input) => {
      try {
        const agent = clip(input?.agent_email || landlord.assigned_agent_email || '', 120);
        if (!agent) return 'no assigned agent — no calendar to check';
        const nowIso = new Date().toISOString();
        const [appts, fups] = await Promise.all([
          svc.entities.LandlordAppointment.filter({ agent_email: agent, status: 'scheduled' }, '-datetime', 100).catch(() => []),
          svc.entities.Followup.filter({ agent_email: agent, status: 'pending' }, '-scheduled_at', 100).catch(() => []),
        ]);
        const horizon = Date.now() + 14 * 86400000;
        const byDay = {};
        for (const a of (Array.isArray(appts) ? appts : [])) {
          if (!a.datetime || a.datetime < nowIso || new Date(a.datetime).getTime() > horizon) continue;
          const d = a.datetime.slice(0, 10);
          byDay[d] = byDay[d] || { appts: 0, followups: 0 };
          byDay[d].appts++;
        }
        for (const f of (Array.isArray(fups) ? fups : [])) {
          if (!f.scheduled_at || f.scheduled_at < nowIso || new Date(f.scheduled_at).getTime() > horizon) continue;
          const d = f.scheduled_at.slice(0, 10);
          byDay[d] = byDay[d] || { appts: 0, followups: 0 };
          byDay[d].followups++;
        }
        const days = Object.keys(byDay).sort();
        if (!days.length) return `${agent}: no scheduled appointments or pending follow-ups in the next 14 days — calendar is open`;
        return `${agent} next 14 days (aggregate load):\n` + days.map(d => `${d}: ${byDay[d].appts} appointment(s), ${byDay[d].followups} follow-up(s)`).join('\n');
      } catch (e) { return `check_calendar_conflicts failed: ${e?.message || e}`; }
    },
  };
}

// Runs the investigation loop: model may call investigation tools (cap + wall-clock budget),
// then MUST emit via emit_orchestrator. Returns telemetry for BrainRunLog alongside the result.
async function runCortexLoop({ system, prompt, model, schema, executors }) {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const emitTool = { name: 'emit_orchestrator', description: 'Emit the final landlord orchestration result. Call this exactly once, after any investigation.', input_schema: schema };
  const tools = [...INVESTIGATION_TOOLS, emitTool];
  const messages = [{ role: 'user', content: prompt }];
  const telemetry = { tool_calls: 0, tools_used: [], tokens_in: 0, tokens_out: 0 };
  const started = Date.now();
  try {
    // maxToolCalls investigation turns + 1 forced-emit turn + 1 safety retry.
    for (let turn = 0; turn < MAX_TOOL_CALLS + 2; turn++) {
      const forceEmit = telemetry.tool_calls >= MAX_TOOL_CALLS || (Date.now() - started) > TOOL_PHASE_BUDGET_MS;
      const response = await anthropic.messages.create({
        model,
        max_tokens: 8192,
        system,
        messages,
        tools,
        tool_choice: forceEmit ? { type: 'tool', name: 'emit_orchestrator' } : { type: 'any' }
      });
      telemetry.tokens_in += response.usage?.input_tokens || 0;
      telemetry.tokens_out += response.usage?.output_tokens || 0;
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');
      const emit = toolBlocks.find(b => b.name === 'emit_orchestrator');
      if (emit) return { result: emit.input, ...telemetry };
      if (!toolBlocks.length) {
        // tool_choice guarantees a tool call; this is a belt-and-braces recovery path.
        messages.push({ role: 'assistant', content: response.content.length ? response.content : [{ type: 'text', text: '(no output)' }] });
        messages.push({ role: 'user', content: 'Call emit_orchestrator now with your final result.' });
        continue;
      }
      messages.push({ role: 'assistant', content: response.content });
      const results = [];
      for (const tb of toolBlocks) {
        telemetry.tool_calls++;
        telemetry.tools_used.push(tb.name);
        let out = 'unknown tool';
        const exec = executors[tb.name];
        if (exec) { try { out = await exec(tb.input || {}); } catch (e) { out = `tool error: ${e?.message || e}`; } }
        results.push({ type: 'tool_result', tool_use_id: tb.id, content: String(out).slice(0, 8000) });
      }
      messages.push({ role: 'user', content: results });
    }
    return { result: null, ...telemetry };
  } catch (err) {
    console.error('cortex loop failed:', err);
    return { result: null, error: err?.message || String(err), ...telemetry };
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

// ── PENINSULA 3 MARKET PACK ──────────────────────────────────────────────────────
// P3-only integration: when the landlord belongs to Peninsula 3, fetch the latest analyzed DXB
// Interact MarketReport + its deed MarketTransactions (module-cached 10 min) and build a compact
// market pack: building card + THIS unit's stack deed history + usage rules. Any other project
// returns '' (behavior unchanged). Never throws — degrades to '' on any error.
let P3_MARKET_CACHE = { at: 0, report: null, txs: [] };
const P3_MARKET_CACHE_MS = 10 * 60 * 1000;
const isPeninsula3Name = (name) => {
  const s = String(name || '').toLowerCase().replace(/[\s\-_\.]+/g, '');
  return s.includes('peninsula3') || s.includes('peninsulathree') || s.includes('peninsula03');
};
const medOf = (a) => {
  const x = a.filter(v => typeof v === 'number' && isFinite(v)).sort((p, q) => p - q);
  if (!x.length) return null;
  const m = Math.floor(x.length / 2);
  return x.length % 2 ? x[m] : Math.round((x[m - 1] + x[m]) / 2);
};
// P3-1402 → floor 14, stack "02"; P3-402 → floor 4, stack "02"; P3-P307 → podium, stack "07";
// legacy "04-08" / "22-07" → floor 4/22, stack "08"/"07".
function parseP3UnitRef(ref) {
  const raw = String(ref || '').toUpperCase().replace(/\s+/g, '');
  let m = raw.match(/^P3-?([A-Z]?)(\d{2,4})$/);
  if (m) {
    const digits = m[2];
    const stack = digits.slice(-2);
    const floorStr = digits.slice(0, -2);
    const floor = (!m[1] && floorStr) ? parseInt(floorStr, 10) : null;
    return { floor, stack, podium: !!m[1] };
  }
  m = raw.match(/^(\d{1,2})-(\d{2})$/);
  if (m) return { floor: parseInt(m[1], 10), stack: m[2], podium: false };
  return null;
}
const P3_TYPE_LABEL = { studio: 'Studio', '1br': '1BR', '2br': '2BR', '3br': '3BR', '4plus': '4+BR' };
// Infer the unit's bedroom type from its stack's deed history (nearest floors vote — stacks can
// switch layout by floor zone, e.g. -01 is studio low / 2BR high). Podium: only if stack is unanimous.
function inferP3UnitType(unit, cleanTxs) {
  try {
    if (!unit || !Array.isArray(cleanTxs)) return null;
    const stackTx = cleanTxs.filter(t => t.bedrooms && String(t.unit_number || '').endsWith(`-${unit.stack}`));
    if (!stackTx.length) return null;
    if (unit.floor == null) {
      const set = new Set(stackTx.map(t => t.bedrooms));
      return set.size === 1 ? stackTx[0].bedrooms : null;
    }
    const dist = (t) => { const f = parseInt(String(t.unit_number).split('-')[0], 10); return isFinite(f) ? Math.abs(f - unit.floor) : 999; };
    const nearest = stackTx.slice().sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    const votes = {};
    for (const t of nearest) votes[t.bedrooms] = (votes[t.bedrooms] || 0) + 1;
    const win = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return (win.length === 1 || win[0][1] > win[1][1]) ? win[0][0] : nearest[0].bedrooms;
  } catch (_) { return null; }
}
// One-line benchmark card for a single unit type — never mixes types.
function p3TypeBench(cleanTxs, type) {
  const g = cleanTxs.filter(t => t.bedrooms === type && t.price_per_sqft);
  if (g.length < 3) return '';
  const fl = (t) => parseInt(String(t.unit_number).split('-')[0], 10);
  const band = (a, b) => { const v = g.filter(t => { const f = fl(t); return isFinite(f) && f >= a && f <= b; }).map(t => t.price_per_sqft); return v.length ? medOf(v) : '—'; };
  const sq = g.map(t => t.area_sqft).filter(Boolean);
  const gains = g.map(t => (/capital gain ([+-]\d+)%/.exec(t.description || '') || [])[1]).filter(v => v != null).map(Number);
  const gm = gains.length ? gains.slice().sort((a, b) => a - b)[Math.floor(gains.length / 2)] : null;
  const pre = g.filter(t => !t.is_post_event).map(t => t.price_per_sqft);
  const post = g.filter(t => t.is_post_event).map(t => t.price_per_sqft);
  return `${P3_TYPE_LABEL[type] || type} BENCHMARKS (this owner's own type, n=${g.length}${sq.length ? `, ${Math.min(...sq)}–${Math.max(...sq)} sqft` : ''}): median AED ${(medOf(g.map(t => t.price_aed)) / 1e6).toFixed(2)}M @ ${medOf(g.map(t => t.price_per_sqft))}/sqft | floors 4-15: ${band(4, 15)} / 16-30: ${band(16, 30)} / 31-49: ${band(31, 49)} | pre→post event psf: ${pre.length ? medOf(pre) : '—'}→${post.length ? medOf(post) : '—'}${gm != null ? ` | median gain vs purchase ${gm >= 0 ? '+' : ''}${gm}%` : ''}`;
}
// Deep type arsenal: stack ladder, monthly curve and record deeds for ONE type — never mixed.
function p3TypeExtras(cleanTxs, type, unitStack) {
  try {
    const g = cleanTxs.filter(t => t.bedrooms === type && t.price_per_sqft);
    if (g.length < 3) return '';
    const byStack = {};
    for (const t of g) { const s = String(t.unit_number || '').split('-')[1]; if (s) (byStack[s] = byStack[s] || []).push(t.price_per_sqft); }
    const ladder = Object.entries(byStack).filter(([, v]) => v.length >= 3)
      .map(([s, v]) => ({ s, n: v.length, m: medOf(v) })).sort((a, b) => b.m - a.m);
    const ladderLine = ladder.length ? `${P3_TYPE_LABEL[type]} STACK LADDER (same type only, n≥3): ${ladder.map(x => `-${x.s} ${x.m} (n${x.n})${x.s === unitStack ? ' ← THIS UNIT\'S STACK' : ''}`).join(' | ')}` : '';
    const byM = {};
    for (const t of g) { const m = String(t.transaction_date || '').slice(0, 7); if (m) (byM[m] = byM[m] || []).push(t.price_per_sqft); }
    const monthly = Object.keys(byM).sort().map(m => `${m}: ${byM[m].length} deeds @ ${medOf(byM[m])}`).join(' | ');
    const topPsf = g.slice().sort((a, b) => (b.price_per_sqft || 0) - (a.price_per_sqft || 0))[0];
    const topPrice = g.slice().sort((a, b) => (b.price_aed || 0) - (a.price_aed || 0))[0];
    let bestGain = null, bg = -999;
    for (const t of g) { const mm = /capital gain \+(\d+)%/.exec(t.description || ''); if (mm && +mm[1] > bg) { bg = +mm[1]; bestGain = t; } }
    const flips = g.filter(t => /sold [23] times/i.test(t.description || '')).length;
    return [
      ladderLine,
      `${P3_TYPE_LABEL[type]} MONTHLY CURVE: ${monthly}`,
      `${P3_TYPE_LABEL[type]} RECORDS: top psf ${topPsf.unit_number} @ ${topPsf.price_per_sqft} (${topPsf.transaction_date}) | top price ${topPrice.unit_number} AED ${Number(topPrice.price_aed).toLocaleString('en-US')} (${topPrice.transaction_date})${bestGain ? ` | best gain ${bestGain.unit_number} +${bg}% (${bestGain.transaction_date})` : ''} | ${flips}/${g.length} resold 2+ times`
    ].filter(Boolean).join('\n');
  } catch (_) { return ''; }
}
// Median-price jumps between types — for routing a seller into their next purchase.
function p3UpgradeLadder(cleanTxs) {
  try {
    const medOfType = (ty) => { const v = cleanTxs.filter(t => t.bedrooms === ty && t.price_aed).map(t => t.price_aed); return v.length >= 3 ? medOf(v) : null; };
    const s = medOfType('studio'), b1 = medOfType('1br'), b2 = medOfType('2br');
    const parts = [];
    if (s && b1) parts.push(`studio→1BR ≈ +AED ${Math.round((b1 - s) / 1000)}K`);
    if (b1 && b2) parts.push(`1BR→2BR ≈ +AED ${Math.round((b2 - b1) / 1000)}K`);
    return parts.length ? `UPGRADE LADDER (median jumps — a seller banking their gain is a pre-qualified buyer one rung up): ${parts.join(' | ')}` : '';
  } catch (_) { return ''; }
}
// ── P3 LIVE PORTAL ASK LAYER (PropertyFinder + Bayut survey, 14 Jul 2026) ────
// Asking-price intelligence per unit type. Asks are the COMPETITION, deeds are the
// VALUE TRUTH — injected into the P3 pack clearly labeled, type-pure, never mixed.
const P3_PORTAL_ASK = {
  studio: `STUDIO PORTAL ASK: 36 active PF listings (sample n=20): median ask AED 1.275M @ ~3,004/sqft (range 1.10-1.44M, 2,689-3,398 psf) vs deed median 1.20M @ 2,801 = asks ~+6% over deeds. Bayut 6-mo avg ask 1,345,227 vs 12-mo avg sold 1,211,795 (+11%). Price-cut tags already visible on studio asks (-6%, -11%). Avg rent 80,928/yr (75-89K) = ~6.7% gross yield on deed value. ~2.7 studio deeds/mo vs 36 asks = ~13 months of studio inventory.`,
  '1br': `1BR PORTAL ASK: 140 active PF listings — the tower's biggest overhang (sample n=37 PF+Bayut): median ask AED 1.87M @ ~2,730/sqft (range 1.60-2.25M) vs deed median 1.79M @ 2,598 (post-Feb 2,584) = asks ~+4-6% over deeds. Bayut 6-mo avg ask 1,935,130 vs 12-mo avg sold 1,760,738 (+10%). PF's own trailing 1BR card (avg 1.759M @ 2,599 psf) matches the deed benchmark almost exactly. Avg rent 116,935/yr (85-145K) = ~6.5% gross yield. ~6 1BR deeds/mo vs 140 asks = ~22 months of inventory — deed-level pricing is what actually sells.`,
  '2br': `2BR PORTAL ASK: ~46-57 active PF listings (sample n=19): median ask AED 2.85M @ ~2,910/sqft (range 2.20-3.80M) vs deed median 2.78M @ 2,806 (post-Feb 2,776) = tightest gap of the three, asks ~+2-5% over deeds. Bayut 6-mo avg ask 2,910,283 vs 12-mo avg sold 2,590,826 (+12%, older-window skew). Avg rent 187,899/yr (155-210K) = ~6.8% gross yield, best in the tower. Scarcity type: ~1.6 deeds/mo, and June printed the building records (34-11 @ 3,445 psf).`,
};
const P3_PORTAL_CONTEXT = `PORTAL SUPPLY CONTEXT (all types blended — context only, never a valuation reference): ~160 sale listings live on PropertyFinder / 114 on Bayut vs ~11 deeds transferring per month = roughly a year of standing inventory; 270 rental listings competing at handover. Bayut 12-mo: 146 sold, avg 1.745M. PF building card: 2,678 psf (+2.9% YoY), avg price +15.7% YoY, gross yields 6.25-6.76% by type.`;
const P3_PORTAL_RULES = `ASK-VS-DEED RULES: (1) Deeds are value truth; portal asks are the competition — quote asks ONLY as asking-price intelligence, never as comps. (2) Seller coaching: list at same-type deed median +2-3% max — undercuts the ask median, puts the unit in the cheapest 3 of its type, and captures the few buyers who transact each month; anchoring on the highest ask = joining a 12-22 month queue. (3) Buyer/upgrader coaching: open at the same-type deed median; expect to close 4-7% under ask. (4) Hold coaching: 6.4-6.8% gross on deed values, but 270 competing rentals — price the rent realistically or vacancy eats the yield. (5) Objection "my neighbour is asking 1.4M": an ask is an advertisement — ~150 owners are asking today, ~11 deeds a month transfer; the DLD deed is the price.`;
function p3PortalAskBlock(unitType) {
  const typeLine = unitType ? P3_PORTAL_ASK[unitType] : null;
  return [
    `LIVE PORTAL ASK LAYER (PropertyFinder + Bayut survey, 14 Jul 2026 — ASKING prices, NOT deed values; TYPE DISCIPLINE applies here too):`,
    typeLine || `No portal ask benchmark for this unit type (unknown, or 3BR+/penthouse where the listing sample is too thin) — quote no per-type ask figures; use only the labeled supply context below.`,
    P3_PORTAL_CONTEXT,
    P3_PORTAL_RULES,
  ].join('\n');
}

async function gatherP3MarketPack(svc, landlord, prop) {
  try {
    const projName = landlord.project_name || prop?.project_name || '';
    if (!isPeninsula3Name(projName)) return '';
    if (Date.now() - P3_MARKET_CACHE.at > P3_MARKET_CACHE_MS || !P3_MARKET_CACHE.report) {
      const reports = await svc.entities.MarketReport.filter({ status: 'analyzed' }, '-report_date', 20).catch(() => []);
      const report = (reports || []).find(r => isPeninsula3Name(r.project_name)) || null;
      if (!report) return '';
      const txs = await svc.entities.MarketTransaction.filter({ market_report_id: report.id }, '-transaction_date', 500).catch(() => []);
      P3_MARKET_CACHE = { at: Date.now(), report, txs: Array.isArray(txs) ? txs : [] };
    }
    const { report, txs } = P3_MARKET_CACHE;
    if (!report) return '';
    const clean = txs.filter(t => !t.is_outlier);
    const unit = parseP3UnitRef(landlord.unit_reference || prop?.unit_reference);
    // Stored unit_layout on the Landlord record is authoritative; deed inference is the fallback.
    const LAYOUT_TO_TYPE = { STUDIO: 'studio', '1BHK': '1br', '2BHK': '2br', '3BHK': '3br', '1BR': '1br', '2BR': '2br', '3BR': '3br' };
    const storedType = LAYOUT_TO_TYPE[String(landlord.unit_layout || '').toUpperCase().replace(/\s/g, '')] || null;
    const unitType = storedType || (unit ? inferP3UnitType(unit, clean) : null);
    const typeLabel = unitType ? (P3_TYPE_LABEL[unitType] || unitType) : null;
    let unitBlock = `THIS UNIT: ${landlord.unit_reference || '(no unit reference on file)'} — stack not parseable; use the per-type medians in the report analysis below and never mix types.`;
    if (unit) {
      // TYPE-PURE comps: same stack AND same inferred type; if the stack is thin, widen to the
      // whole tower but stay inside the SAME TYPE — a studio is never priced off a 1BR deed.
      let comps = clean.filter(t => t.price_per_sqft && String(t.unit_number || '').endsWith(`-${unit.stack}`) && (!unitType || t.bedrooms === unitType));
      let scope = `stack -${unit.stack}`;
      if (unitType && comps.length < 3) {
        comps = clean.filter(t => t.price_per_sqft && t.bedrooms === unitType);
        scope = `all ${typeLabel} deeds in the tower`;
      }
      comps = comps.slice().sort((a, b) => String(b.transaction_date || '').localeCompare(String(a.transaction_date || '')));
      const rows = comps.slice(0, 10).map(t => {
        const g = /capital gain ([+-]\d+)%/.exec(t.description || '');
        return `${t.transaction_date} unit ${t.unit_number} ${t.bedrooms || '?'} ${t.area_sqft || '?'}sqft AED ${Number(t.price_aed).toLocaleString('en-US')} @${t.price_per_sqft ?? '?'}/sqft${g ? ` (gain ${g[1]}%)` : ''}`;
      });
      const compPsf = medOf(comps.map(t => t.price_per_sqft));
      const compSqft = medOf(comps.map(t => t.area_sqft));
      const oneType = new Set(comps.map(t => t.bedrooms).filter(Boolean)).size === 1;
      const conf = scope.startsWith('stack') ? (comps.length >= 8 ? 'high' : comps.length >= 3 ? 'medium' : 'low') : 'medium';
      const est = (oneType && comps.length >= 3 && compPsf && compSqft) ? Math.round(compPsf * compSqft) : null;
      unitBlock = [
        `THIS UNIT: ${landlord.unit_reference} → ${unit.podium ? 'podium level' : `floor ${unit.floor ?? '?'}`}, stack -${unit.stack}${typeLabel ? ` | UNIT TYPE: ${typeLabel} (inferred from stack deeds)` : ' | unit type: unknown — verify with the owner before quoting any figure'}`,
        unitType ? p3TypeBench(clean, unitType) : '',
        unitType ? p3TypeExtras(clean, unitType, unit.stack) : '',
        rows.length
          ? `SAME-TYPE DEED COMPS (${scope}, most recent${comps.length > 10 ? `, showing 10 of ${comps.length}` : ''}):\n${rows.map(r => `  ${r}`).join('\n')}`
          : `SAME-TYPE DEED COMPS: none in this report — use the per-type medians in the report analysis below.`,
        (compPsf && est) ? `COMP MEDIAN: ${comps.length} × ${typeLabel || 'same-type'} deeds @ ${compPsf} AED/sqft | INDICATIVE DEED-BASED VALUE for this unit: ~AED ${est.toLocaleString('en-US')} (${conf} confidence)` : '',
        p3UpgradeLadder(clean)
      ].filter(Boolean).join('\n');
    }
    const pre = report.median_price_sqft_pre_event, post = report.median_price_sqft_post_event;
    return `\nPENINSULA 3 MARKET PACK (live DXB Interact deed data, report ${report.report_date} — the ONLY market figures you may use; when quoting a deed, cite unit + date):\nTYPE DISCIPLINE (absolute): studio is studio, 1BR is 1BR, 2BR is 2BR. Quote this owner ONLY deeds and medians of THEIR OWN unit type — never a studio figure to a 1BR owner, never a 1BR figure to a 2BR owner. Another type's figure may appear only to explain the building ladder, explicitly labeled as a different type.\nBUILDING CONTEXT (all types blended — context only, never a valuation reference): median ${report.median_price_sqft ?? '?'} AED/sqft | median price AED ${report.median_price_aed ? (report.median_price_aed / 1e6).toFixed(2) + 'M' : '?'} | ${report.transactions_count ?? '?'} clean deeds in period${pre && post ? ` | momentum: pre-${report.market_event_date || 'event'} ${pre} → post ${post} psf (sellers anchoring on the February peak must be shown their OWN TYPE's curve — price off the last 90 days of same-type deeds)` : ''}\n${unitBlock}\n${p3PortalAskBlock(unitType)}\nREPORT ANALYSIS (sectioned per type — take figures ONLY from this owner's type section): ${String(report.analysis_summary || '').slice(0, 2600)}\nUSE THE PACK: every value-before-price touch (including rule5_day2_value_drop) delivers exactly ONE figure of the owner's OWN type (a same-type deed, their type's gain median, or the yield); reconcile any asking price against the same-type comps AND the live portal ask layer, surfacing the gap explicitly; when the owner cites a portal listing, answer from the LIVE PORTAL ASK LAYER (label it asking-price intelligence, never a comp) and re-anchor to same-type deeds; when the landlord hesitates, frame both doors — exit at same-type deed value vs holding at the report's gross yield minus service charge; NEVER state a market figure that is not in this pack.\n`;
  } catch (_) { return ''; }
}

// ── GENERALIZED PROJECT MARKET PACK ──────────────────────────────────────────
// Extends the P3 market pack to any project with an analyzed MarketReport matched by
// normalized project name. P3 delegates to gatherP3MarketPack (behavior unchanged).
// P4 (and other projects) get their own pack: unit-ref parsing for stack/floor,
// type-pure deed comps when transactions exist, or a portal asking-price intelligence
// pack when the report has no transactions. Never throws — degrades to '' on any error.

// Normalize a project name for matching: lowercase, word-numbers → digits, strip separators.
// "Peninsula 4" / "Peninsula Four" / "P4" all normalize to something containing "peninsula4" / "p4".
function normalizeProjectName(name) {
  let s = String(name || '').toLowerCase().trim();
  s = s.replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5');
  s = s.replace(/[\s\-_\.]+/g, '');
  return s;
}

// Match a landlord's project name to a report's project name by normalized substring
// (either direction, to handle "Peninsula 4" vs "Peninsula 4 Tower").
function matchProjectName(landlordProject, reportProject) {
  const a = normalizeProjectName(landlordProject);
  const b = normalizeProjectName(reportProject);
  if (!a || !b) return false;
  if (a === b) return true;
  // Peninsula 5 family (tower / D1 / D2): EXACT only — "Peninsula 5" is a token-subset of
  // "Peninsula 5 - D1" but they are distinct sub-projects that must never cross-match.
  const p5 = (s) => s === 'peninsula5' || s === 'peninsula5d1' || s === 'peninsula5d2';
  if (p5(a) || p5(b)) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // Token-subset: handles naming variants where neither normalized form is a substring of the
  // other, e.g. project "The Edge A" ↔ report "The Edge Tower A" (both share edge + the "A"
  // tower id; "Tower" is the extra word). Generic stopwords dropped; tower ids (a/b/d1) kept.
  const STOP = new Set(['the', 'of', 'at', 'in', 'on', 'and']);
  const toks = (s) => String(s || '').toLowerCase().replace(/\bthree\b/g, '3').replace(/\bfour\b/g, '4').replace(/\bfive\b/g, '5').split(/[\s\-_\.]+/).map(t => t.trim()).filter(t => t && !STOP.has(t));
  const ta = toks(landlordProject), tb = toks(reportProject);
  if (ta.length && tb.length) {
    const subset = (x, y) => x.every(t => y.includes(t));
    if (subset(ta, tb) || subset(tb, ta)) return true;
  }
  return false;
}

const isPeninsula4Name = (name) => {
  const s = normalizeProjectName(name);
  return s.includes('peninsula4') || s === 'p4';
};

// P4 unit refs: "B209", "A3110", "AP204", "BP203".
// Leading letter(s) = tower/podium prefix (A, B, AP, BP), last 2 digits = stack,
// remaining middle digits = floor. Strips an optional "P4-" prefix if present.
function parseP4UnitRef(ref) {
  let raw = String(ref || '').toUpperCase().replace(/\s+/g, '');
  raw = raw.replace(/^P4-?/, '');
  const m = raw.match(/^([A-Z]{1,2})(\d+)$/);
  if (!m) return null;
  const digits = m[2];
  if (digits.length < 3) return null; // need at least 1 floor digit + 2 stack digits
  const stack = digits.slice(-2);
  const floorStr = digits.slice(0, -2);
  const floor = floorStr ? parseInt(floorStr, 10) : null;
  const podium = m[1] === 'AP' || m[1] === 'BP';
  return { floor, stack, podium, prefix: m[1] };
}

// Portal asking-price intelligence pack — used when the matched report has NO transactions
// (e.g. a portal_listings report). Injects analysis_summary + price_by_type + rental_yield_pct
// + active_listings_count, clearly labeled as asking-price (not deed) intelligence.
function buildPortalIntelligencePack(report, projName) {
  try {
    const projLabel = String(projName || '').trim().toUpperCase() || 'PROJECT';
    let priceByTypeStr = '(not available)';
    const pbt = report.price_by_type;
    if (pbt && typeof pbt === 'object') {
      priceByTypeStr = Object.entries(pbt).map(([k, v]) => {
        const val = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v);
        return `${k}: ${val}`;
      }).join(' | ');
    }
    return `\n${projLabel} PORTAL ASKING-PRICE INTELLIGENCE (portal listings report dated ${report.report_date} — these are ASKING prices from active listings, NOT transacted deed values; always label them as asking-price intelligence, never as sold comps):\nACTIVE LISTINGS: ${report.active_listings_count ?? '?'}\nRENTAL YIELD: ${report.rental_yield_pct ?? '?'}%\nPRICE BY TYPE (asking ranges): ${priceByTypeStr}\nANALYSIS SUMMARY: ${String(report.analysis_summary || '').slice(0, 2600)}\nUSE THE PACK: these are asking prices, not sold deeds — frame them as market positioning intelligence. When reconciling the landlord's asking price, reference comparable active listings. Never present portal asking prices as transacted values. Every value-before-price touch may deliver exactly ONE figure from this pack.\n`;
  } catch (_) { return ''; }
}

// Transaction-based deed comps pack — used when the matched report HAS transactions.
// Adapts the P3 type-pure comps/stack-ladder logic for any project, using P4 unit-ref
// parsing when the project is Peninsula 4. When unit is null (unparseable ref), degrades
// to per-type medians from the report analysis.
function buildTransactionPack(report, cleanTxs, landlord, prop, unit, projName, isP4) {
  try {
    const LAYOUT_TO_TYPE = { STUDIO: 'studio', '1BHK': '1br', '2BHK': '2br', '3BHK': '3br', '4BHK': '4plus', '5BHK': '4plus', '1BR': '1br', '2BR': '2br', '3BR': '3br', '4BR': '4plus', '5BR': '4plus', PENTHOUSE: '4plus', DUPLEX: '4plus', VILLA: '4plus', '4BHKVILLA': '4plus', '5BHKVILLA': '4plus' };
    const storedType = LAYOUT_TO_TYPE[String(landlord.unit_layout || '').toUpperCase().replace(/\s/g, '')] || null;
    const typeLabel = storedType ? (P3_TYPE_LABEL[storedType] || storedType) : null;

    // Build comps: same stack AND same type (if known); widen to whole tower if stack is thin.
    let comps = [];
    let scope = '';
    if (unit && unit.stack) {
      if (isP4) {
        comps = cleanTxs.filter(t => {
          if (!t.price_per_sqft) return false;
          const tUnit = parseP4UnitRef(t.unit_number);
          return tUnit && tUnit.stack === unit.stack && (!storedType || t.bedrooms === storedType);
        });
        scope = `stack ${unit.stack}`;
      } else {
        comps = cleanTxs.filter(t => t.price_per_sqft && String(t.unit_number || '').endsWith(`-${unit.stack}`) && (!storedType || t.bedrooms === storedType));
        scope = `stack -${unit.stack}`;
      }
    }
    if (storedType && comps.length < 3) {
      comps = cleanTxs.filter(t => t.price_per_sqft && t.bedrooms === storedType);
      scope = `all ${typeLabel} deeds`;
    }
    // Similarity ranking: this owner's OWN past deed first (★), then nearest size within the
    // same type, newest as tiebreak — the closer the sold example, the harder it lands.
    const basisSq = /([\d,]{3,7})\s*sqft/.exec(String(prop?.ai_valuation_basis || ''));
    const unitSq = basisSq ? parseInt(basisSq[1].replace(/,/g, ''), 10) : null;
    const nref = (s) => String(s || '').toUpperCase().replace(/\s/g, '');
    const selfRef = nref(landlord.unit_reference || prop?.unit_reference);
    const simKey = (t) => ((selfRef && nref(t.unit_number) === selfRef) ? -1e9 : 0) + ((unitSq && t.area_sqft) ? Math.abs(t.area_sqft - unitSq) : 5e5);
    comps = comps.slice().sort((a, b) => (simKey(a) - simKey(b)) || String(b.transaction_date || '').localeCompare(String(a.transaction_date || '')));

    const rows = comps.slice(0, 12).map(t => {
      const g = /capital gain ([+-]\d+)%/.exec(t.description || '');
      const isSelf = selfRef && nref(t.unit_number) === selfRef;
      return `${t.transaction_date} unit ${t.unit_number} ${t.bedrooms || '?'} ${t.area_sqft || '?'}sqft AED ${Number(t.price_aed).toLocaleString('en-US')} @${t.price_per_sqft ?? '?'}/sqft${g ? ` (gain ${g[1]}%)` : ''}${isSelf ? " ★ THIS OWNER'S OWN UNIT — their entry price" : ''}`;
    });
    const compPsf = medOf(comps.map(t => t.price_per_sqft));
    const compSqft = medOf(comps.map(t => t.area_sqft));
    const oneType = new Set(comps.map(t => t.bedrooms).filter(Boolean)).size === 1;
    const conf = scope.startsWith('stack') ? (comps.length >= 8 ? 'high' : comps.length >= 3 ? 'medium' : 'low') : 'medium';
    const est = (oneType && comps.length >= 3 && compPsf && compSqft) ? Math.round(compPsf * compSqft) : null;

    const compsListBlock = rows.length
      ? `SAME-TYPE SOLD EXAMPLES (${scope}, ranked closest to this unit first${comps.length > 12 ? `, showing 12 of ${comps.length}` : ''} — quote them to the owner with unit + date):\n${rows.map(r => `  ${r}`).join('\n')}`
      : `SAME-TYPE SOLD EXAMPLES: none in this report — use the per-type medians in the report analysis below.`;
    const medianLine = (compPsf && est) ? `COMP MEDIAN: ${comps.length} × ${typeLabel || 'same-type'} deeds @ ${compPsf} AED/sqft | INDICATIVE DEED-BASED VALUE for this unit: ~AED ${est.toLocaleString('en-US')} (${conf} confidence)` : '';
    let unitBlock = [
      `THIS UNIT: ${landlord.unit_reference || '(no unit reference on file)'}${typeLabel ? ` | UNIT TYPE: ${typeLabel}` : ''} — quote ONLY same-type sold examples; never mix types.`,
      compsListBlock,
      medianLine,
    ].filter(Boolean).join('\n');
    if (unit) {
      unitBlock = [
        `THIS UNIT: ${landlord.unit_reference} → ${unit.podium ? 'podium level' : `floor ${unit.floor ?? '?'}`}, stack ${unit.stack}${typeLabel ? ` | UNIT TYPE: ${typeLabel}` : ' | unit type: unknown — verify with the owner before quoting any figure'}`,
        compsListBlock,
        medianLine,
      ].filter(Boolean).join('\n');
    }

    const projLabel = String(projName || '').trim().toUpperCase() || 'PROJECT';
    const pre = report.median_price_sqft_pre_event, post = report.median_price_sqft_post_event;
    return `\n${projLabel} MARKET PACK (live deed data, report ${report.report_date} — the ONLY market figures you may use; when quoting a deed, cite unit + date):\nTYPE DISCIPLINE (absolute): studio is studio, 1BR is 1BR, 2BR is 2BR. Quote this owner ONLY deeds and medians of THEIR OWN unit type — never mix types.\nBUILDING CONTEXT (all types blended — context only, never a valuation reference): median ${report.median_price_sqft ?? '?'} AED/sqft | median price AED ${report.median_price_aed ? (report.median_price_aed / 1e6).toFixed(2) + 'M' : '?'} | ${report.transactions_count ?? '?'} clean deeds in period${pre && post ? ` | momentum: pre-${report.market_event_date || 'event'} ${pre} → post ${post} psf` : ''}\n${unitBlock}\nREPORT ANALYSIS (sectioned per type — take figures ONLY from this owner's type section): ${String(report.analysis_summary || '').slice(0, 2600)}\nUSE THE PACK: every value-before-price touch delivers exactly ONE figure of the owner's OWN type (a same-type deed, their type's gain median, or the yield); reconcile any asking price against the same-type comps and surface the gap explicitly; NEVER state a market figure that is not in this pack.\n`;
  } catch (_) { return ''; }
}

// ── PENINSULA 5 FAMILY MARKET PACK (tower / D1 / D2) ───────────────────────────
// Exact normalized project match (never substring, so the tower never cross-matches the
// D1/D2 duplex reports). Injects BOTH the dxb_interact deed analysis AND the portal_listings
// asking-price intelligence for the landlord's exact project, plus type-pure deed comps.
// Type discipline is absolute: never mix the tower with D1/D2 duplexes, never mix types.
const isPeninsula5Family = (name) => {
  const s = normalizeProjectName(name);
  return s === 'peninsula5' || s === 'peninsula5d1' || s === 'peninsula5d2';
};
// P5 unit refs: "P5-102" → floor 1, stack "02"; "P5-2206" → floor 22, stack "06".
function parseP5UnitRef(ref) {
  const m = String(ref || '').toUpperCase().replace(/\s+/g, '').match(/^P5-?(\d{2,4})$/);
  if (!m) return null;
  const digits = m[1];
  if (digits.length < 3) return null; // need at least 1 floor digit + 2 stack digits
  const stack = digits.slice(-2);
  const floorStr = digits.slice(0, -2);
  return { floor: floorStr ? parseInt(floorStr, 10) : null, stack };
}
async function gatherPeninsula5MarketPack(svc, landlord, prop) {
  try {
    const projName = landlord.project_name || prop?.project_name || '';
    if (!isPeninsula5Family(projName)) return '';
    const key = normalizeProjectName(projName);
    // Match reports by EXACT normalized project equality (both sources) — never substring.
    const reports = await svc.entities.MarketReport.filter({ status: 'analyzed' }, '-report_date', 40).catch(() => []);
    const exactReports = (reports || []).filter((r) => normalizeProjectName(r.project_name) === key);
    const dxbReport = exactReports.find((r) => r.source === 'dxb_interact') || null;
    const portalReport = exactReports.find((r) => r.source === 'portal_listings') || null;
    if (!dxbReport && !portalReport) return '';
    let cleanTxs = [];
    if (dxbReport) {
      const txs = await svc.entities.MarketTransaction.filter({ market_report_id: dxbReport.id }, '-transaction_date', 500).catch(() => []);
      cleanTxs = (Array.isArray(txs) ? txs : []).filter((t) => !t.is_outlier);
    }
    const P5_LAYOUT_TO_TYPE = { STUDIO: 'studio', '1BHK': '1br', '2BHK': '2br', '3BHK': '3br', '4BHK': '4plus', PENTHOUSE: '4plus', DUPLEX: '4plus' };
    const P5_TYPE_LABEL = { studio: 'Studio', '1br': '1BR', '2br': '2BR', '3br': '3BR', '4plus': '4+BR' };
    const storedType = P5_LAYOUT_TO_TYPE[String(landlord.unit_layout || '').toUpperCase().replace(/\s/g, '')] || null;
    const typeLabel = storedType ? (P5_TYPE_LABEL[storedType] || storedType) : null;
    const unit = parseP5UnitRef(landlord.unit_reference || prop?.unit_reference);
    const p5Digits = (s) => String(s || '').replace(/[^0-9]/g, '');
    // Type-pure comps: same stack AND same type; widen to all same-type deeds in this project
    // when the stack is thin — never mix types, never mix the tower with D1/D2.
    let comps = [];
    let scope = '';
    if (unit && unit.stack) {
      comps = cleanTxs.filter((t) => t.price_per_sqft && p5Digits(t.unit_number).slice(-2) === unit.stack && (!storedType || t.bedrooms === storedType));
      scope = `stack -${unit.stack}`;
    }
    if (storedType && comps.length < 3) {
      comps = cleanTxs.filter((t) => t.price_per_sqft && t.bedrooms === storedType);
      scope = `all ${typeLabel} deeds in ${projName}`;
    }
    comps = comps.slice().sort((a, b) => String(b.transaction_date || '').localeCompare(String(a.transaction_date || '')));
    const rows = comps.slice(0, 10).map((t) => {
      const g = /capital gain ([+-]\d+)%/.exec(t.description || '');
      return `${t.transaction_date} unit ${t.unit_number} ${t.bedrooms || '?'} ${t.area_sqft || '?'}sqft AED ${Number(t.price_aed).toLocaleString('en-US')} @${t.price_per_sqft ?? '?'}/sqft${g ? ` (gain ${g[1]}%)` : ''}`;
    });
    const compPsf = medOf(comps.map((t) => t.price_per_sqft));
    const compSqft = medOf(comps.map((t) => t.area_sqft));
    const oneType = new Set(comps.map((t) => t.bedrooms).filter(Boolean)).size === 1;
    const conf = scope.startsWith('stack') ? (comps.length >= 8 ? 'high' : comps.length >= 3 ? 'medium' : 'low') : (comps.length >= 3 ? 'medium' : 'low');
    const est = (oneType && comps.length >= 3 && compPsf && compSqft) ? Math.round(compPsf * compSqft) : null;
    let unitBlock = `THIS UNIT: ${landlord.unit_reference || '(no unit reference)'} — use the per-type medians below; never mix types.`;
    if (unit) {
      unitBlock = [
        `THIS UNIT: ${landlord.unit_reference} → floor ${unit.floor ?? '?'}, stack -${unit.stack}${typeLabel ? ` | UNIT TYPE: ${typeLabel}` : ' | unit type: unknown — verify with the owner before quoting any figure'}`,
        rows.length ? `SAME-TYPE DEED COMPS (${scope}, most recent${comps.length > 10 ? `, showing 10 of ${comps.length}` : ''}):\n${rows.map((r) => '  ' + r).join('\n')}` : `SAME-TYPE DEED COMPS: none in this report — use the per-type medians in the analysis below.`,
        (compPsf && est) ? `COMP MEDIAN: ${comps.length} × ${typeLabel || 'same-type'} deeds @ ${compPsf} AED/sqft | INDICATIVE DEED-BASED VALUE for this unit: ~AED ${est.toLocaleString('en-US')} (${conf} confidence)` : '',
      ].filter(Boolean).join('\n');
    }
    const projLabel = String(projName || '').trim().toUpperCase() || 'PROJECT';
    const dxbBlock = dxbReport ? `\n${projLabel} DEED MARKET (DXB Interact report ${dxbReport.report_date} — transacted deed values; cite unit + date): median ${dxbReport.median_price_sqft ?? '?'} AED/sqft | ${dxbReport.transactions_count ?? cleanTxs.length} clean deeds\n${unitBlock}\nDXB ANALYSIS (take figures ONLY from this owner's type section): ${String(dxbReport.analysis_summary || '').slice(0, 2600)}` : '';
    const portalBlock = portalReport ? `\n${projLabel} PORTAL ASKING-PRICE INTELLIGENCE (portal listings report ${portalReport.report_date} — ASKING prices from active listings, NOT transacted deeds; always label as asking-price intelligence, never as sold comps):\nANALYSIS SUMMARY: ${String(portalReport.analysis_summary || '').slice(0, 2600)}` : '';
    return `\n${projLabel} MARKET PACK (Peninsula 5 family — TYPE DISCIPLINE absolute: studio is studio, 1BR is 1BR, 2BR is 2BR, 3BR is 3BR; never mix the tower with the D1/D2 duplexes; quote this owner ONLY deeds/medians of THEIR OWN unit type):${dxbBlock}${portalBlock}\nUSE THE PACK: every value-before-price touch delivers exactly ONE figure of the owner's OWN type (a same-type deed with unit+date, the deed median, or a portal ask); reconcile any asking price against the same-type deed comps AND the portal asking-price intelligence, surfacing the gap explicitly; when the owner cites a portal listing, answer from the PORTAL ASKING-PRICE INTELLIGENCE block (label it asking-price, never a comp) and re-anchor to same-type deeds; NEVER state a market figure that is not in this pack.\n`;
  } catch (_) { return ''; }
}

// Generalized entry point — replaces gatherP3MarketPack at the call site. P3 delegates
// to the original function (behavior unchanged); all other projects get a project-aware pack.
async function gatherProjectMarketPack(svc, landlord, prop) {
  try {
    const projName = landlord.project_name || prop?.project_name || '';
    if (!projName) return '';

    // Peninsula 3 — delegate to the original function (behavior unchanged)
    if (isPeninsula3Name(projName)) {
      return await gatherP3MarketPack(svc, landlord, prop);
    }

    // Peninsula 5 family (tower / D1 / D2) — exact normalized project match (never substring,
    // so the tower never cross-matches the D1/D2 duplex reports). Injects BOTH the dxb_interact
    // deed analysis AND the portal_listings asking-price intelligence for the landlord's project.
    if (isPeninsula5Family(projName)) {
      return await gatherPeninsula5MarketPack(svc, landlord, prop);
    }

    // Match the latest analyzed MarketReport by normalized project name
    const reports = await svc.entities.MarketReport.filter({ status: 'analyzed' }, '-report_date', 20).catch(() => []);
    const report = (reports || []).find(r => matchProjectName(projName, r.project_name));
    if (!report) return '';

    const txs = await svc.entities.MarketTransaction.filter({ market_report_id: report.id }, '-transaction_date', 500).catch(() => []);
    const clean = (Array.isArray(txs) ? txs : []).filter(t => !t.is_outlier);

    // No transactions → portal asking-price intelligence pack
    if (!clean.length) {
      return buildPortalIntelligencePack(report, projName);
    }

    // Transactions exist → type-pure deed comps / stack-ladder pack
    const isP4 = isPeninsula4Name(projName);
    const unit = isP4 ? parseP4UnitRef(landlord.unit_reference || prop?.unit_reference) : null;
    return buildTransactionPack(report, clean, landlord, prop, unit, projName, isP4);
  } catch (_) { return ''; }
}

// ── PROJECT INTELLIGENCE SOURCES PACK ──────────────────────────────────────
// Curated live-source intelligence (ProjectIntelSource entity): portal insights pages,
// official brand sites, live feeds. Matched to the landlord's project by normalized name,
// module-cached 10 min. Complements the MARKET PACK with brand/lifestyle/portal facts —
// never replaces deed figures. Never throws — degrades to '' on any error.
let INTEL_SRC_CACHE = { at: 0, rows: [] };
const INTEL_SRC_CACHE_MS = 10 * 60 * 1000;
async function gatherProjectIntelPack(svc, landlord, prop) {
  try {
    const projName = landlord.project_name || prop?.project_name || '';
    if (!projName) return '';
    if (Date.now() - INTEL_SRC_CACHE.at > INTEL_SRC_CACHE_MS) {
      const rows = await svc.entities.ProjectIntelSource.filter({ auto_inject: true }, '-updated_date', 200).catch(() => []);
      INTEL_SRC_CACHE = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
    }
    const sources = INTEL_SRC_CACHE.rows
      .filter(s => matchProjectName(projName, s.project_name))
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
    if (!sources.length) return '';
    const TYPE_LABEL = { portal_insights: 'PORTAL INSIGHTS', brand_official: 'OFFICIAL BRAND', portal_transactions: 'LIVE TRANSACTIONS FEED', portal_listings: 'LIVE LISTINGS', dld_report: 'DLD REPORT', other: 'SOURCE' };
    const blocks = sources.map(s => {
      const facts = Array.isArray(s.key_facts) && s.key_facts.length ? `\n  KEY FACTS: ${s.key_facts.map(f => `• ${f}`).join(' ')}` : '';
      const talk = Array.isArray(s.talking_points) && s.talking_points.length ? `\n  SALES ANGLES: ${s.talking_points.map(t => `• ${t}`).join(' ')}` : '';
      const sum = s.summary ? `\n  ${String(s.summary).slice(0, 1400)}` : '';
      return `[${TYPE_LABEL[s.source_type] || 'SOURCE'}] ${s.source_name}${s.last_checked ? ` (checked ${s.last_checked})` : ''}${facts}${talk}${sum}`;
    }).join('\n');
    return `\nPROJECT INTELLIGENCE SOURCES (curated brand + portal intel for ${String(projName).toUpperCase()} — complements the MARKET PACK; deed figures always outrank these):\n${blocks}\nUSE THE INTEL: weave AT MOST ONE brand/lifestyle/portal fact per touch as the value hook next to the market figure — resort-open status, owner privileges, residence-count scarcity, a first-rental/yield fact, or a location fact matched to the owner's archetype; a FIRST RENTAL fact reframes hold-vs-sell with a real income number; brand facts defend premium pricing against neighbouring-tower comparisons; NEVER invent a fact not in this block, and if the owner asks something not covered here, the draft says the agent will confirm from the official source.\n`;
  } catch (_) { return ''; }
}

// ── PROJECT BRIEF PACK ──────────────────────────────────────────────────────────
// The Project entity's `notes` field is the curated project intelligence brief — market
// positioning, pricing anchors, objection handlers, and the mandate-winning playbook for
// this project. Matched to the landlord's project by normalized name (substring either
// direction, e.g. "The Edge Tower A" matches "The Edge A"). Module-cached 10 min. The
// MarketReport.analysis_summary is already injected via gatherProjectMarketPack above;
// this adds the operator-curated Project brief on top of it. Never throws — degrades to ''.
let PROJECT_BRIEF_CACHE = { at: 0, rows: [] };
const PROJECT_BRIEF_CACHE_MS = 10 * 60 * 1000;
async function gatherProjectBriefPack(svc, landlord, prop) {
  try {
    const projName = landlord.project_name || prop?.project_name || '';
    if (!projName) return '';
    if (Date.now() - PROJECT_BRIEF_CACHE.at > PROJECT_BRIEF_CACHE_MS) {
      const rows = await svc.entities.Project.list('-updated_date', 500).catch(() => []);
      PROJECT_BRIEF_CACHE = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
    }
    const matches = PROJECT_BRIEF_CACHE.rows.filter(p => p && p.notes && matchProjectName(projName, p.name));
    if (!matches.length) return '';
    const exact = matches.find(p => normalizeProjectName(p.name) === normalizeProjectName(projName));
    const proj = exact || matches[0];
    return `\nPROJECT INTELLIGENCE BRIEF (${String(proj.name || projName).toUpperCase()} — the curated project brief: market positioning, pricing anchors, objection handlers, and the mandate-winning playbook. Use it to shape the trust/urgency scores, the deal thesis, the next-best-action, and every suggested message; it complements the MARKET PACK and never overrides real deed figures):\n${String(proj.notes).slice(0, 4000)}\n`;
  } catch (_) { return ''; }
}

// ── OWNER PORTFOLIO PACK ───────────────────────────────────────────────────────
// Fetches the owner's FULL unit portfolio from the synced OwnerPortfolioUnit registry
// (the "search history" / owner-registry data) so the brain is aware of EVERY unit the
// owner holds — not just the single CRM record it is running on. Used to (a) widen the
// AI's situational awareness across the whole portfolio, and (b) prompt the AI to
// suggest asking the owner about those OTHER units on the next call. Never throws —
// degrades to '' (behavior unchanged) on any error or no match.
const OP_clean = (v) => (v == null ? '' : String(v).trim());
const OP_phoneKey = (s) => OP_clean(s).replace(/[^0-9]/g, '');
const OP_last9 = (d) => (d ? d.slice(-9) : '');
const OP_escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const OP_digits = (s) => OP_clean(s).replace(/\D/g, '');
const OP_normUnit = (s) => OP_clean(s).toUpperCase().replace(/[\s\-_]/g, '');
const OP_normProj = (s) => OP_clean(s).toUpperCase();

async function gatherOwnerPortfolio(svc, landlord) {
  try {
    const name = OP_clean(landlord.full_name_en || landlord.full_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`);
    const emails = [
      ...(landlord.email ? [String(landlord.email).trim().toLowerCase()] : []),
      ...(Array.isArray(landlord.additional_emails) ? landlord.additional_emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : []),
    ];
    const phones = [
      ...(landlord.phone ? [landlord.phone] : []),
      ...(landlord.whatsapp ? [landlord.whatsapp] : []),
      ...(Array.isArray(landlord.additional_phones) ? landlord.additional_phones : []),
    ];
    const phonesLast9 = phones.map((p) => OP_last9(OP_phoneKey(p))).filter((p) => p.length >= 7);
    if (!name && !emails.length && !phonesLast9.length) return '';

    const matchedCodes = new Set();
    // Match by every known email (case-insensitive exact)
    for (const em of [...new Set(emails)]) {
      const rows = await svc.entities.OwnerPortfolioUnit.filter({ owner_email: { $regex: '^' + OP_escapeRegex(em) + '$', $options: 'i' } }, '-created_date', 500).catch(() => []);
      for (const u of (Array.isArray(rows) ? rows : [])) if (u.owner_code) matchedCodes.add(u.owner_code);
    }
    // Match by every known phone (last 9 digits)
    for (const p9 of [...new Set(phonesLast9)]) {
      const rows = await svc.entities.OwnerPortfolioUnit.filter({ owner_phone: { $regex: p9 } }, '-created_date', 500).catch(() => []);
      for (const u of (Array.isArray(rows) ? rows : [])) if (u.owner_code) matchedCodes.add(u.owner_code);
    }
    // Match by name tokens (require ALL CRM tokens present in the portfolio name)
    if (name) {
      const tokens = name.toLowerCase().split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 1);
      if (tokens.length) {
        const qTok = tokens.slice().sort((a, b) => b.length - a.length)[0];
        const rows = await svc.entities.OwnerPortfolioUnit.filter({ owner_name: { $regex: OP_escapeRegex(qTok), $options: 'i' } }, '-created_date', 500).catch(() => []);
        for (const u of (Array.isArray(rows) ? rows : [])) {
          const un = OP_clean(u.owner_name).toLowerCase();
          if (un && tokens.every((t) => un.includes(t))) if (u.owner_code) matchedCodes.add(u.owner_code);
        }
      }
    }
    if (!matchedCodes.size) return '';

    const codes = Array.from(matchedCodes);
    const page = await svc.entities.OwnerPortfolioUnit.filter({ owner_code: { $in: codes } }, '-created_date', 1000).catch(() => []);
    const allUnits = Array.isArray(page) ? page : (page.items || []);
    if (!allUnits.length) return '';

    const curUnitNorm = OP_normUnit(landlord.unit_reference || '');
    const curUnitDigits = OP_digits(landlord.unit_reference || '');
    const curProjNorm = OP_normProj(landlord.project_name || '');

    const units = allUnits.map((u) => ({
      project: OP_clean(u.property_name),
      unit: OP_clean(u.unit_code),
      area: OP_clean(u.area),
      spa_status: OP_clean(u.spa_status),
      owner_status: OP_clean(u.owner_status),
      sales_agent: OP_clean(u.sales_agent),
    }));

    // Identify the unit this CRM record is for (by normalized unit, then digit-match on
    // the same project) so we can tag it and isolate the owner's OTHER units.
    let current = null;
    if (curUnitNorm) {
      current = units.find((u) => OP_normUnit(u.unit) === curUnitNorm);
      if (!current && curUnitDigits.length >= 3) {
        current = units.find((u) => OP_digits(u.unit) === curUnitDigits && OP_normProj(u.project) === curProjNorm);
      }
    }
    const others = current ? units.filter((u) => u !== current) : units.slice();
    const projects = [...new Set(units.map((u) => u.project).filter(Boolean))];
    const otherProjects = [...new Set(others.map((u) => u.project).filter(Boolean))];

    const lines = units.map((u) => {
      const isCur = u === current;
      return `  - ${u.project || '?'} · ${u.unit || '?'}${u.area ? ` (${u.area})` : ''}${u.spa_status ? ` · SPA ${u.spa_status}` : ''}${u.owner_status ? ` · ${u.owner_status}` : ''}${u.sales_agent ? ` · registry agent: ${u.sales_agent}` : ''}${isCur ? '  ← THIS CRM RECORD' : ''}`;
    }).join('\n');

    return `\nOWNER PORTFOLIO (from the synced owner registry — every unit this person holds, NOT just this CRM record):
The owner holds ${units.length} unit(s) across ${projects.length} project(s): ${projects.join(', ') || '?'}.
ALL UNITS:
${lines}
${others.length > 0 ? `OTHER UNITS (not the one this CRM record is for) — ${others.length} unit(s) across: ${otherProjects.join(', ') || '?'}.
These are mandate-widening opportunities and high-value call intelligence. SUGGEST ASKING THE OWNER about these other units on the next call (e.g. whether they also want to sell or rent any of them, or whether they'd like you to manage the whole portfolio). Treat the owner as a portfolio client, not a single-unit lead — weave this into the rolling summary, the coaching line, the next-best-action, and at least one suggested message.` : ''}`;
  } catch (_) { return ''; }
}

// ── PLAYBOOK PRIORS + CALIBRATION PACK (BRAIN V4 P3 LEARN, Phase 2) ──────────────
// Measured outcomes from the brokerage's own outreach ledger (PlaybookPrior, compiled nightly
// by compileBrainPriors) + the brain's own calibration report (BrainCalibration). Injected into
// both tiers so channel/angle/hour choices honor real reply data — and the model corrects its
// own win-probability bias. Module-cached 10 min. Never throws — degrades to ''.

// nationality bucketing — KEEP IN SYNC across compileBrainPriors, landlordOrchestrator,
// forgeApproachDrafts (V4 sync group #3). Coarse buckets so priors accrue usable n.
function natBucket(nationality) {
  const s = String(nationality || '').toLowerCase();
  if (!s) return 'unknown';
  if (/(russia|belarus|ukrain|kazakh|uzbek|azerbaij|armeni|georgi|kyrgyz|tajik|turkmen|moldov)/.test(s)) return 'russian_cis';
  if (/(emirat|saudi|kuwait|qatar|bahrain|oman)/.test(s)) return 'gcc';
  if (/(india|pakistan|banglade|sri lanka|nepal)/.test(s)) return 'south_asia';
  if (/(china|chinese|hong kong|taiwan|japan|korea|singapor|vietnam|thai|malays|indones|philipp)/.test(s)) return 'east_asia';
  if (/(british|united kingdom|uk\b|english|irish|french|german|italian|spanish|dutch|belgi|swiss|austri|swed|norw|danish|finn|portug|greek|polish|czech|romanian|hungar)/.test(s)) return 'western_europe';
  if (/(american|united states|usa|canad|mexic|brazil|argentin|chile|colomb)/.test(s)) return 'americas';
  if (/(egypt|leban|jordan|syria|iraq|iran|turk|morocc|tunis|alger|libya)/.test(s)) return 'mena';
  if (/(nigeri|kenya|south africa|ghana|ethiop)/.test(s)) return 'africa';
  return 'other';
}
const priorNormProj = (s) => String(s || '').toLowerCase().trim().replace(/[\s\-_\.]+/g, ' ');

let PRIORS_CACHE = { at: 0, rows: [] };
let CALIBRATION_CACHE = { at: 0, line: '' };
const PRIORS_CACHE_MS = 10 * 60 * 1000;

async function gatherPlaybookPriors(svc, landlord) {
  try {
    if (Date.now() - PRIORS_CACHE.at > PRIORS_CACHE_MS) {
      const rows = await svc.entities.PlaybookPrior.filter({}, '-sample_size', 500).catch(() => []);
      PRIORS_CACHE = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
    }
    if (!PRIORS_CACHE.rows.length) return '';
    const arch = landlord.landlord_archetype || '';
    const nb = natBucket(landlord.nationality);
    const proj = priorNormProj(landlord.project_name || '');
    // Relevance: every non-'any' dim must match this landlord; specificity = matched dims.
    const relevant = PRIORS_CACHE.rows
      .map((p) => {
        let spec = 0;
        if (p.landlord_archetype !== 'any') { if (p.landlord_archetype !== arch) return null; spec++; }
        if (p.nationality_bucket !== 'any') { if (p.nationality_bucket !== nb) return null; spec++; }
        if (p.project_name !== 'any') { if (p.project_name !== proj) return null; spec++; }
        if (p.angle_used !== 'any') spec += 0.5;
        return { p, spec };
      })
      .filter(Boolean)
      .sort((a, b) => (b.spec - a.spec) || ((b.p.sample_size || 0) - (a.p.sample_size || 0)))
      .slice(0, 6);
    if (!relevant.length) return '';
    const lines = relevant.map(({ p }) => {
      const dims = [
        p.channel !== 'any' ? p.channel : null,
        p.angle_used !== 'any' ? `angle:${p.angle_used}` : null,
        p.landlord_archetype !== 'any' ? p.landlord_archetype : null,
        p.nationality_bucket !== 'any' ? p.nationality_bucket : null,
        p.project_name !== 'any' ? p.project_name : null,
      ].filter(Boolean).join(' × ');
      const rr = (typeof p.reply_rate === 'number') ? `${Math.round(p.reply_rate * 100)}% reply rate` : 'reply rate n/a';
      const lat = (typeof p.median_latency_hours === 'number') ? `, median reply ${p.median_latency_hours}h` : '';
      const hr = (typeof p.best_hour_dubai === 'number') ? `, best send hour ${String(p.best_hour_dubai).padStart(2, '0')}:00 Dubai` : '';
      const md = p.mandates ? `, ${p.mandates} mandate(s) in cohort` : '';
      return `- [${dims}] ${rr} (n=${p.sample_size}${lat}${hr}${md})${p.low_confidence ? ' — LOW CONFIDENCE (n<8), cite as tentative' : ''}`;
    });
    return `\nPLAYBOOK PRIORS (measured outcomes from THIS brokerage's own outreach ledger — most-specific first):\n${lines.join('\n')}\nUSE THE PRIORS: prefer the channel/angle/hour combinations with the strongest measured reply rates for this cohort; when you deviate, say why in the reasoning. Cite a prior when it shapes a choice (e.g. "whatsapp value-drop replies at 34% for this cohort"). NEVER present a LOW CONFIDENCE prior as established fact.\n`;
  } catch (_) { return ''; }
}

async function gatherCalibrationLine(svc) {
  try {
    if (Date.now() - CALIBRATION_CACHE.at > PRIORS_CACHE_MS) {
      const rows = await svc.entities.BrainCalibration.filter({ is_current: true }, '-computed_at', 1).catch(() => []);
      const line = Array.isArray(rows) && rows[0]?.calibration_line ? String(rows[0].calibration_line) : '';
      CALIBRATION_CACHE = { at: Date.now(), line };
    }
    return CALIBRATION_CACHE.line ? `\n${CALIBRATION_CACHE.line}\n` : '';
  } catch (_) { return ''; }
}

// ── BRAIN V4 P4: THE DELTA TIER ────────────────────────────────────────────────
// A cheap Haiku pass that keeps the brain CURRENT between full syntheses: on a small
// wake-nudge (new note/task/follow-up/appointment/comment — no new inbound, no new
// qualification) it revises the working memory + momentum and decides whether the new
// information warrants escalating to a full Opus re-synthesis. It NEVER touches scores,
// drafts, thesis, or suggestions, and it never snapshots — those stay full-tier-only.
const DELTA_SCHEMA = {
  type: 'object',
  properties: {
    working_memory: {
      type: 'object',
      description: "The brain's revised scratchpad after absorbing the new items.",
      properties: {
        open_hypotheses: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Current working hypotheses about this landlord (carry forward what still holds, revise what changed).' },
        pending_confirmations: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Facts awaiting confirmation (from open questions / new items).' },
        last_event_digest: { type: 'string', description: 'One-two sentences: what just happened and what it means.' }
      },
      required: ['last_event_digest']
    },
    ai_momentum: { type: 'string', enum: ['accelerating', 'steady', 'slowing', 'stalled'] },
    nba_still_fresh: { type: 'boolean', description: 'Is the CURRENT next-best-action still the right move after this new information?' },
    escalate_full: { type: 'boolean', description: 'True when the new information genuinely changes the strategic picture (price signal, mandate signal, decision-maker change, meeting outcome) and a full re-synthesis is warranted.' },
    escalate_reason: { type: 'string' }
  },
  required: ['working_memory', 'escalate_full']
};

async function runDeltaTier(svc, landlord, lastRunTs, priorWm, logRun) {
  try {
    const landlord_id = landlord.id;
    const since = new Date(lastRunTs).toISOString();
    // Fetch ONLY the new items (small reads — the whole point is cheapness).
    const [notes, tasks, followups, appointments, comments] = await Promise.all([
      svc.entities.LandlordNote.filter({ landlord_id }, '-created_date', 5).catch(() => []),
      svc.entities.LandlordTask.filter({ landlord_id }, '-created_date', 5).catch(() => []),
      svc.entities.Followup.filter({ landlord_id }, '-created_date', 5).catch(() => []),
      svc.entities.LandlordAppointment.filter({ landlord_id }, '-created_date', 5).catch(() => []),
      svc.entities.ActivityComment.filter({ landlord_id }, '-created_date', 5).catch(() => []),
    ]);
    const fresh = [];
    for (const n of (notes || [])) if ((n.created_date || '') > since) fresh.push(`NOTE [${fmtDate(n.created_date)}] ${String(n.body || '').slice(0, 300)}`);
    for (const t of (tasks || [])) if ((t.created_date || '') > since) fresh.push(`TASK [${fmtDate(t.created_date)}] ${String(t.title || '').slice(0, 150)}${t.done ? ' (done)' : ''}`);
    for (const f of (followups || [])) if ((f.created_date || '') > since) fresh.push(`FOLLOWUP [${fmtDate(f.created_date)}] ${String(f.title || '').slice(0, 150)} @ ${fmtDate(f.scheduled_at)}`);
    for (const a of (appointments || [])) if ((a.created_date || '') > since) fresh.push(`APPOINTMENT [${fmtDate(a.created_date)}] ${a.type || ''} @ ${fmtDate(a.datetime)} (${a.status || 'scheduled'})`);
    for (const c of (comments || [])) if ((c.created_date || '') > since) fresh.push(`COMMENT [${fmtDate(c.created_date)}] on ${c.activity_type || 'activity'}: ${String(c.comment_text || '').slice(0, 300)}`);
    if (!fresh.length) return { escalate_full: false, summary: { note: 'delta: nothing substantive to absorb' } };

    const system = `You are LANDLORD AURORA's delta pass — a fast, cheap working-memory revision between full syntheses. You absorb the NEW items below into the brain's scratchpad and decide ONE thing: does this genuinely change the strategic picture (escalate_full) or not? You do NOT re-score, re-draft, or re-plan — that is the full tier's job. Be conservative about escalating: routine task/follow-up creation almost never warrants it; a note revealing a price expectation, a decision-maker, a meeting outcome, or a mandate signal almost always does. STRICT tool output.`;
    const prompt = `LANDLORD: ${landlord.full_name_en || '?'} | Stage: ${landlord.stage} | Momentum: ${landlord.ai_momentum || '?'} | Win prob: ${landlord.mandate_win_probability ?? '?'}
CURRENT SUMMARY: ${String(landlord.ai_rolling_summary || '(none)').slice(0, 600)}
CURRENT THESIS: ${String(landlord.ai_deal_thesis || '(none)').slice(0, 400)}
CURRENT NEXT-BEST-ACTION: ${landlord.ai_next_best_action ? `${landlord.ai_next_best_action.action || ''} — ${String(landlord.ai_next_best_action.reasoning || '').slice(0, 200)}` : '(none)'}
PRIOR WORKING MEMORY: ${JSON.stringify({ open_hypotheses: priorWm.open_hypotheses || [], pending_confirmations: priorWm.pending_confirmations || [], last_event_digest: priorWm.last_event_digest || '' }).slice(0, 800)}

NEW SINCE LAST RUN (${fresh.length} item(s)):
${fresh.slice(0, 10).join('\n')}

Absorb and emit the delta result.`;

    const result = await callClaude(system, prompt, COLD_MODEL, DELTA_SCHEMA);
    if (!result) {
      await logRun({ tier: 'delta', model: COLD_MODEL, error: 'delta Claude call failed', escalated: true });
      return { escalate_full: true, summary: {} }; // fail up, never silently stale
    }
    if (result.escalate_full === true) {
      await logRun({ tier: 'delta', model: COLD_MODEL, escalated: true, description: String(result.escalate_reason || '').slice(0, 200) });
      return { escalate_full: true, summary: {} };
    }
    // Persist the cheap revision: working memory (+ momentum), and stamp
    // last_orchestrator_run_at so the info-probe baseline advances. ai_processed_at is NOT
    // touched — call scripts and approach drafts never re-forge off a delta.
    const wmIn = (result.working_memory && typeof result.working_memory === 'object') ? result.working_memory : {};
    const capArr = (a, n, len) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).slice(0, n).map((x) => x.trim().slice(0, len)) : []);
    const newWm = {
      open_hypotheses: capArr(wmIn.open_hypotheses, 5, 200),
      pending_confirmations: capArr(wmIn.pending_confirmations, 5, 200),
      last_event_digest: String(wmIn.last_event_digest || '').slice(0, 400),
      last_full_run_at: priorWm.last_full_run_at || landlord.last_orchestrator_run_at || null,
      updated_at: new Date().toISOString(),
    };
    const deltaUpdate = { ai_working_memory: newWm, last_orchestrator_run_at: new Date().toISOString() };
    if (result.ai_momentum && ['accelerating', 'steady', 'slowing', 'stalled'].includes(result.ai_momentum)) {
      deltaUpdate.ai_momentum = result.ai_momentum;
    }
    try { await svc.entities.Landlord.update(landlord.id, deltaUpdate); } catch (e) {
      console.error('delta update failed (non-fatal):', e?.message);
    }
    await logRun({ tier: 'delta', model: COLD_MODEL, escalated: false });
    return {
      escalate_full: false,
      summary: {
        working_memory: newWm,
        ai_momentum: deltaUpdate.ai_momentum || landlord.ai_momentum || null,
        nba_still_fresh: result.nba_still_fresh !== false,
      }
    };
  } catch (err) {
    console.error('runDeltaTier failed (non-fatal — escalating to full):', err?.message);
    return { escalate_full: true, summary: {} };
  }
}

// ── BRAIN V4 P5: THE COUNCIL ───────────────────────────────────────────────────
// For genuinely contested, high-stakes deals only: a second structured Opus call where four
// voices debate the SAME facts — Strategist (path to signature), Skeptic (attacks every
// assumption, hunts red flags), Closer (urgency: what collapses the timeline), Analyst (deed
// data only) — then a synthesis. The deal thesis absorbs the verdict; material disagreements
// surface as dissent + open questions. Budget guard: max one council per landlord per 48h.
// Named for THE COUNCIL chamber of the Napoleon Hill Academy — the same philosophy, in the
// deal brain. NEVER sends anything; writes only ai_council / ai_deal_thesis / ai_open_questions.
const COUNCIL_GUARD_MS = 48 * 3.6e6;
const COUNCIL_SCHEMA = {
  type: 'object',
  properties: {
    strategist: { type: 'object', properties: { position: { type: 'string' }, key_points: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, required: ['position'] },
    skeptic: { type: 'object', properties: { position: { type: 'string' }, key_points: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, required: ['position'] },
    closer: { type: 'object', properties: { position: { type: 'string' }, key_points: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, required: ['position'] },
    analyst: { type: 'object', properties: { position: { type: 'string' }, key_points: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, required: ['position'] },
    verdict: { type: 'string', description: 'The synthesis: the council\'s combined judgement on how to win this mandate, 2-4 sentences.' },
    dissent: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Material disagreements between the voices that could not be resolved — each becomes a live risk.' },
    thesis_revision: { type: 'string', description: 'The deal thesis REWRITTEN to absorb the verdict (2-4 sentences). Keep what held; change what the debate broke.' },
    additional_open_questions: {
      type: 'array', maxItems: 2,
      items: { type: 'object', properties: { question: { type: 'string' }, why: { type: 'string' } }, required: ['question'] },
      description: 'New ask-the-agent questions the debate exposed (0-2).'
    }
  },
  required: ['strategist', 'skeptic', 'closer', 'analyst', 'verdict', 'thesis_revision']
};

function councilTrigger({ update, landlord, daysInStage }) {
  const commission = (update.estimated_commission_aed != null) ? update.estimated_commission_aed : landlord.estimated_commission_aed;
  const win = (update.mandate_win_probability != null) ? update.mandate_win_probability : landlord.mandate_win_probability;
  const reasons = [];
  if (typeof commission === 'number' && commission > 100_000) reasons.push('commission>100k');
  if (typeof win === 'number' && win >= 0.35 && win <= 0.65) reasons.push('contested_win_probability');
  if (update.needs_human_review === true) reasons.push('needs_human_review');
  if (daysInStage > 14 && landlord.stage !== 'deal_closed') reasons.push('stuck>14d');
  return reasons;
}

async function conveneCouncil(svc, landlord, update, marketPack, reasons) {
  try {
    const system = `You are THE COUNCIL — four senior voices inside LANDLORD AURORA debating ONE contested mandate. Each voice argues from its own discipline, on the SAME facts:
- STRATEGIST: the realistic path to a signed mandate — sequencing, leverage, relationship.
- SKEPTIC: attacks every assumption in the current analysis; hunts hidden red flags; asks what everyone is conveniently ignoring.
- CLOSER: Cardone urgency — what collapses the timeline THIS WEEK; where the one ask should land.
- ANALYST: deed data and measured priors ONLY — what the numbers permit and forbid; no vibes.
Then synthesize: a verdict, the unresolved dissent, and the deal thesis rewritten to absorb the verdict. NEVER invent a figure — only numbers present in the context exist. STRICT tool output.`;
    const prompt = `WHY THE COUNCIL CONVENED: ${reasons.join(', ')}

LANDLORD: ${landlord.full_name_en || '?'} | Archetype: ${landlord.landlord_archetype || '?'} | Stage: ${landlord.stage} | Mandate: ${landlord.mandate_status || 'none'} | Listed elsewhere: ${landlord.is_currently_listed_with_others ? 'YES' : 'no'} | Competing brokers: ${landlord.competing_brokers_count || 0}
CURRENT ANALYSIS (just produced by the full synthesis):
- Win probability: ${update.mandate_win_probability ?? '?'} — ${update.mandate_win_rationale || ''}
- Trust ${update.trust_score ?? '?'} / Urgency ${update.urgency_score ?? '?'} / Momentum ${update.ai_momentum || '?'}
- Estimated commission: ${update.estimated_commission_aed ?? '?'} AED
- Rolling summary: ${String(update.ai_rolling_summary || '').slice(0, 800)}
- Next best action: ${update.ai_next_best_action ? `${update.ai_next_best_action.action || ''} — ${String(update.ai_next_best_action.reasoning || '').slice(0, 300)}` : '(none)'}
- Red flags: ${(update.red_flags || []).join(', ') || '(none)'} | Objections: ${(update.ai_objections || []).join('; ') || '(none)'}
- Review reason: ${update.review_reason || '(none)'}
PRIOR DEAL THESIS: ${String(landlord.ai_deal_thesis || '(none)').slice(0, 500)}
${marketPack ? `MARKET EVIDENCE (deed truth — the Analyst's ONLY source):${String(marketPack).slice(0, 2500)}` : 'MARKET EVIDENCE: none on file — the Analyst must say figures are unavailable.'}

Debate and emit the council result.`;
    // 4 voices + verdict + thesis can overrun the default 4096-token ceiling — truncated tool
    // JSON comes back unparseable and the council dies silently. 6000 gives it room.
    const out = await callClaude(system, prompt, FULL_MODEL, COUNCIL_SCHEMA, 6000);
    if (!out) return { __error: 'council model call returned no tool output (truncation or API error)' };
    return out;
  } catch (err) {
    console.error('conveneCouncil failed (non-fatal):', err?.message);
    return { __error: String(err?.message || err).slice(0, 300) };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      landlord_id, force = false, tier = 'full', force_cold = false, debug_context = false,
      // BRAIN V4: eval_mode runs the full pipeline but writes NOTHING (used by brainEvalHarness);
      // triggered_by labels the run in BrainRunLog (card_open | inbound_message | nudge_* |
      // appointment_booked | stage_change | qualification | heartbeat | backfill | manual | eval_harness).
      eval_mode = false, triggered_by = 'manual'
    } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });
    const svc = base44.asServiceRole;
    const runStartedAt = Date.now();

    // BrainRunLog writer — one row per run (never per skip), non-fatal, skipped in eval_mode.
    const logRun = async (fields) => {
      if (eval_mode) return;
      try {
        await svc.entities.BrainRunLog.create({
          landlord_id,
          run_at: new Date(runStartedAt).toISOString(),
          duration_ms: Date.now() - runStartedAt,
          triggered_by: String(triggered_by || 'manual').slice(0, 60),
          ...fields,
        });
      } catch (_) { /* run log must never break the brain */ }
    };

    const landlord = await svc.entities.Landlord.get(landlord_id);
    if (!landlord) return Response.json({ error: 'landlord not found' }, { status: 404 });

    // Skip if recently run and not forced (debounce auto-triggers) — UNLESS something NEW
    // happened since the last run. Every new task, note, follow-up, appointment, activity,
    // comment, message, or call qualification is CONNECTED to the brain: any record created
    // after last_orchestrator_run_at wakes it. Cheap probe: one limit-1 newest-first query per
    // entity. BRAIN V4 P4: when the new information is SMALL (no new inbound message, no new
    // qualification) and a full synthesis ran within the last 24h, the wake is served by the
    // cheap DELTA tier (Haiku working-memory revision) instead of a full Opus re-synthesis —
    // the brain stays always-current at Haiku cost, deep at Opus cost only when it matters.
    if (!force && !eval_mode && landlord.last_orchestrator_run_at) {
      const lastRunTs = new Date(landlord.last_orchestrator_run_at).getTime();
      const hoursSince = (Date.now() - lastRunTs) / 3.6e6;
      if (hoursSince < 6) {
        const newest = async (entity, filter) => {
          try {
            const rows = await svc.entities[entity].filter(filter, '-created_date', 1);
            const r = Array.isArray(rows) ? rows[0] : null;
            return r ? new Date(r.created_date || 0).getTime() : 0;
          } catch (_) { return 0; }
        };
        const stamps = await Promise.all([
          newest('LandlordTask', { landlord_id }),
          newest('LandlordNote', { landlord_id }),
          newest('LandlordAppointment', { landlord_id }),
          newest('Followup', { landlord_id }),
          newest('Activity', { lead_id: landlord_id }),
          newest('ActivityComment', { landlord_id }),
          newest('Message', { landlord_id }),
          newest('CallQualification', { landlord_id }),
        ]);
        const newInfoSinceRun = stamps.some((t) => t > lastRunTs);
        if (!newInfoSinceRun) return Response.json({ skipped: 'recently_run', hours_since: hoursSince });

        // ── V4 P4 DELTA ROUTING ── small info (stamps[6]=Message, stamps[7]=CallQualification
        // untouched) + a full synthesis within 24h ⇒ delta. Inbound replies, qualifications,
        // stage moves (which arrive with force=true), or >24h accumulation ⇒ full.
        const bigInfo = stamps[6] > lastRunTs || stamps[7] > lastRunTs;
        const wm = (landlord.ai_working_memory && typeof landlord.ai_working_memory === 'object') ? landlord.ai_working_memory : {};
        const lastFullTs = new Date(wm.last_full_run_at || landlord.last_orchestrator_run_at).getTime();
        const hoursSinceFull = (Date.now() - lastFullTs) / 3.6e6;
        if (!bigInfo && hoursSinceFull < 24) {
          const deltaOut = await runDeltaTier(svc, landlord, lastRunTs, wm, logRun);
          if (deltaOut && !deltaOut.escalate_full) {
            return Response.json({ ok: true, tier: 'delta', escalated: false, ...deltaOut.summary });
          }
          // Delta escalated (or failed) — fall through to the full synthesis below.
        }
      }
    }

    // READ EVERYTHING (service role bypasses RLS on Message/CallQualification/etc.). Each read is
    // resilient — a missing entity or query error degrades to [] rather than failing the run.
    const [
      properties, messages, notes, tasks, appointments, followups, calls, meetings, viewings,
      qualifications, negotiation, stakeholders, activities, docs, brandVoice, directives, coachingComments
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
      svc.entities.DocumentChecklistItem.filter({ landlord_id }).catch(() => []),
      svc.entities.BrandVoice.filter({ is_active: true }, '-updated_date', 1).then(r => r?.[0]).catch(() => null),
      svc.entities.LandlordDirective.filter({ landlord_id }, '-created_date', 20).catch(() => []),
      svc.entities.ActivityComment.filter({ landlord_id }, '-created_date', 30).catch(() => [])
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

    // ── SALES DOCTRINE: The 14-Day Law ──
    // A landlord in an active stage with NO scheduled next touch (pending Followup, upcoming
    // LandlordAppointment, scheduled task/call/meeting/viewing) is a doctrine violation.
    // Also compute last-contact recency so the cadence picker can choose the right rule5_* step.
    const now = Date.now();
    const isActiveStage = !!landlord.stage && landlord.stage !== 'deal_closed';
    const hasScheduledTouch = scheduledTouchpoints.length > 0 ||
      openTasks.some(t => t.scheduled_at || t.due_date);

    // Last contact = most recent inbound message timestamp (or outbound if no inbound).
    let lastContactAt = null;
    const lastInbound = messages.find(m => m.direction === 'incoming');
    const lastOutbound = messages.find(m => m.direction === 'outgoing');
    if (lastInbound?.timestamp) lastContactAt = lastInbound.timestamp;
    else if (lastOutbound?.timestamp) lastContactAt = lastOutbound.timestamp;
    const daysSinceLastContact = lastContactAt
      ? Math.floor((now - new Date(lastContactAt).getTime()) / 86400000) : null;

    // Doctrine violation = active stage + no scheduled next touch.
    const doctrineViolation = isActiveStage && !hasScheduledTouch;

    // ── FOUNDER DIRECTIVE (TOP-PRIORITY CONTEXT) ──
    // The most recent active or acknowledged directive overrides all other strategic
    // considerations — every next-best-action, coaching note, and suggested message must
    // align with it.
    const activeDirective = (Array.isArray(directives) ? directives : [])
      .filter(d => d && (d.status === 'active' || d.status === 'acknowledged'))
      .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())[0] || null;
    const directiveBlock = activeDirective ? `
FOUNDER DIRECTIVE — this overrides all other strategic considerations; every next-best-action, coaching note, and suggested message must align with it.
Priority: ${activeDirective.priority || 'normal'}
Directive: ${String(activeDirective.directive_text || '').slice(0, 1000)}
Issued by: ${activeDirective.created_by_name || activeDirective.created_by_email || 'founder'} on ${fmtDate(activeDirective.created_date)}
${activeDirective.status === 'acknowledged' && activeDirective.agent_response ? `Agent acknowledged with response: ${String(activeDirective.agent_response).slice(0, 500)}` : ''}
` : '';

    // ── CONVERTING THE UNSOLD ──
    // When the unit is listed with competitors, factor mandate expiry + competitor fatigue.
    const isListedWithOthers = !!landlord.is_currently_listed_with_others;
    const mandateExpiresAt = landlord.mandate_expires_at ? new Date(landlord.mandate_expires_at).getTime() : null;
    const daysToMandateExpiry = mandateExpiresAt
      ? Math.floor((mandateExpiresAt - now) / 86400000) : null;
    const unsoldDays = landlord.days_on_market ?? null;

    // Price vs valuation
    const valuation = num(prop.ai_estimated_value_aed);
    const latestQual = qualifications[0] || null;
    const askingPrice = num(landlord.asking_price_aed) ?? num(prop.asking_price_aed) ?? (latestQual ? num(latestQual.price_expectation_aed) : null);
    const priceGapPct = (askingPrice && valuation) ? Math.round(((askingPrice - valuation) / valuation) * 100) : null;

    // Peninsula 3 only: live deed-data market pack (building card + this unit's stack comps).
    const p3Pack = await gatherProjectMarketPack(svc, landlord, prop);

    // Curated project intelligence sources (portal insights, official brand pages) — brand +
    // lifestyle + portal facts layered on top of the deed pack. '' when none exist.
    const intelPack = await gatherProjectIntelPack(svc, landlord, prop);

    // The Project record's curated `notes` brief — market positioning, pricing anchors,
    // objection handlers, and the mandate-winning playbook for this project.
    const projectBrief = await gatherProjectBriefPack(svc, landlord, prop);

    // Owner's FULL unit portfolio (synced owner registry) — every unit this person holds, so the
    // brain reasons over the whole portfolio and suggests asking the owner about their other units.
    const ownerPortfolio = await gatherOwnerPortfolio(svc, landlord);

    // BRAIN V4 P3 LEARN: measured playbook priors for this landlord's cohort + the brain's own
    // calibration correction line. '' until compileBrainPriors has accrued data.
    const priorsPack = await gatherPlaybookPriors(svc, landlord);
    const calibrationLine = await gatherCalibrationLine(svc);

    // Verification hook (V4): return the gathered context blocks without calling Claude or
    // writing anything. Used by phase acceptance checks and the eval harness.
    if (debug_context === true) {
      return Response.json({
        ok: true, debug_context: true,
        priors_pack: priorsPack,
        calibration_line: calibrationLine,
        market_pack_present: !!p3Pack,
        intel_pack_present: !!intelPack,
        project_brief_present: !!projectBrief,
        owner_portfolio_present: !!ownerPortfolio,
      });
    }

    // Engagement-wins routing: an engaged lead always gets the full (thesis-capable) tier, even
    // when the caller hinted 'cold' — unless force_cold is explicitly set for a deliberate
    // cost-control run. hasInbound/hasActivity derived from data already loaded above.
    const hasInbound = Array.isArray(messages) && messages.some(m => m.direction === 'incoming');
    const hasActivity = Array.isArray(activities) && activities.length > 0;
    const effectiveTier = resolveTier({ landlord, hasInbound, hasActivity, forceCold: force_cold, requestedTier: tier });

    let result = null;
    let modelUsed = FULL_MODEL;
    let cortexTelemetry = { tool_calls: 0, tools_used: [], tokens_in: 0, tokens_out: 0 };

    if (effectiveTier === 'cold') {
      // COLD: no conversation yet (record just created). Light, cheap, minimal output.
      modelUsed = COLD_MODEL;
      const brandVoiceBlock = brandVoice ? `
BRAND VOICE (obey in every message draft):
- Charter: ${String(brandVoice.charter_text || '').slice(0, 1200)}
- Language rules: ${String(brandVoice.language_rules || '').slice(0, 800)}
` : '';

      const coldSystem = `You are LANDLORD AURORA (cold-tier) — assessing a brand-new Dubai landlord lead with NO conversation history yet. Output only: urgency_score (0-100) + rationale, rapport_level (likely "cold"), a best-guess landlord_archetype, a 1-2 sentence ai_rolling_summary, a concrete ai_next_best_action to make first contact, and ai_suggested_messages: 2-3 PERSONAL first-contact WhatsApp openers (mode="cold_open", channel="whatsapp", in the landlord's preferred language) tailored to this owner's tower/unit/project and archetype — never generic blasts; each with tone, intent, rationale. Do not fabricate scores you cannot justify. STRICT tool output. When a PROJECT INTELLIGENCE BRIEF block is present, weave its project-specific playbook (pricing anchors, objection handlers) into the urgency rationale and the cold-open drafts; it complements the MARKET PACK and never overrides deed figures.${DOCTRINE_RULES}${brandVoiceBlock}${directiveBlock}`;
      const coldPrompt = `NEW LANDLORD: ${landlord.full_name_en || landlord.full_name || `${landlord.first_name || ''} ${landlord.last_name || ''}`}
Phone: ${landlord.phone || '?'} | Lang: ${landlord.preferred_language || 'en'} | Nationality: ${landlord.nationality || '?'}
Source: ${landlord.source || '?'} | Stage: ${landlord.stage || 'initial_contact'}
Archetype hint: ${landlord.landlord_archetype || 'unknown'}
Project/unit: ${landlord.project_name || prop.project_name || '?'} ${landlord.unit_reference || prop.unit_reference || ''}
Currently listed with others: ${landlord.is_currently_listed_with_others ? 'YES' : 'no'} | Competing brokers: ${landlord.competing_brokers_count || 0}
Property: ${prop.id ? `unit known${valuation ? `, AI valuation ${valuation} AED` : ''}` : 'none linked yet'}
${ownerPortfolio}${p3Pack}${intelPack}${projectBrief}${priorsPack}No conversation, notes, tasks, or calls exist yet. Emit the cold-tier assessment.${p3Pack ? ' Every cold-open draft MUST weave in exactly ONE real figure from the MARKET PACK above (a stack deed with unit + date, the building median, or the owner-gain median) — naturally, as the value hook; never invent a figure.' : ''}${intelPack ? ' When PROJECT INTELLIGENCE SOURCES are present, ONE cold-open draft may lead with a brand/lifestyle hook from that block instead (resort now open, residence-count scarcity, the first registered rental) — one fact, stated naturally, never a data dump.' : ''}${ownerPortfolio ? ' Where the OWNER PORTFOLIO shows the owner holds OTHER units besides this one, weave a natural line into ONE cold-open draft acknowledging you can help across their whole portfolio (not a hard ask) — it signals you have done your homework on their holdings and opens the door to a wider mandate.' : ''}`;
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

      const brandVoiceBlock = brandVoice ? `
BRAND VOICE (obey in EVERY message draft, coaching line, and next-best-action draft_message):
- Charter: ${String(brandVoice.charter_text || '').slice(0, 1500)}
- Language rules: ${String(brandVoice.language_rules || '').slice(0, 1000)}
` : '';

      const systemPrompt = `You are LANDLORD AURORA — an autonomous AI co-pilot for a Dubai real-estate agent pursuing landlord mandates. You reason over the ENTIRE context below (conversation, the agent's own notes, logged calls, the unit valuation, and everything already actioned/scheduled) and produce ONE coherent, internally-consistent picture.${DOCTRINE_RULES}${brandVoiceBlock}${directiveBlock}${calibrationLine}

INVESTIGATION (BRAIN V4 CORTEX): before emitting, you MAY call up to ${MAX_TOOL_CALLS} read-only investigation tools to test a hypothesis the packs cannot settle — deeper deed comps (lookup_comps), the owner's full registry portfolio (lookup_owner_portfolio), measured cohort reply data (lookup_cohort_prior), THIS landlord's outcome ledger (lookup_outcome_history), aggregate tower pipeline competition (lookup_pipeline_context), or the agent's calendar load before proposing a slot (check_calendar_conflicts). Investigate only what would genuinely change a score, the next-best-action, or a draft — not everything reflexively. Evidence from a tool becomes citable ground (tool:<name>). When done (or when you have enough), call emit_orchestrator EXACTLY ONCE with the complete result. NEVER leak another owner's name, unit, price, or conversation into this landlord's outputs — cross-landlord data is aggregates only.

Decide and emit:
1. STAGE PROGRESSION: new_stage only if EARNED by evidence; detect sub_stage. new_stage MUST be one of (or null): ${STAGES.join(', ')}.
2. SCORES (with one-line rationales each): trust_score (0-100), responsiveness_score (0-100), mandate_win_probability (0-1), urgency_score (0-100). estimated_commission_aed if derivable from asking/valuation × commission %.
3. RAPPORT: cold → warming → rapport_built → trust_established → champion.
4. SIGNALS: buying_signals[] and red_flags[]. OBJECTIONS: ai_objections[] (the landlord's stated/implied hesitations).
5. ROLLING SUMMARY: 3-5 sentences. It MUST reflect what is already scheduled (e.g. "call already booked for X") and what tasks are already pending/done — do not describe those as if they still need creating.
6. COACHING: 1-2 specific sentences for THIS agent on THIS landlord.
7. NEXT BEST ACTION: action + priority + scheduled_for + draft_message (in the landlord's language, obeying the Brand Voice) + reasoning + confidence. If a 14-DAY LAW violation is flagged below, the action MUST be "schedule_next_touch" (priority high/urgent) and a cadence follow-up MUST be proposed in section 12. If the unit is listed with competitors (unsold), factor mandate expiry + competitor fatigue into the action and reference the unsold_competitor_watch_30 cadence.
8. MOMENTUM: accelerating | steady | slowing | stalled. STRIKE_NOW: momentum=accelerating AND urgency>70 AND mandate_win>0.4.
9. ESCALATION: needs_human_review if value >10M AED with a red flag, OR competing brokers ≥3, OR stuck >14d in stage.
10. PRICE ↔ VALUATION RECONCILIATION (critical): cross-reference the asking price (or the landlord's stated expectation) against the AI valuation. If the asking is unrealistic vs valuation, say so explicitly in the summary AND add it to ai_objections. If there is NO asking price yet but a valuation exists, the next-best-action should use the valuation as the hook. If a MARKET PACK is present (Peninsula 3 / 4 / Peninsula 5 family / Jumeirah Living, or any project with a deed or portal-listings pack), its stack/type deed comps ARE the market reference: reconcile the asking price (or stated expectation) against them as a deed-based estimate, quote deeds with unit + date, frame sell-vs-hold using the pack's gain and yield stats, and never state a market figure that is not in the pack. For the Peninsula 5 family, never mix the tower with the D1/D2 duplexes and never mix unit types — take figures ONLY from this owner's own type and project.
11. SUGGESTED TASKS (state-aware): recommend NEW tasks ONLY, each referencing one of: ${TASK_TEMPLATE_KEYS.join(', ')}. Do NOT suggest anything that already exists as an open or done task (listed below) — reference those as pending instead. 0 is valid if everything is already covered.
12. SUGGESTED FOLLOW-UPS (state-aware + doctrine cadence): recommend NEW time-based follow-ups ONLY, each referencing one of: ${FOLLOWUP_TEMPLATE_KEYS.join(', ')}, with when_offset_days, suggested_hour (0-23 Asia/Dubai), channel. Do NOT duplicate an already-scheduled appointment/follow-up (listed below). When a 14-DAY LAW violation is flagged, you MUST include the appropriate cadence step (rule5_day2_value_drop / rule5_day5_call / rule5_day9_voice_note / rule5_day14_snapshot / law14_nurture / unsold_competitor_watch_30) based on days_since_last_contact and stage. When the unit is listed with competitors, include unsold_competitor_watch_30 if no recent competitor-watch touch exists.
13. SUGGESTED MESSAGES (reply mode): 2-3 send-ready WhatsApp drafts (mode="reply", channel="whatsapp") in the landlord's preferred_language that advance the next-best-action — ready to send, NO placeholders. Vary the angle (e.g. direct vs soft). Each with tone, intent, rationale. Ground them in the actual conversation and the price reality. EVERY draft MUST obey the Sales Doctrine (one clear ask, value before price, next step scheduled) AND the Brand Voice charter/language rules.
14. DEAL THESIS (persistent — EVOLVE, don't reset): ai_deal_thesis is the durable 2-4 sentence strategy for winning THIS mandate — the through-line that should hold across many runs (who the decision-maker is, the core lever, the path to signature, the main risk). You are given the PRIOR thesis below: keep what is still true, revise only what genuinely changed, and let it accrue. This is DISTINCT from ai_rolling_summary (which is the tactical current-state) — do not just repeat the summary here.
15. OPEN QUESTIONS (ask-the-agent — be honest about uncertainty): ai_open_questions is 0-3 specific things a HUMAN could answer that would materially sharpen the strategy (e.g. "Is the owner's spouse a co-decision-maker?", "Did the last viewing actually happen?"). Each with a one-line 'why'. Return an EMPTY array when nothing is genuinely blocking — do not invent questions to fill the slot.
16. OWNER PORTFOLIO (when an OWNER PORTFOLIO block is present in the context): the owner holds multiple units — reason over the WHOLE portfolio, not just the single CRM record you are running on. Weave awareness of their other units into the rolling summary, the coaching line, and the next-best-action. Treat the owner as a portfolio client. In the suggested messages and/or the next-best-action draft_message, include a natural suggestion to ASK THE OWNER about those other units on the next call (e.g. whether they also want to sell or rent any of them, or whether they'd like you to manage the entire portfolio) — this is high-value intelligence the agent can use in the call. You may add an ai_open_question about a specific other unit if it would materially sharpen the mandate strategy.
17. CONFIDENCE (calibrated, never performative): ai_confidence {trust, urgency, win_prob, overall} each 0-1 — how sure you are in each score given the DEPTH of evidence, not how good the numbers look. One cold message = low confidence everywhere. Rich two-way conversation + qualification + deed pack = high. When overall confidence is LOW and the stakes are HIGH (big commission), the coaching line must say to QUALIFY BEFORE PITCHING.
18. HIGHEST-LEVERAGE UNKNOWN: ai_highest_leverage_unknown is the ONE missing fact that would most change your conclusion (price expectation? decision-maker? timeline? competing broker's mandate terms?). Rank ai_open_questions by expected information value — the question whose answer changes the strategy most goes FIRST. The call script's discovery order follows this ranking.
19. REASONING TRACE (the fabrication firewall): ai_reasoning_trace — 2-8 entries covering your MAJOR outputs (the next-best-action, the win probability, the chosen channel/angle, any stage recommendation). Each entry: {claim, grounds[]} where every ground is a real citation from the context or a tool result — deed:<unit+date>, doctrine:<rule>, prior:<bucket>, note:<date>, message:<date>, qualification:<date>, portfolio, calibration, tool:<name>. If you cannot ground a claim, WEAKEN it or DROP it — an ungrounded confident claim is a catastrophe.
20. SELF-CRITIQUE (mandatory, LAST step before emitting): re-read your own analysis and identify its TWO weakest claims — the ones an adversarial reviewer would attack first. Adjust the affected scores/confidence/questions accordingly, then report both claims and what you changed in self_critique. "Nothing to adjust" is only acceptable with a stated reason.
21. THE CAMPAIGN PLAN (temporal strategy, not just the next move): ai_campaign_plan is the full 14-30 day plan to reach ONE objective. Touch #1 IS the next-best-action (same move, same timing). Build the cadence on the doctrine (Rule-of-5 keys where they fit; nurture when engagement decays), vary channels deliberately (honor the PLAYBOOK PRIORS), space touches to breathe (never two asks back-to-back), keep every hour between 9 and 21 Asia/Dubai, and respect what is ALREADY scheduled (the plan absorbs existing touchpoints, it never duplicates them). exit_conditions define when the plan collapses to a reply branch or stops (signed / definitive no). The plan is REPLANNED on every full run — when the owner replied since the last plan, the old plan is void: plan from the reply.

Rules: STRICT tool output. Drafts in the landlord's preferred_language. Weight the AGENT'S OWN NOTES heavily — they are direct operator intelligence. Never fabricate confident scores without evidence; if data is thin, return low/neutral scores and add 'insufficient_contact_data' to red_flags. When a PROJECT INTELLIGENCE BRIEF block is present, it is the curated project playbook (pricing anchors, objection handlers, mandate-winning strategy) — use it to shape the scores, the deal thesis, the next-best-action, and every suggested message; it complements (never overrides) the MARKET PACK deed figures.`;

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
${projectBrief}${p3Pack}${intelPack}${ownerPortfolio}${priorsPack}
LATEST CALL QUALIFICATION: ${qualBlock}

CONVERSATION (last ${messages.length} messages, oldest→newest):
${convo || '(no messages yet)'}

AGENT'S OWN NOTES (human-written, high signal):
${notesBlock}

FOUNDER COACHING (founder annotations on specific activities — learn from these):
${(Array.isArray(coachingComments) && coachingComments.length) ? coachingComments.map(c => `- [${fmtDate(c.created_date)}] ${c.author_name || c.author_email || 'founder'} on ${c.activity_type || 'activity'}: ${String(c.comment_text || '').slice(0, 500)}${c.priority ? ` [${c.priority.toUpperCase()}]` : ''}`).join('\n') : '(none yet)'}

EXISTING TASKS — OPEN (${openTasks.length}): ${openTasks.map(t => `"${t.title}"${t.ai_source ? ` [${t.ai_source}]` : ''}`).join(', ') || '(none)'}
EXISTING TASKS — DONE (${doneTasks.length}): ${doneTasks.map(t => `"${t.title}"`).join(', ') || '(none)'}
ALREADY SCHEDULED (${scheduledTouchpoints.length}): ${scheduledTouchpoints.map(s => `${s.kind}@${fmtDate(s.when)}${s.channel ? `/${s.channel}` : ''}`).join(', ') || '(none)'}

DOCUMENTS: ${docsReceived}/${docsTotal} received. Pending: ${docs.filter(d => d.status === 'pending_request' || d.status === 'requested').map(d => d.document_type).join(', ') || 'none'}
STAKEHOLDERS (${stakeholders.length}): ${stakeholders.map(s => `${s.name}(${s.role})`).join(', ') || '(none)'}
NEGOTIATION: ${negotiation ? JSON.stringify({ asking: negotiation.asking_price_current, cma: negotiation.cma_value_aed, gap_pct: negotiation.pricing_gap_pct }) : '(none)'}
PRIOR ROLLING SUMMARY (refine, don't blindly restate): ${landlord.ai_rolling_summary || '(none)'}
PRIOR DEAL THESIS (evolve it — keep what holds, revise only what changed): ${landlord.ai_deal_thesis || '(none yet — establish it)'}

SALES DOCTRINE STATE:
14-Day Law violation: ${doctrineViolation ? 'YES — active stage but NO scheduled next touch (no pending Followup, no upcoming appointment, no scheduled task/call/meeting/viewing). The next-best-action MUST be "schedule_next_touch" and a cadence follow-up MUST be proposed.' : 'no (a next touch is already scheduled)'}
days_since_last_contact: ${daysSinceLastContact ?? 'unknown (no messages yet)'}
has_scheduled_touch: ${hasScheduledTouch ? 'yes' : 'no'}

CONVERTING THE UNSOLD:
listed_with_competitors: ${isListedWithOthers ? 'YES' : 'no'}
competing_brokers_count: ${landlord.competing_brokers_count || 0}
days_on_market: ${unsoldDays ?? 'unknown'}
mandate_expires_at: ${landlord.mandate_expires_at ? fmtDate(landlord.mandate_expires_at) : 'none'}${daysToMandateExpiry != null ? ` (${daysToMandateExpiry}d from now)` : ''}
${isListedWithOthers ? '→ Factor competitor listing fatigue into the next-best-action. If no recent unsold_competitor_watch_30 touch exists, propose one (market-reality check: comparable days on market, nearby price drops) to pull the mandate toward us.' : ''}

Reason over all of the above. Investigate what your hypotheses need (≤${MAX_TOOL_CALLS} tool calls), then emit the orchestrator result.`;

      // BRAIN V4 P3 CORTEX: bounded agentic investigation loop (read-only tools), replacing the
      // one-shot call for the full tier. Cold tier above remains one-shot Haiku.
      const executors = buildInvestigationExecutors(svc, landlord, { ownerPortfolio });
      const loopOut = await runCortexLoop({ system: systemPrompt, prompt: userPrompt, model: FULL_MODEL, schema: FULL_SCHEMA, executors });
      result = loopOut.result;
      cortexTelemetry = { tool_calls: loopOut.tool_calls, tools_used: loopOut.tools_used, tokens_in: loopOut.tokens_in, tokens_out: loopOut.tokens_out };
    }

    if (!result) {
      await logRun({ tier: effectiveTier, model: modelUsed, error: 'Claude call failed', tool_calls: cortexTelemetry.tool_calls, tools_used: cortexTelemetry.tools_used, tokens_in: cortexTelemetry.tokens_in, tokens_out: cortexTelemetry.tokens_out });
      return Response.json({ error: 'Claude call failed', tier: effectiveTier, last_run: new Date().toISOString() }, { status: 500 });
    }

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

      // Stage writes are DISABLED: the AI must NEVER change the pipeline stage automatically.
      // Only a human user can move a landlord between stages. The AI may suggest a stage in
      // result.new_stage (surfaced in the UI as a recommendation), but it must not write it.
      // This was the root cause of landlords snapping back or jumping forward after a manual
      // stage move — the orchestrator overwrote the human's choice.
    }

    // BRAIN V4 eval_mode: the full pipeline ran (gathering, tier routing, model, telemetry) but
    // NOTHING in the CRM is touched — no Landlord update, no snapshot, no run log. The ONE write
    // is the BrainEvalRun artifact carrying this same envelope: function-to-function calls are
    // cut by the platform gateway (~120s) while full runs regularly take longer, so the harness
    // reads the payload from BrainEvalRun instead of trusting this response to survive.
    if (eval_mode) {
      const evalEnvelope = {
        ok: true, eval_mode: true, tier: effectiveTier, model: modelUsed,
        result,
        telemetry: cortexTelemetry,
        context: {
          doctrine_violation: doctrineViolation,
          days_since_last_contact: daysSinceLastContact,
          has_scheduled_touch: hasScheduledTouch,
          market_pack_present: !!p3Pack,
          priors_present: !!priorsPack,
          calibration_present: !!calibrationLine,
          existing_task_keys: [...existingTaskKeys],
          existing_followup_keys: [...existingFollowupKeys],
          market_pack_text: String(p3Pack || ''),
          asking_price_aed: (typeof landlord.asking_price_aed === 'number') ? landlord.asking_price_aed : null,
        }
      };
      try {
        await svc.entities.BrainEvalRun.create({
          landlord_id,
          run_at: new Date(runStartedAt).toISOString(),
          tier: effectiveTier || '',
          triggered_by: String(triggered_by || 'manual').slice(0, 60),
          payload: evalEnvelope,
        });
      } catch (evalErr) {
        console.error('BrainEvalRun create failed (non-fatal):', evalErr?.message);
      }
      return Response.json(evalEnvelope);
    }

    await svc.entities.Landlord.update(landlord.id, update);

    // V3 Phase 2 (REMEMBER) + V4 P3 (CORTEX): persistent memory + cortex outputs, written in a
    // SEPARATE, non-fatal update. If a field is not yet live in the Base44 schema, a rejected
    // write degrades HERE instead of bricking the core orchestrator update above. Full tier only;
    // an empty ai_open_questions array is intentional — it clears stale questions.
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
      // V4 P3: calibrated confidence, highest-leverage unknown, reasoning trace.
      const conf = result.ai_confidence;
      if (conf && typeof conf === 'object') {
        const c01 = (v) => (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : null;
        const cleaned = { trust: c01(conf.trust), urgency: c01(conf.urgency), win_prob: c01(conf.win_prob), overall: c01(conf.overall) };
        if (Object.values(cleaned).some((v) => v != null)) memoryUpdate.ai_confidence = cleaned;
      }
      if (typeof result.ai_highest_leverage_unknown === 'string' && result.ai_highest_leverage_unknown.trim()) {
        memoryUpdate.ai_highest_leverage_unknown = result.ai_highest_leverage_unknown.trim().slice(0, 500);
      }
      if (Array.isArray(result.ai_reasoning_trace)) {
        memoryUpdate.ai_reasoning_trace = result.ai_reasoning_trace
          .filter((t) => t && typeof t === 'object' && typeof t.claim === 'string' && t.claim.trim() && Array.isArray(t.grounds) && t.grounds.length)
          .slice(0, 8)
          .map((t) => ({
            claim: t.claim.trim().slice(0, 300),
            grounds: t.grounds.filter((g) => typeof g === 'string' && g.trim()).slice(0, 5).map((g) => g.trim().slice(0, 200)),
          }));
      }
      // V4 P5: the campaign plan — validated + clamped in code (quiet hours are LAW, not a prompt hope).
      const plan = result.ai_campaign_plan;
      if (plan && typeof plan === 'object' && Array.isArray(plan.touches) && plan.touches.length) {
        const touches = plan.touches
          .filter((t) => t && typeof t === 'object' && typeof t.freeform_intent === 'string' && t.freeform_intent.trim())
          .slice(0, 8)
          .map((t) => ({
            day_offset: (typeof t.day_offset === 'number' && isFinite(t.day_offset)) ? Math.min(30, Math.max(0, Math.round(t.day_offset))) : 1,
            channel: ['whatsapp', 'imessage', 'telegram', 'sms', 'email', 'call'].includes(t.channel) ? t.channel : 'whatsapp',
            angle: typeof t.angle === 'string' ? t.angle.trim().slice(0, 60) : '',
            template_key: (typeof t.template_key === 'string' && FOLLOWUP_TEMPLATE_KEYS.includes(t.template_key)) ? t.template_key : '',
            freeform_intent: t.freeform_intent.trim().slice(0, 240),
            hour: (typeof t.hour === 'number' && isFinite(t.hour)) ? Math.min(21, Math.max(9, Math.round(t.hour))) : 10,
            success_criteria: typeof t.success_criteria === 'string' ? t.success_criteria.trim().slice(0, 200) : '',
          }))
          .sort((a, b) => a.day_offset - b.day_offset);
        if (touches.length >= 2) {
          memoryUpdate.ai_campaign_plan = {
            objective: String(plan.objective || '').trim().slice(0, 300),
            touches,
            exit_conditions: (Array.isArray(plan.exit_conditions) ? plan.exit_conditions : [])
              .filter((x) => typeof x === 'string' && x.trim()).slice(0, 4).map((x) => x.trim().slice(0, 200)),
            generated_at: new Date().toISOString(),
          };
        }
      }
      // V4 P4: a full synthesis resets the working memory (its content is absorbed into the
      // thesis/summary/questions) and stamps last_full_run_at — the delta tier's 24h anchor.
      memoryUpdate.ai_working_memory = {
        open_hypotheses: [],
        pending_confirmations: [],
        last_event_digest: 'full synthesis',
        last_full_run_at: update.last_orchestrator_run_at,
        updated_at: update.last_orchestrator_run_at,
      };
      if (Object.keys(memoryUpdate).length) {
        try {
          await svc.entities.Landlord.update(landlord.id, memoryUpdate);
        } catch (memErr) {
          console.error('memory/cortex update failed (non-fatal — check live schema):', memErr?.message);
        }
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

    // ── BRAIN V4 P5: THE COUNCIL — high-stakes second opinion, max once per 48h ──
    let councilConvened = false;
    let councilError = '';
    if (effectiveTier === 'full') {
      try {
        const reasons = councilTrigger({ update, landlord, daysInStage });
        const lastConvened = landlord.ai_council?.convened_at ? new Date(landlord.ai_council.convened_at).getTime() : 0;
        const guarded = (Date.now() - lastConvened) < COUNCIL_GUARD_MS;
        if (reasons.length && !guarded) {
          const council = await conveneCouncil(svc, landlord, update, p3Pack, reasons);
          if (council && typeof council === 'object' && council.__error) {
            councilError = `council: ${council.__error}`;
          }
          if (council && typeof council === 'object' && council.verdict) {
            councilConvened = true;
            const councilUpdate = {
              ai_council: {
                verdict: String(council.verdict).trim().slice(0, 600),
                dissent: (Array.isArray(council.dissent) ? council.dissent : [])
                  .filter((d) => typeof d === 'string' && d.trim()).slice(0, 3).map((d) => d.trim().slice(0, 300)),
                convened_at: new Date().toISOString(),
              },
            };
            // The deal thesis absorbs the verdict.
            if (typeof council.thesis_revision === 'string' && council.thesis_revision.trim()) {
              councilUpdate.ai_deal_thesis = council.thesis_revision.trim();
            }
            // Debate-exposed questions merge into ai_open_questions (cap 3, dedupe by text).
            const extraQs = (Array.isArray(council.additional_open_questions) ? council.additional_open_questions : [])
              .filter((q) => q && typeof q.question === 'string' && q.question.trim())
              .map((q) => ({ question: q.question.trim().slice(0, 250), why: typeof q.why === 'string' ? q.why.trim().slice(0, 250) : 'raised by THE COUNCIL' }));
            if (extraQs.length) {
              const existingQs = Array.isArray(result.ai_open_questions) ? result.ai_open_questions
                .filter((q) => q && typeof q === 'object' && typeof q.question === 'string' && q.question.trim())
                .map((q) => ({ question: q.question.trim(), why: typeof q.why === 'string' ? q.why.trim() : '' })) : [];
              const seen = new Set(existingQs.map((q) => q.question.toLowerCase()));
              const merged = [...existingQs];
              for (const q of extraQs) { if (!seen.has(q.question.toLowerCase()) && merged.length < 3) { merged.push(q); seen.add(q.question.toLowerCase()); } }
              councilUpdate.ai_open_questions = merged;
            }
            try { await svc.entities.Landlord.update(landlord.id, councilUpdate); } catch (cErr) {
              console.error('council update failed (non-fatal):', cErr?.message);
            }
          }
        }
      } catch (councilErr) {
        console.error('council pass failed (non-fatal):', councilErr?.message);
        councilError = `council: ${String(councilErr?.message || councilErr).slice(0, 300)}`;
      }
    }

    // ── BRAIN V4 P6 (ACT): materialize proposals ──
    // With CompanySettings.brain_autonomy at 'propose' or 'act_scheduling', the suggestions the
    // full synthesis just wrote onto the Landlord become REAL rows — origin='aurora' — surfaced
    // in the Aurora-proposes strip for a human to approve or dismiss (each answer becomes an
    // OutcomeEvent the brain learns from). 'act_scheduling' auto-approves these SCHEDULING rows.
    // At EVERY autonomy level nothing here sends anything to a landlord — sending remains a
    // human pressing Send. 'off' preserves pure-suggestion V3 behavior. Never runs in eval_mode
    // (eval returns before any persistence above).
    let proposalsCreated = 0;
    if (effectiveTier === 'full') {
      try {
        const settingsRows = await svc.entities.CompanySettings.list('-created_date', 1).catch(() => []);
        const autonomy = settingsRows?.[0]?.brain_autonomy || 'off';
        if (autonomy === 'propose' || autonomy === 'act_scheduling') {
          const proposalStatus = autonomy === 'act_scheduling' ? 'approved' : 'proposed';
          // Belt-and-braces dedupe beyond the suggestion filter: never two live aurora rows for
          // the same template_key, and never re-propose a key a human dismissed in the last 14d.
          const cutoff = Date.now() - 14 * 86400000;
          const deadKeys = new Set();
          for (const f of followups) {
            if (!f || typeof f.ai_source !== 'string' || !f.ai_source) continue;
            if (f.status === 'pending') deadKeys.add(f.ai_source);
            else if (f.proposal_status === 'dismissed' && new Date(f.updated_date || 0).getTime() > cutoff) deadKeys.add(f.ai_source);
          }
          for (const t of tasks) {
            if (!t || typeof t.ai_source !== 'string' || !t.ai_source) continue;
            deadKeys.add(t.ai_source);
          }
          const openProposals =
            followups.filter((f) => f && f.origin === 'aurora' && f.proposal_status === 'proposed' && f.status === 'pending').length +
            tasks.filter((t) => t && t.origin === 'aurora' && t.proposal_status === 'proposed' && !t.done).length;
          let budget = Math.max(0, 4 - openProposals); // max 4 live proposals per landlord
          const titleize = (key) => String(key || '').split('_').map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
          for (const f of (Array.isArray(update.ai_suggested_followups) ? update.ai_suggested_followups : [])) {
            if (budget <= 0) break;
            if (deadKeys.has(f.template_key)) continue;
            const hourDxb = Math.min(21, Math.max(9, (typeof f.suggested_hour === 'number') ? f.suggested_hour : 10)); // quiet hours are LAW
            const when = new Date(Date.now() + ((typeof f.when_offset_days === 'number') ? f.when_offset_days : 1) * 86400000);
            when.setUTCHours((hourDxb - 4 + 24) % 24, 0, 0, 0); // Asia/Dubai = UTC+4, no DST
            await svc.entities.Followup.create({
              landlord_id: landlord.id,
              title: `Aurora: ${titleize(f.template_key)}`,
              notes: `${f.reason || ''}\nProposed by LANDLORD AURORA (${f.channel || 'whatsapp'} touch). Approve or dismiss on the landlord card — nothing is ever sent without a human pressing Send.`.trim(),
              scheduled_at: when.toISOString(),
              status: 'pending',
              kind: 'follow_up',
              priority: 'normal',
              agent_email: landlord.assigned_agent_email || '',
              created_from_ai: true,
              ai_source: f.template_key,
              origin: 'aurora',
              proposal_status: proposalStatus,
            });
            deadKeys.add(f.template_key); budget--; proposalsCreated++;
          }
          for (const t of (Array.isArray(update.ai_suggested_tasks) ? update.ai_suggested_tasks : [])) {
            if (budget <= 0) break;
            if (deadKeys.has(t.template_key)) continue;
            await svc.entities.LandlordTask.create({
              landlord_id: landlord.id,
              title: `Aurora: ${titleize(t.template_key)}`,
              description: String(t.reason || '').slice(0, 900),
              due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
              assignee_email: landlord.assigned_agent_email || '',
              created_from_ai: true,
              ai_source: t.template_key,
              origin: 'aurora',
              proposal_status: proposalStatus,
            });
            deadKeys.add(t.template_key); budget--; proposalsCreated++;
          }
        }
      } catch (actErr) {
        console.error('P6 ACT materialization failed (non-fatal):', actErr?.message);
      }
    }

    // BRAIN V4 P10: one BrainRunLog row per completed run (self-monitoring; non-fatal).
    await logRun({
      tier: effectiveTier, model: modelUsed, error: councilError, council: councilConvened,
      tool_calls: cortexTelemetry.tool_calls, tools_used: cortexTelemetry.tools_used,
      tokens_in: cortexTelemetry.tokens_in, tokens_out: cortexTelemetry.tokens_out,
    });

    return Response.json({ ok: true, tier: effectiveTier, tool_calls: cortexTelemetry.tool_calls, council: councilConvened, proposals_created: proposalsCreated, ...update });
  } catch (error) {
    console.error('landlordOrchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});