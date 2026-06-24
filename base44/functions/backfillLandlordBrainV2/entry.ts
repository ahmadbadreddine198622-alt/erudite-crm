import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

// Backfill V2 full-tier AI brain across all landlords where ai_processed_at is null.
// Performs analysis inline (same logic as landlordOrchestrator) to avoid auth issues.
// Processes in batches of 10-15 with delays to respect Anthropic API rate limits.
// Sets ai_processing_status: in_progress → completed/failed.
// Stamps ai_processed_at, last_orchestrator_run_at, ai_model_used on success.
// Call with: { "batch_size": 10, "delay_ms": 2000 } or use defaults.
// Returns: { processed, failures, has_more, next_skip }

const BATCH_SIZE_DEFAULT = 10;
const DELAY_MS_DEFAULT = 3000;

// ── Handoff bounding (180s ceiling + 429 safety) ──
// Engaged leads are routed to landlordOrchestrator (full/Opus tier) via a synchronous invoke.
// Opus is much slower than the inline Haiku path, so handoffs are doubly bounded: a hard count
// cap AND a wall-clock budget. When either is hit we STOP handing off and DEFER the rest —
// leaving them unprocessed (not stamped) so the next sweep picks them up. Same resumable pattern
// as the cold path. HANDOFF_BACKOFF_MS spaces out Opus calls to avoid 429s.
const TIME_BUDGET_MS = 150_000;       // hard wall-clock stop (margin under the 180s ceiling)
const HANDOFF_RESERVE_MS = 30_000;    // headroom reserved for one in-flight Opus call + its write
const MAX_HANDOFFS_DEFAULT = 4;       // cap Opus handoffs per invocation
const HANDOFF_BACKOFF_MS = 1500;      // backoff between handoff invokes

// ── Shared tier router — KEEP IN SYNC across all 3 writers (landlordOrchestrator,
// backfillLandlordBrainV2, backfillLandlordAIAnalysis). forceCold wins → engagement upgrades
// cold→full → else requested/cold. (Full doc in landlordOrchestrator.)
function resolveTier({ landlord, hasInbound, hasActivity, forceCold = false, requestedTier }) {
  if (forceCold === true) return 'cold';
  const stageEngaged = !!landlord.stage && landlord.stage !== 'initial_contact';
  const rapportEngaged = !!landlord.rapport_level && landlord.rapport_level !== 'cold';
  const contactEngaged = !!hasInbound || !!hasActivity;
  if (stageEngaged || rapportEngaged || contactEngaged) return 'full';
  return requestedTier === 'full' ? 'full' : 'cold';
}

// True if the error looks like a rate limit (HTTP 429 / "rate limit"). On these we back off the
// whole sweep rather than hammering further.
function isRateLimit(err) {
  const s = `${err?.status || ''} ${err?.message || err || ''}`.toLowerCase();
  return s.includes('429') || s.includes('rate limit') || s.includes('rate_limit') || s.includes('too many requests');
}

const STAGES = [
  'initial_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation', 'form_a_signing',
  'owner_documents', 'photos_videos', 'photographer_scheduling', 'listing_creation', 'internal_verification',
  'listing_publication', 'final_confirmation', 'marketing_agents', 'marketing_network', 'open_house',
  'client_blast', 'deal_closed'
];

const TASK_TEMPLATE_KEYS = [
  'chase_document', 'clarify_price', 'reduce_price', 'send_comps', 'book_call',
  'book_viewing', 'schedule_photographer', 'get_mandate_signed', 'follow_up_silence',
  'switch_channel', 'verify_permit', 'publish_listing'
];

const FOLLOWUP_TEMPLATE_KEYS = [
  'post_call_recap', 'silence_nudge_24h', 'silence_nudge_72h', 'docs_reminder',
  'price_check_in', 'post_viewing_followup', 'weekly_touch', 'mandate_renewal_warn'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeLandlord(base44, landlord) {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  
  // Gather context
  const [properties, activities, docs, conversations] = await Promise.all([
    base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id: landlord.id }).catch(() => []),
    base44.asServiceRole.entities.Activity.filter({ lead_id: landlord.id }, '-created_at', 20).catch(() => []),
    base44.asServiceRole.entities.DocumentChecklistItem.filter({ landlord_id: landlord.id }).catch(() => []),
    base44.asServiceRole.entities.WhatsAppMessage.filter({ landlord_id: landlord.id }, '-timestamp', 50).catch(() => [])
  ]);

  const stageIdx = STAGES.indexOf(landlord.stage);
  const daysInStage = landlord.stage_entered_at
    ? Math.floor((Date.now() - new Date(landlord.stage_entered_at).getTime()) / 86400000)
    : 0;
  const docsReceived = docs.filter(d => d.status === 'received' || d.status === 'verified').length;
  const docsTotal = docs.filter(d => d.status !== 'not_required').length;
  const docsCompletionPct = docsTotal > 0 ? (docsReceived / docsTotal) * 100 : 0;

  // COLD-ONLY: this backfill no longer runs the Opus/full path. Engaged leads are handed off to
  // landlordOrchestrator (the single thesis-capable path) in the loop below — they never reach here.
  // So this is always the lighter Haiku model.
  const hasConversation = conversations && conversations.length > 0;
  const modelToUse = 'claude-haiku-4-5';

  const systemPrompt = `You are LANDLORD AURORA — an autonomous AI co-pilot for a Dubai real-estate agent pursuing landlord mandates.

Analyze this landlord and output JSON with these fields:
- ai_rolling_summary: 3-5 sentences on relationship state
- ai_next_best_action: { action, priority (low|medium|high|urgent), reasoning }
- ai_coaching_for_agent: 1-2 specific actionable sentences
- trust_score: 0-100
- urgency_score: 0-100
- mandate_win_probability: 0-1
- rapport_level: cold|warming|rapport_built|trust_established|champion
- red_flags: array of strings
- buying_signals: array of strings
- ai_momentum: accelerating|steady|slowing|stalled
- ai_strike_now: boolean
- ai_suggested_tasks: array of { template_key, reason } (3-5 items, keys from: ${TASK_TEMPLATE_KEYS.join(', ')})
- ai_suggested_followups: array of { template_key, when_offset_days, suggested_hour, channel, reason } (2-4 items, keys from: ${FOLLOWUP_TEMPLATE_KEYS.join(', ')})

Rules:
- Be specific and evidence-based. No generic advice.
- If insufficient data, use neutral scores and note 'insufficient_contact_data' in red_flags.
- Tasks and follow-ups must match current stage and situation.`;

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
${properties.slice(0, 5).map(p => `- ${p.unit_number || p.id}: asking ${p.asking_price_aed || '?'} AED`).join('\n') || '(none)'}

DOCUMENTS: ${docsReceived}/${docsTotal} received (${docsCompletionPct.toFixed(0)}%)

RECENT ACTIVITIES (${activities.length}):
${activities.slice(0, 10).map(a => `- ${a.created_at}: ${a.type} — ${a.title || a.description || '?'}`).join('\n') || '(no activities yet)'}

WHATSAPP MESSAGES (${conversations.length}):
${hasConversation ? 'Conversation history exists - analyze tone and engagement' : 'No conversation yet - cold outreach needed'}

PRIOR ROLLING SUMMARY:
${landlord.ai_rolling_summary || '(none)'}

Analyze and emit JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = response.content[0]?.text;
    if (!text) return null;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr.message);
      return null;
    }
    
    // Normalize suggested_hour to numbers (Claude sometimes returns strings like "same day")
    if (Array.isArray(result.ai_suggested_followups)) {
      result.ai_suggested_followups = result.ai_suggested_followups.map(f => {
        if (f && typeof f.suggested_hour === 'string') {
          const numMatch = f.suggested_hour.match(/\d+/);
          f.suggested_hour = numMatch ? parseInt(numMatch[0], 10) : 10;
        } else if (f && (f.suggested_hour == null || isNaN(f.suggested_hour))) {
          f.suggested_hour = 10;
        }
        return f;
      });
    }
    
    // Normalize ai_coaching_for_agent to string (Claude sometimes returns array)
    if (Array.isArray(result.ai_coaching_for_agent)) {
      result.ai_coaching_for_agent = result.ai_coaching_for_agent.join(' ');
    }
    
    return { ...result, model_used: modelToUse };
  } catch (err) {
    console.error('Claude call failed:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  
  const batchSize = body.batch_size || BATCH_SIZE_DEFAULT;
  const delayMs = body.delay_ms || DELAY_MS_DEFAULT;
  const skip = body.skip || 0;
  const forceCold = body.force_cold === true;          // deliberate bulk cost-control: stay cold even for engaged
  const maxHandoffs = body.max_handoffs || MAX_HANDOFFS_DEFAULT;
  const startTime = Date.now();

  // Fetch ALL landlords, then filter client-side for unprocessed ones.
  // (Base44 filter doesn't support $or, and a shallow paged window can sit entirely on
  // already-processed records — falsely reporting "complete" while unprocessed records remain
  // deeper in the list. Scanning the full list is the only reliable way to find them all.)
  const allLandlords = await svc.entities.Landlord.list('-created_date', 5000);
  const allUnprocessed = (allLandlords || []).filter(l => !l.ai_processed_at || l.ai_processing_status === 'failed');
  console.log(`Found ${allUnprocessed.length} unprocessed landlords total`);
  const landlords = allUnprocessed.slice(0, batchSize);

  if (!landlords || landlords.length === 0) {
    return Response.json({ 
      status: 'complete', 
      processed: 0, 
      failures: [],
      has_more: false,
      next_skip: null,
      remaining: 0,
      message: 'Backfill complete - no remaining unprocessed landlords'
    });
  }

  const results = { processed: 0, handed_off: 0, deferred_handoffs: 0, failures: [] };
  let handoffsThisRun = 0;
  let rateLimited = false;

  for (const landlord of landlords) {
    // ── Tier routing ── Engagement is decided ONLY from stage/rapport already on the record — NO
    // per-lead message/activity query (avoids the 429 surface of up to 2 queries × batch size, and
    // avoids depending on unverified entity names). A contact-engaged lead that is still
    // initial_contact + cold stays cold here; it gets upgraded to full the instant it replies, via
    // routeWhatsAppMessage → orchestrator (which loads real messages/activities). This is sufficient
    // because contact-engaged leads are nearly always already past initial_contact or warmer.
    const tier = resolveTier({ landlord, hasInbound: false, hasActivity: false, forceCold, requestedTier: 'cold' });

    // ── Engaged → hand off to the orchestrator (single thesis-capable path) ──
    if (tier === 'full') {
      // Skip if the orchestrator already ran recently (<6h) — it would no-op the debounce anyway,
      // and it's already out of the unprocessed set. No wasted Opus call.
      if (landlord.last_orchestrator_run_at) {
        const hoursSince = (Date.now() - new Date(landlord.last_orchestrator_run_at).getTime()) / 3.6e6;
        if (hoursSince < 6) { continue; }
      }
      // Bounding: stop handing off when the count cap OR the time budget is nearly spent. DEFER the
      // rest — leave them UNPROCESSED (no status write, no stamp) so the next sweep picks them up.
      const elapsed = Date.now() - startTime;
      if (handoffsThisRun >= maxHandoffs || elapsed > (TIME_BUDGET_MS - HANDOFF_RESERVE_MS)) {
        results.deferred_handoffs++;
        continue;
      }
      try {
        // Synchronous handoff. force:true beats the 6h debounce (its ONLY skip gate — confirmed safe,
        // the orchestrator is stateless and re-analysis every run is its contract). On success the
        // orchestrator stamps ai_processed_at itself, so the backfill writes NOTHING to this lead.
        await svc.functions.invoke('landlordOrchestrator', { landlord_id: landlord.id, force: true, tier: 'full' });
        handoffsThisRun++;
        results.handed_off++;
      } catch (err) {
        // 429 or any failure → LEAVE THE LEAD UNPROCESSED (no status, no stamp) so the next cycle
        // retries it. On a rate limit, back off the WHOLE sweep — stop handing off this run.
        results.failures.push({ landlord_id: landlord.id, stage: 'handoff', error: err.message || String(err) });
        if (isRateLimit(err)) { rateLimited = true; break; }
      }
      await sleep(HANDOFF_BACKOFF_MS);
      continue;
    }

    // ── Cold → inline Haiku analysis (existing path) ──
    try {
      // Mark as in_progress
      await svc.entities.Landlord.update(landlord.id, {
        ai_processing_status: 'in_progress'
      });

      // Run analysis inline
      const analysis = await analyzeLandlord(base44, landlord);

      if (!analysis) {
        throw new Error('Claude analysis returned null');
      }

      // Build update payload
      const update = {
        ai_rolling_summary: analysis.ai_rolling_summary || null,
        ai_next_best_action: analysis.ai_next_best_action || null,
        ai_coaching_for_agent: analysis.ai_coaching_for_agent || null,
        trust_score: typeof analysis.trust_score === 'number' ? Math.max(0, Math.min(100, analysis.trust_score)) : null,
        urgency_score: typeof analysis.urgency_score === 'number' ? Math.max(0, Math.min(100, analysis.urgency_score)) : null,
        mandate_win_probability: typeof analysis.mandate_win_probability === 'number' ? Math.max(0, Math.min(1, analysis.mandate_win_probability)) : null,
        rapport_level: ['cold', 'warming', 'rapport_built', 'trust_established', 'champion'].includes(analysis.rapport_level) ? analysis.rapport_level : 'cold',
        red_flags: Array.isArray(analysis.red_flags) ? analysis.red_flags : [],
        buying_signals: Array.isArray(analysis.buying_signals) ? analysis.buying_signals : [],
        ai_momentum: ['accelerating', 'steady', 'slowing', 'stalled'].includes(analysis.ai_momentum) ? analysis.ai_momentum : 'steady',
        ai_strike_now: analysis.ai_strike_now === true,
        ai_suggested_tasks: Array.isArray(analysis.ai_suggested_tasks) 
          ? analysis.ai_suggested_tasks.filter(t => t && TASK_TEMPLATE_KEYS.includes(t.template_key)).slice(0, 5)
          : [],
        ai_suggested_followups: Array.isArray(analysis.ai_suggested_followups)
          ? analysis.ai_suggested_followups.filter(f => f && FOLLOWUP_TEMPLATE_KEYS.includes(f.template_key)).slice(0, 4)
          : [],
        ai_processed_at: new Date().toISOString(),
        last_orchestrator_run_at: new Date().toISOString(),
        ai_model_used: analysis.model_used || 'claude-haiku-4-5'
      };

      // STATUS CORRECTNESS: only "completed" when valid core output exists — both ai_rolling_summary
      // AND ai_next_best_action non-null (non-empty .action). Otherwise needs_retry with a clear
      // review_reason. Identical gate to backfillLandlordAIAnalysis and landlordOrchestrator.
      const hasSummary = typeof update.ai_rolling_summary === 'string' && update.ai_rolling_summary.trim().length > 0;
      const hasNBA = !!(update.ai_next_best_action && typeof update.ai_next_best_action === 'object'
        && typeof update.ai_next_best_action.action === 'string' && update.ai_next_best_action.action.trim().length > 0);
      const isValidRun = hasSummary && hasNBA;
      update.ai_processing_status = isValidRun ? 'completed' : 'needs_retry';
      if (!isValidRun) {
        update.review_reason = `needs_retry: hollow run — ${!hasSummary ? 'ai_rolling_summary missing' : ''}${(!hasSummary && !hasNBA) ? ' & ' : ''}${!hasNBA ? 'ai_next_best_action missing' : ''}`;
      }

      await svc.entities.Landlord.update(landlord.id, update);

      // KEEP IN SYNC across all 3 writers (landlordOrchestrator, backfillLandlordBrainV2,
      // backfillLandlordAIAnalysis). Append-only score snapshot — exactly ONE per successful
      // Landlord.update, built from the values just written. Non-fatal: a failure here must never
      // break the writer. Forward-only — never fabricates historical snapshots.
      // Logic identical across all 3 EXCEPT (1) payload var name (update vs updatePayload),
      // (2) the orchestrator's days_in_stage falls back to the computed daysInStage variable
      // (in scope there only) — this backfill keeps null; do NOT add daysInStage here.
      try {
        await svc.entities.LandlordScoreSnapshot.create({
          landlord_id: landlord.id,
          captured_at: new Date().toISOString(),
          orchestrator_run_at: update.last_orchestrator_run_at || update.ai_processed_at || new Date().toISOString(),
          ai_model_used: update.ai_model_used || null,
          stage: update.stage || landlord.stage || null,
          sub_stage: (update.sub_stage != null) ? update.sub_stage : (landlord.sub_stage || null),
          days_in_stage: (typeof update.days_in_stage === 'number') ? update.days_in_stage : null,
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

      results.processed++;
      
      // Rate limit delay between records
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    } catch (err) {
      // Mark as failed and continue
      try {
        await svc.entities.Landlord.update(landlord.id, {
          ai_processing_status: 'failed',
          review_reason: `Backfill error: ${err.message || String(err)}`
        });
      } catch (_) {}
      
      results.failures.push({ 
        landlord_id: landlord.id, 
        error: err.message || String(err) 
      });
    }
  }

  // Both cold-processed and handed-off leads leave the unprocessed set (the orchestrator stamps
  // ai_processed_at on a successful handoff). Deferred + rate-limited + failed handoffs stay in it.
  const remaining = Math.max(0, allUnprocessed.length - results.processed - results.handed_off);
  const hasMore = remaining > 0;

  return Response.json({
    status: rateLimited ? 'rate_limited' : 'in_progress',
    batch_info: {
      batch_size: batchSize,
      fetched: landlords.length,
      delay_ms: delayMs,
      max_handoffs: maxHandoffs,
      elapsed_ms: Date.now() - startTime,
      rate_limited: rateLimited
    },
    processed: results.processed,
    handed_off: results.handed_off,
    deferred_handoffs: results.deferred_handoffs,
    failures: results.failures.slice(0, 20),
    has_more: hasMore,
    remaining,
    next_skip: null,
    summary: `Cold-processed ${results.processed}, handed off ${results.handed_off} to orchestrator${results.deferred_handoffs ? `, deferred ${results.deferred_handoffs} handoffs` : ''}${rateLimited ? ' (rate-limited — backed off)' : ''}. ${remaining} remaining. ${results.failures.length} failures.`
  });
});