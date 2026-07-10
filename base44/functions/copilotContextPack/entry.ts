import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * copilotContextPack — called by the Call Copilot relay at call start.
 * Auth: header `api_key` must match env COPILOT_API_KEY.
 * Body: { call_log_id, landlord_id, agent_email }
 * Returns the landlord intelligence pack + the 14 Brain Qualify questions.
 */

// Mirror of src/components/landlord/qualifyQuestionBank.js (field keys + enum values
// must stay in sync with the CallQualification schema).
const QUALIFY_QUESTIONS = [
  { field_key: 'motivation', question: "What's prompting you to think about selling right now?", type: 'choice', options: ['relocating','cashing_out','upgrading_downsizing','distressed_need_funds','inherited','poor_returns','just_testing_market','other'] },
  { field_key: 'timeline_urgency', question: 'If we brought the right buyer this month, how quickly would you close?', type: 'choice', options: ['asap_urgent','1_3_months','3_6_months','6_12_months','no_rush_testing','unknown'] },
  { field_key: 'price_expectation_aed', question: 'What figure do you have in mind for the unit?', type: 'number' },
  { field_key: 'price_vs_valuation', question: 'How does their asking compare to recent DLD closes?', type: 'choice', options: ['realistic','slightly_high','significantly_overpriced','below_market','not_discussed'] },
  { field_key: 'mandate_openness', question: 'Open to a short exclusive window for a proper launch?', type: 'choice', options: ['open_to_exclusive','non_exclusive_only','already_with_other_brokers','wants_to_self_sell','undecided','not_discussed'] },
  { field_key: 'competing_brokers', question: 'Are other agents already marketing the unit — how many?', type: 'text' },
  { field_key: 'tenancy_status', question: 'Is the unit vacant, owner-occupied, or tenanted?', type: 'choice', options: ['vacant','tenanted_lease_active','tenanted_lease_expiring','owner_occupied','unknown'] },
  { field_key: 'available_from', question: 'When would the unit be available for handover?', type: 'date' },
  { field_key: 'mortgage_status', question: 'Is there a mortgage — local bank or overseas?', type: 'choice', options: ['free_and_clear','mortgaged_local','mortgaged_overseas','payment_plan','unknown'] },
  { field_key: 'is_decision_maker', question: 'Sole owner on the title deed, or jointly held / company?', type: 'choice', options: ['sole_decision_maker','joint_needs_spouse','represents_owner','unknown'] },
  { field_key: 'call_outcome', question: 'Overall outcome of this call?', type: 'choice', options: ['interested_proceeding','needs_followup','callback_requested','thinking_about_it','not_ready','not_interested','no_answer','wrong_number','dead_lead'] },
  { field_key: 'rapport_after_call', question: 'Rapport after this call?', type: 'choice', options: ['cold','warming','rapport_built','trust_established','champion'] },
  { field_key: 'next_step', question: 'What was the agreed next step?', type: 'text' },
  { field_key: 'followup_date', question: 'When should we follow up?', type: 'date' },
];

// Grant Cardone play per pipeline stage — compact context the live brain leans on.
const CARDONE_STAGE_PLAYS = {
  initial_contact: 'FIRST CONTACT: dominate the opening. Give value in 20 seconds (a real DLD data point), earn 3 more minutes. Goal: motivation + one commitment.',
  price_discovery: 'PRICE DISCOVERY: never argue price — anchor to DLD closes, not portal asking. Every price objection is a buying signal. Goal: realistic number + urgency.',
  listing_commitment: 'LISTING COMMITMENT: sell the exclusive as an investment we make in THEM (photography, portal boost, launch). Open listings are a race to the bottom. Goal: verbal yes to Form A window.',
  form_a_initiation: 'FORM A: assume the close. Logistics language only — "I will send the Form A now, sign takes 2 minutes." Time kills deals.',
  default: 'ADVANCE THE DEAL: nothing happens until it is inked. One clear commitment before hanging up. Follow up one more time than any competitor would.',
};

Deno.serve(async (req) => {
  try {
    const expected = Deno.env.get('COPILOT_API_KEY') || '';
    const got = req.headers.get('api_key') || '';
    if (!expected || got !== expected) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { call_log_id, landlord_id, agent_email } = body;

    const pack = {
      call_log_id: call_log_id || null,
      landlord_id: landlord_id || null,
      agent_email: agent_email || null,
      generated_at: new Date().toISOString(),
      qualify_questions: QUALIFY_QUESTIONS,
    };

    if (!landlord_id) {
      pack.warning = 'no landlord_id — generic coaching only';
      return Response.json(pack);
    }

    // ── Landlord intelligence ────────────────────────────────────────────
    const landlords = await sr.entities.Landlord.filter({ id: landlord_id }).catch(() => []);
    const L = landlords?.[0];
    if (!L) {
      pack.warning = `landlord ${landlord_id} not found`;
      return Response.json(pack);
    }

    pack.landlord = {
      name: L.full_name_en || `${L.first_name || ''} ${L.last_name || ''}`.trim(),
      preferred_language: L.preferred_language || L.language || null,
      nationality: L.nationality || null,
      archetype: L.landlord_archetype || null,
      stage: L.stage || null,
      rapport_level: L.rapport_level || null,
      trust_score: L.trust_score ?? null,
      urgency_score: L.urgency_score ?? null,
      responsiveness_score: L.responsiveness_score ?? null,
      mandate_win_probability: L.mandate_win_probability ?? null,
      mandate_status: L.mandate_status || null,
      asking_price_aed: L.asking_price_aed ?? null,
      unit: L.unit || L.unit_reference || null,
      project: L.project_name || null,
      days_in_stage: L.days_in_stage ?? null,
      competing_brokers_count: L.competing_brokers_count ?? null,
      red_flags: L.red_flags || null,
      buying_signals: Array.isArray(L.buying_signals) ? L.buying_signals : [],
    };
    pack.deal_thesis = L.ai_deal_thesis || null;
    pack.next_best_action = L.ai_next_best_action || null;
    pack.rolling_summary = L.ai_rolling_summary || null;
    pack.open_questions = L.ai_open_questions || null;
    pack.known_objections = L.ai_objections || null;
    pack.coaching_for_agent = L.ai_coaching_for_agent || null;
    pack.cardone_stage_play = CARDONE_STAGE_PLAYS[L.stage] || CARDONE_STAGE_PLAYS.default;

    // ── Active Founder's Directive ───────────────────────────────────────
    try {
      const directives = await sr.entities.LandlordDirective.filter(
        { landlord_id, type: 'founder_directive', status: 'active' }, '-created_date', 3
      );
      if (directives?.length) {
        pack.founder_directive = directives.map(d => ({
          text: d.directive_text, priority: d.priority || 'normal',
        }));
      }
    } catch (_) { /* non-fatal */ }

    // ── Unit valuation (LandlordProperty AI valuation) ───────────────────
    try {
      const props = await sr.entities.LandlordProperty.filter({ landlord_id }, '-ai_valuation_updated_at', 5);
      const valued = (props || []).find(p => p.ai_estimated_value_aed);
      if (valued) {
        pack.valuation = {
          estimated_value_aed: valued.ai_estimated_value_aed,
          price_sqft: valued.ai_estimated_price_sqft ?? null,
          confidence: valued.ai_valuation_confidence ?? null,
          basis: valued.ai_valuation_basis ?? null,
          updated_at: valued.ai_valuation_updated_at ?? null,
        };
      }
    } catch (_) { /* non-fatal */ }

    // ── Brand voice (compact) ────────────────────────────────────────────
    try {
      const voices = await sr.entities.BrandVoice.filter({ is_active: true }, '-version', 1);
      const v = voices?.[0];
      if (v) {
        pack.brand_voice = {
          name: v.name,
          charter_excerpt: (v.charter_text || '').slice(0, 900),
          banned_patterns: v.banned_patterns || [],
        };
      }
    } catch (_) { /* non-fatal */ }

    console.log(`[copilotContextPack] served pack for landlord=${landlord_id} call=${call_log_id}`);
    return Response.json(pack);
  } catch (err) {
    console.error('[copilotContextPack] error:', err?.message);
    return Response.json({ error: err?.message || 'internal error' }, { status: 500 });
  }
});
