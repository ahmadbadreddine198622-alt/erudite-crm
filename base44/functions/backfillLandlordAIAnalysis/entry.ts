import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Backfill cold-tier AI analysis across all landlords where ai_processed_at is empty.
// Processes in batches of 50 to avoid timeouts.
// Call with: { "batch_size": 50, "skip": 0 }
// Returns: { processed: number, skipped: number, failures: Array, has_more: boolean, next_skip: number }

const BATCH_SIZE_DEFAULT = 50;

// ── Handoff bounding (180s ceiling + 429 safety) — mirrors backfillLandlordBrainV2 ──
// Engaged leads route to landlordOrchestrator (full/Opus). Opus is slow, so handoffs are bounded
// by a count cap AND a wall-clock budget; when hit we DEFER the rest (leave unprocessed for the
// next sweep). Backoff between invokes avoids 429s; a 429 backs off the whole sweep.
const TIME_BUDGET_MS = 150_000;
const HANDOFF_RESERVE_MS = 30_000;
const MAX_HANDOFFS_DEFAULT = 4;
const HANDOFF_BACKOFF_MS = 1500;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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

function isRateLimit(err) {
  const s = `${err?.status || ''} ${err?.message || err || ''}`.toLowerCase();
  return s.includes('429') || s.includes('rate limit') || s.includes('rate_limit') || s.includes('too many requests');
}

function computeColdUrgency(landlord) {
  // Base urgency from stage
  let score = 40;
  if (landlord.stage === 'initial_contact') score = 50;
  else if (landlord.stage === 'price_discovery') score = 60;
  else if (landlord.stage === 'listing_commitment') score = 70;
  else if (landlord.stage === 'form_a_initiation' || landlord.stage === 'form_a_signing') score = 80;
  else if (landlord.stage === 'owner_documents' || landlord.stage === 'photos_videos') score = 85;
  else if (landlord.stage === 'listing_creation' || landlord.stage === 'internal_verification') score = 90;
  else if (landlord.stage === 'listing_publication' || landlord.stage === 'final_confirmation') score = 95;
  else if (landlord.stage === 'marketing_agents' || landlord.stage === 'marketing_network') score = 80;
  else if (landlord.stage === 'open_house' || landlord.stage === 'client_blast') score = 90;
  else if (landlord.stage === 'deal_closed') score = 100;
  
  // Adjust for days_on_market
  if (landlord.days_on_market) {
    if (landlord.days_on_market > 90) score = Math.min(100, score + 15);
    else if (landlord.days_on_market > 60) score = Math.min(100, score + 10);
    else if (landlord.days_on_market > 30) score = Math.min(100, score + 5);
  }
  
  // Adjust for competition
  if (landlord.is_currently_listed_with_others || landlord.competing_brokers_count > 0) {
    score = Math.min(100, score + 10);
  }
  
  return Math.min(100, Math.max(0, score));
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) {}
  
  const batchSize = body.batch_size || BATCH_SIZE_DEFAULT;
  const skip = body.skip || 0;
  const forceCold = body.force_cold === true;
  const maxHandoffs = body.max_handoffs || MAX_HANDOFFS_DEFAULT;
  const startTime = Date.now();

  // Eligibility: scan the full list and apply the SAME predicate as backfillLandlordBrainV2 —
  // never-processed OR failed OR needs_retry. A server-side {ai_processed_at: null} filter can't
  // express this (needs_retry records have a non-null ai_processed_at), so scan + filter in code.
  const allLandlords = await svc.entities.Landlord.list('-created_date', 5000);
  const allUnprocessed = (allLandlords || []).filter(l => !l.ai_processed_at || l.ai_processing_status === 'failed' || l.ai_processing_status === 'needs_retry');
  const landlords = allUnprocessed.slice(skip, skip + batchSize);

  if (!landlords || landlords.length === 0) {
    return Response.json({ 
      status: 'complete', 
      processed: 0, 
      skipped: 0, 
      failures: [],
      has_more: false,
      next_skip: null 
    });
  }

  const results = { processed: 0, skipped: 0, handed_off: 0, deferred_handoffs: 0, failures: [] };
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

    // ── Engaged → hand off to the orchestrator (single thesis-capable path). This is a
    // deterministic cold-stamp function with NO Opus path of its own — engaged leads route OUT. ──
    if (tier === 'full') {
      if (landlord.last_orchestrator_run_at) {
        const hoursSince = (Date.now() - new Date(landlord.last_orchestrator_run_at).getTime()) / 3.6e6;
        if (hoursSince < 6) { continue; }
      }
      const elapsed = Date.now() - startTime;
      if (handoffsThisRun >= maxHandoffs || elapsed > (TIME_BUDGET_MS - HANDOFF_RESERVE_MS)) {
        results.deferred_handoffs++;
        continue; // DEFER — leave unprocessed for the next sweep
      }
      try {
        await svc.functions.invoke('landlordOrchestrator', { landlord_id: landlord.id, force: true, tier: 'full' });
        handoffsThisRun++;
        results.handed_off++;
      } catch (err) {
        // 429 / any failure → leave UNPROCESSED (no stamp) so the next cycle retries.
        results.failures.push({ landlord_id: landlord.id, stage: 'handoff', error: err.message || String(err) });
        if (isRateLimit(err)) { rateLimited = true; break; }
      }
      await sleep(HANDOFF_BACKOFF_MS);
      continue;
    }

    // ── Cold → deterministic cold-stamp (existing path) ──
    try {
      // Cold-tier update: no conversation data, so write minimal fields
      const updatePayload = {
        ai_processed_at: new Date().toISOString(),
        ai_rolling_summary: `Cold lead - no conversation yet. ${landlord.full_name_en || landlord.first_name || 'Landlord'} (${landlord.phone || 'no phone'}). Stage: ${landlord.stage || 'initial_contact'}. Archetype: ${(landlord.landlord_archetype || 'individual_end_user_relocating').replace(/_/g, ' ')}.`,
        ai_next_best_action: {
          action: 'Initiate first contact via WhatsApp or phone call',
          priority: landlord.stage === 'initial_contact' ? 'urgent' : 'high',
          reasoning: `No conversation history exists. Landlord is at ${landlord.stage || 'initial contact'} stage. ${landlord.is_currently_listed_with_others ? 'Currently listed with other brokers.' : ''}`,
        },
        // Urgency from stage + days_on_market
        urgency_score: computeColdUrgency(landlord),
        urgency_score_rationale: 'Baseline urgency from pipeline stage and days on market - no conversation data available.',
      };
      
      // Set archetype hints if source suggests it
      if (landlord.source === 'dld_lookup' || landlord.source === 'expired_listing') {
        updatePayload.landlord_archetype = 'professional_investor';
      } else if (landlord.source === 'referral' || landlord.source === 'warm_intro') {
        updatePayload.landlord_archetype = 'individual_end_user_relocating';
      }

      // STATUS CORRECTNESS: only "completed" when valid core output exists — both ai_rolling_summary
      // AND ai_next_best_action non-null. Otherwise needs_retry with a clear review_reason. Applied
      // identically across all three writers. (Cold tier builds both fields above, so this normally
      // passes — the gate guards against a future change that drops one.)
      const hasSummary = typeof updatePayload.ai_rolling_summary === 'string' && updatePayload.ai_rolling_summary.trim().length > 0;
      const hasNBA = !!(updatePayload.ai_next_best_action && typeof updatePayload.ai_next_best_action === 'object'
        && typeof updatePayload.ai_next_best_action.action === 'string' && updatePayload.ai_next_best_action.action.trim().length > 0);
      const isValidRun = hasSummary && hasNBA;
      updatePayload.ai_processing_status = isValidRun ? 'completed' : 'needs_retry';
      if (!isValidRun) {
        updatePayload.review_reason = `needs_retry: hollow run — ${!hasSummary ? 'ai_rolling_summary missing' : ''}${(!hasSummary && !hasNBA) ? ' & ' : ''}${!hasNBA ? 'ai_next_best_action missing' : ''}`;
      }

      await svc.entities.Landlord.update(landlord.id, updatePayload);

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
          orchestrator_run_at: updatePayload.last_orchestrator_run_at || updatePayload.ai_processed_at || new Date().toISOString(),
          ai_model_used: updatePayload.ai_model_used || null,
          stage: updatePayload.stage || landlord.stage || null,
          sub_stage: (updatePayload.sub_stage != null) ? updatePayload.sub_stage : (landlord.sub_stage || null),
          days_in_stage: (typeof updatePayload.days_in_stage === 'number') ? updatePayload.days_in_stage : null,
          trust_score: (updatePayload.trust_score != null) ? updatePayload.trust_score : null,
          responsiveness_score: (updatePayload.responsiveness_score != null) ? updatePayload.responsiveness_score : null,
          mandate_win_probability: (updatePayload.mandate_win_probability != null) ? updatePayload.mandate_win_probability : null,
          urgency_score: (updatePayload.urgency_score != null) ? updatePayload.urgency_score : null,
          rapport_level: updatePayload.rapport_level || null,
          ai_momentum: updatePayload.ai_momentum || null,
          ai_strike_now: (updatePayload.ai_strike_now != null) ? updatePayload.ai_strike_now : null,
          needs_human_review: (updatePayload.needs_human_review != null) ? updatePayload.needs_human_review : null,
          review_reason: updatePayload.review_reason || null,
        });
      } catch (snapErr) {
        console.error('LandlordScoreSnapshot create failed (non-fatal):', snapErr?.message);
      }

      results.processed++;
    } catch (err) {
      results.failures.push({ 
        landlord_id: landlord.id, 
        error: err.message || String(err) 
      });
      results.skipped++;
    }
  }

  // Stop paging forward if we got rate-limited (let the limit recover, re-run from the same skip).
  // Deferred handoffs stay at ai_processed_at:null and reappear in a later skip-paged pass.
  const hasMore = !rateLimited && landlords.length === batchSize;
  const nextSkip = hasMore ? skip + batchSize : null;

  return Response.json({
    status: rateLimited ? 'rate_limited' : 'in_progress',
    batch_info: {
      batch_size: batchSize,
      skip,
      fetched: landlords.length,
      max_handoffs: maxHandoffs,
      elapsed_ms: Date.now() - startTime,
      rate_limited: rateLimited
    },
    processed: results.processed,
    skipped: results.skipped,
    handed_off: results.handed_off,
    deferred_handoffs: results.deferred_handoffs,
    failures: results.failures.slice(0, 10), // Limit to first 10 failures
    has_more: hasMore,
    next_skip: nextSkip,
    summary: `Cold-stamped ${results.processed}, handed off ${results.handed_off} to orchestrator${results.deferred_handoffs ? `, deferred ${results.deferred_handoffs} handoffs` : ''}${rateLimited ? ' (rate-limited — backed off)' : ''}. ${results.failures.length} failures.`
  });
});