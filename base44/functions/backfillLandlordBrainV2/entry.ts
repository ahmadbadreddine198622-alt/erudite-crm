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

  const hasConversation = conversations && conversations.length > 0;
  const modelToUse = hasConversation ? 'claude-opus-4-8' : 'claude-haiku-4-5';

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

    const result = JSON.parse(jsonMatch[0]);
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

  // Fetch landlords where ai_processed_at is null (or failed previously)
  const landlords = await svc.entities.Landlord.filter(
    { 
      $or: [
        { ai_processed_at: null },
        { ai_processing_status: 'failed' }
      ]
    },
    'created_date',
    batchSize,
    skip
  );

  if (!landlords || landlords.length === 0) {
    return Response.json({ 
      status: 'complete', 
      processed: 0, 
      failures: [],
      has_more: false,
      next_skip: null,
      message: 'Backfill complete - no remaining unprocessed landlords'
    });
  }

  const results = { processed: 0, failures: [] };

  for (const landlord of landlords) {
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
        ai_processing_status: 'completed',
        ai_processed_at: new Date().toISOString(),
        last_orchestrator_run_at: new Date().toISOString(),
        ai_model_used: analysis.model_used || 'claude-haiku-4-5'
      };

      await svc.entities.Landlord.update(landlord.id, update);
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

  const hasMore = landlords.length === batchSize;
  const nextSkip = hasMore ? skip + batchSize : null;

  return Response.json({
    status: 'in_progress',
    batch_info: {
      batch_size: batchSize,
      skip,
      fetched: landlords.length,
      delay_ms: delayMs
    },
    processed: results.processed,
    failures: results.failures.slice(0, 20),
    has_more: hasMore,
    next_skip: nextSkip,
    summary: `Processed ${results.processed}/${landlords.length} landlords in this batch. ${results.failures.length} failures.`
  });
});