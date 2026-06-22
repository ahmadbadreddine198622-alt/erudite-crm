import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Backfill cold-tier AI analysis across all landlords where ai_processed_at is empty.
// Processes in batches of 50 to avoid timeouts.
// Call with: { "batch_size": 50, "skip": 0 }
// Returns: { processed: number, skipped: number, failures: Array, has_more: boolean, next_skip: number }

const BATCH_SIZE_DEFAULT = 50;

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

  // Fetch landlords without ai_processed_at
  const landlords = await svc.entities.Landlord.filter(
    { ai_processed_at: null },
    'created_date',
    batchSize,
    skip
  );

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

  const results = { processed: 0, skipped: 0, failures: [] };

  for (const landlord of landlords) {
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

      await svc.entities.Landlord.update(landlord.id, updatePayload);
      results.processed++;
    } catch (err) {
      results.failures.push({ 
        landlord_id: landlord.id, 
        error: err.message || String(err) 
      });
      results.skipped++;
    }
  }

  const hasMore = landlords.length === batchSize;
  const nextSkip = hasMore ? skip + batchSize : null;

  return Response.json({
    status: 'in_progress',
    batch_info: {
      batch_size: batchSize,
      skip,
      fetched: landlords.length,
    },
    processed: results.processed,
    skipped: results.skipped,
    failures: results.failures.slice(0, 10), // Limit to first 10 failures
    has_more: hasMore,
    next_skip: nextSkip,
    summary: `Processed ${results.processed}/${landlords.length} landlords. ${results.failures.length} failures.`
  });
});