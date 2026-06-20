import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * processCallQualifications
 * Reads unprocessed CallQualification records and updates Landlord AI fields.
 * Input: { landlord_id? } — if provided, processes only that landlord; otherwise batch-processes all.
 */

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

// ── Mappings ─────────────────────────────────────────────────────────────────

const MOTIVATION_TO_ARCHETYPE = {
  relocating: 'individual_end_user_relocating',
  cashing_out: 'professional_investor',
  upgrading_downsizing: 'individual_end_user_relocating',
  distressed_need_funds: 'distressed_seller',
  inherited: 'inherited_owner',
  poor_returns: 'portfolio_optimizer',
};

const TIMELINE_TO_URGENCY = {
  asap_urgent: 90,
  '1_3_months': 70,
  '3_6_months': 50,
  '6_12_months': 30,
  no_rush_testing: 15,
  unknown: null,
};

const MANDATE_TO_PROBABILITY = {
  open_to_exclusive: 0.8,
  non_exclusive_only: 0.5,
  already_with_other_brokers: 0.3,
  wants_to_self_sell: 0.2,
  undecided: 0.4,
  not_discussed: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callClaude(prompt, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (resp.status === 429 || resp.status >= 500) {
      const wait = (attempt + 1) * 3000;
      console.warn(`[processCallQualifications] Claude ${resp.status}, retrying in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    const data = await resp.json();
    return data?.content?.[0]?.text?.trim() || '';
  }
  throw new Error('Claude rate-limited after retries');
}

// ── Per-landlord processor ────────────────────────────────────────────────────

async function processLandlord(svc, landlord, qualifications) {
  if (!qualifications.length) return;

  // Sort oldest → newest; latest is the current state
  const sorted = [...qualifications].sort((a, b) =>
    (a.call_date || '').localeCompare(b.call_date || '')
  );
  const latest = sorted[sorted.length - 1];

  // Load LandlordProperty for valuation
  let lp = null;
  try {
    const lps = await svc.entities.LandlordProperty.filter({ landlord_id: landlord.id });
    lp = lps?.[0] || null;
  } catch (_) {}

  const aiEstimatedValue = lp?.ai_estimated_value_aed || null;
  const aiEstimatedPsf = lp?.ai_estimated_price_sqft || null;

  const updates = {};

  // ── 1. motivation → landlord_archetype ───────────────────────────────────
  if (latest.motivation && MOTIVATION_TO_ARCHETYPE[latest.motivation]) {
    updates.landlord_archetype = MOTIVATION_TO_ARCHETYPE[latest.motivation];
  }

  // ── 2. timeline_urgency → urgency_score ──────────────────────────────────
  const urgencyScore = TIMELINE_TO_URGENCY[latest.timeline_urgency];
  if (urgencyScore != null) {
    updates.urgency_score = urgencyScore;
    const urgencyLabels = {
      asap_urgent: 'wants to transact ASAP',
      '1_3_months': 'targeting 1–3 month timeline',
      '3_6_months': 'targeting 3–6 month timeline',
      '6_12_months': '6–12 month horizon',
      no_rush_testing: 'testing market, no real urgency',
    };
    updates.urgency_score_rationale = `Latest call (${(latest.call_date || '').slice(0, 10)}): ${urgencyLabels[latest.timeline_urgency] || latest.timeline_urgency}.`;
  }

  // ── 3. price_vs_valuation → red_flags ────────────────────────────────────
  const existingRedFlags = Array.isArray(landlord.red_flags) ? [...landlord.red_flags] : [];
  let redFlags = [...existingRedFlags];

  if (latest.price_vs_valuation === 'significantly_overpriced') {
    if (!redFlags.includes('unrealistic_pricing')) redFlags.push('unrealistic_pricing');
  } else {
    // Clear it if no longer overpriced
    redFlags = redFlags.filter(f => f !== 'unrealistic_pricing');
  }

  // ── 4. mandate_openness → mandate_win_probability + red_flags ────────────
  const mandateProb = MANDATE_TO_PROBABILITY[latest.mandate_openness];
  if (mandateProb != null) {
    updates.mandate_win_probability = mandateProb;
    const mandateLabels = {
      open_to_exclusive: 'open to exclusive mandate',
      non_exclusive_only: 'prefers non-exclusive',
      already_with_other_brokers: 'already with other brokers',
      wants_to_self_sell: 'wants to self-sell',
      undecided: 'undecided on mandate type',
    };
    updates.mandate_win_rationale = `Latest call: ${mandateLabels[latest.mandate_openness] || latest.mandate_openness}.`;
  }

  if (latest.mandate_openness === 'already_with_other_brokers') {
    updates.is_currently_listed_with_others = true;
    if (!redFlags.includes('shopping_brokers') && latest.competing_brokers) {
      redFlags.push('shopping_brokers');
    }
  }

  updates.red_flags = redFlags;

  // ── 5. rapport_after_call → rapport_level ────────────────────────────────
  if (latest.rapport_after_call) {
    updates.rapport_level = latest.rapport_after_call;
  }

  // ── 6. Build context string for AI calls ─────────────────────────────────
  const callSummaries = sorted.map((q, i) => {
    const parts = [
      `Call ${i + 1} (${(q.call_date || '').slice(0, 10)})`,
      q.motivation ? `motivation=${q.motivation}` : null,
      q.timeline_urgency ? `timeline=${q.timeline_urgency}` : null,
      q.price_vs_valuation ? `price_vs_valuation=${q.price_vs_valuation}` : null,
      q.price_expectation_aed ? `asking_price=AED ${(q.price_expectation_aed / 1e6).toFixed(2)}M` : null,
      q.mandate_openness ? `mandate=${q.mandate_openness}` : null,
      q.rapport_after_call ? `rapport=${q.rapport_after_call}` : null,
      q.call_outcome ? `outcome=${q.call_outcome}` : null,
      q.tenancy_status ? `tenancy=${q.tenancy_status}` : null,
      q.motivation_notes ? `notes="${q.motivation_notes}"` : null,
      q.agent_notes ? `agent_notes="${q.agent_notes}"` : null,
    ].filter(Boolean);
    return parts.join(', ');
  }).join('\n');

  const valuationContext = aiEstimatedValue
    ? `AI valuation: AED ${(aiEstimatedValue / 1e6).toFixed(2)}M${aiEstimatedPsf ? ` (${aiEstimatedPsf.toLocaleString()} AED/sqft)` : ''}.`
    : 'No AI valuation on file.';

  const landlordContext = [
    `Landlord: ${landlord.full_name_en || landlord.full_name || 'Unknown'}`,
    landlord.project_name ? `Project: ${landlord.project_name}` : null,
    landlord.unit_reference ? `Unit: ${landlord.unit_reference}` : null,
    valuationContext,
  ].filter(Boolean).join(' | ');

  // ── 7. ONE Claude call for rolling_summary, coaching, next_best_action ───
  const latestFollowup = latest.followup_date ? ` Follow-up: ${latest.followup_date}.` : '';

  const prompt = `You are an AI assistant for a Dubai real estate CRM (Erudite Real Estate). Analyse this landlord's call qualification history and produce structured intelligence for the agent.

${landlordContext}

CALL HISTORY (oldest to newest):
${callSummaries}

Respond with ONLY valid JSON in this exact shape — no prose, no markdown:
{
  "ai_rolling_summary": "<2–4 sentence narrative across all calls. e.g. Call 1: testing market, cold. Call 2: warming, mentioned relocation in Q3. Latest: open to exclusive, realistic on price.>",
  "ai_coaching_for_agent": "<1–2 sentences of tactical advice grounded in the data and valuation. Be concrete — mention the price gap or the valuation number if relevant.>",
  "ai_next_best_action": {
    "action": "<short imperative, max 80 chars>",
    "priority": "<urgent|high|medium|low>",
    "reasoning": "<1–2 sentences grounded in the call history>"
  }
}

Rules:
- Use the valuation to anchor price guidance.
- If overpriced, advise comp-based anchoring.
- If not_ready/no_rush, suggest nurture cadence with follow-up date.
- If open_to_exclusive + asap + realistic → push for Form A.
- If asap_urgent use priority "urgent".
- followup_date hint: ${latestFollowup || 'not set'}.`;

  let aiOutput = null;
  try {
    const text = await callClaude(prompt);
    // Strip markdown fences if present
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    aiOutput = JSON.parse(clean);
  } catch (e) {
    console.error(`[processCallQualifications] Claude parse error for landlord ${landlord.id}:`, e?.message);
  }

  if (aiOutput) {
    if (aiOutput.ai_rolling_summary) updates.ai_rolling_summary = aiOutput.ai_rolling_summary;
    if (aiOutput.ai_coaching_for_agent) updates.ai_coaching_for_agent = aiOutput.ai_coaching_for_agent;
    if (aiOutput.ai_next_best_action?.action) {
      updates.ai_next_best_action = aiOutput.ai_next_best_action;
    }
  }

  // ── 8. Write landlord updates + stamp processed_at ────────────────────────
  updates.ai_processed_at = new Date().toISOString();

  await svc.entities.Landlord.update(landlord.id, updates);

  // Mark each qualification as processed
  for (const q of qualifications) {
    try {
      await svc.entities.CallQualification.update(q.id, { ai_processed: true });
    } catch (e) {
      console.warn(`[processCallQualifications] Could not mark qualification ${q.id} processed:`, e?.message);
    }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const singleLandlordId = body.landlord_id || null;

    // Load unprocessed qualifications
    let allQuals;
    if (singleLandlordId) {
      allQuals = await svc.entities.CallQualification.filter({ landlord_id: singleLandlordId });
    } else {
      // Batch: get all unprocessed qualifications
      allQuals = await svc.entities.CallQualification.filter({ ai_processed: false }, '-call_date', 2000);
    }

    if (!allQuals?.length) {
      return Response.json({ ok: true, processed: 0, message: 'No unprocessed qualifications found.' });
    }

    // Group by landlord_id
    const byLandlord = {};
    for (const q of allQuals) {
      if (!q.landlord_id) continue;
      if (!byLandlord[q.landlord_id]) byLandlord[q.landlord_id] = [];
      byLandlord[q.landlord_id].push(q);
    }

    const landlordIds = Object.keys(byLandlord);
    if (!landlordIds.length) {
      return Response.json({ ok: true, processed: 0, message: 'No landlords to process.' });
    }

    // Load all relevant landlords in one shot
    const allLandlords = singleLandlordId
      ? await svc.entities.Landlord.filter({ id: singleLandlordId })
      : await svc.entities.Landlord.list('-created_date', 5000);

    const landlordMap = {};
    for (const l of (allLandlords || [])) {
      landlordMap[l.id] = l;
    }

    let processed = 0;
    const errors = [];

    for (const landlordId of landlordIds) {
      const landlord = landlordMap[landlordId];
      if (!landlord) {
        console.warn(`[processCallQualifications] Landlord ${landlordId} not found, skipping.`);
        continue;
      }

      try {
        await processLandlord(svc, landlord, byLandlord[landlordId]);
        processed++;
        // Throttle: 1.5 s between landlords to respect Claude rate limits in batch mode
        if (!singleLandlordId && landlordIds.length > 1) await sleep(1500);
      } catch (e) {
        console.error(`[processCallQualifications] Error processing landlord ${landlordId}:`, e?.message);
        errors.push({ landlord_id: landlordId, error: e?.message });
      }
    }

    return Response.json({
      ok: true,
      processed,
      skipped: landlordIds.length - processed - errors.length,
      errors: errors.length ? errors : undefined,
      message: `Processed ${processed} landlord(s).`,
    });

  } catch (e) {
    console.error('[processCallQualifications] Fatal:', e?.message, e?.stack);
    return Response.json({ ok: false, error: e?.message }, { status: 500 });
  }
});