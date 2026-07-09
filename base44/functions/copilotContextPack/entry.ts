import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// copilotContextPack — returns the full AI + property context for the relay
// server's copilot engine. Called by the app frontend (user auth) OR the relay
// server (api_key header validated against SyncState 'copilot_api_key').
//
// Returns: landlord AI intelligence, active Founder's Directive, unit valuation,
// pipeline stage, BrandVoice charter, and the Brain Qualify question bank with
// CallQualification field keys + answer options.

const QUESTION_BANK = [
  { field_key: 'motivation', area: 'Motivation', question: "What's prompting you to think about selling right now?", input_type: 'choice', options: ['relocating','cashing_out','upgrading_downsizing','distressed_need_funds','inherited','poor_returns','just_testing_market','other','unknown'] },
  { field_key: 'timeline_urgency', area: 'Timeline', question: 'How quickly would you want to close?', input_type: 'choice', options: ['asap_urgent','1_3_months','3_6_months','6_12_months','no_rush_testing','unknown'] },
  { field_key: 'price_expectation_aed', area: 'Price', question: 'What figure did you have in mind?', input_type: 'number' },
  { field_key: 'price_vs_valuation', area: 'Price vs Valuation', question: 'How does asking compare to DLD closes?', input_type: 'choice', options: ['realistic','slightly_high','significantly_overpriced','below_market','not_discussed'] },
  { field_key: 'mandate_openness', area: 'Mandate', question: 'Would you give one agent exclusivity?', input_type: 'choice', options: ['open_to_exclusive','non_exclusive_only','already_with_other_brokers','wants_to_self_sell','undecided','not_discussed'] },
  { field_key: 'competing_brokers', area: 'Competing Brokers', question: 'Are other agents marketing the unit?', input_type: 'text' },
  { field_key: 'tenancy_status', area: 'Tenancy', question: 'Is the unit vacant, owner-occupied, or tenanted?', input_type: 'choice', options: ['vacant','tenanted_lease_active','tenanted_lease_expiring','owner_occupied','unknown'] },
  { field_key: 'available_from', area: 'Available From', question: 'When would the unit be available for handover?', input_type: 'date' },
  { field_key: 'mortgage_status', area: 'Mortgage', question: 'Is there a mortgage on the property?', input_type: 'choice', options: ['free_and_clear','mortgaged_local','mortgaged_overseas','payment_plan','unknown'] },
  { field_key: 'is_decision_maker', area: 'Decision Maker', question: 'Are you the sole owner on the title deed?', input_type: 'choice', options: ['sole_decision_maker','joint_needs_spouse','represents_owner','unknown'] },
  { field_key: 'call_outcome', area: 'Call Outcome', question: 'What was the overall outcome?', input_type: 'choice', options: ['interested_proceeding','needs_followup','callback_requested','thinking_about_it','not_ready','not_interested','no_answer','wrong_number','dead_lead'] },
  { field_key: 'rapport_after_call', area: 'Rapport', question: 'How would you rate the rapport?', input_type: 'choice', options: ['cold','warming','rapport_built','trust_established','champion'] },
  { field_key: 'next_step', area: 'Next Step', question: 'What was the agreed next step?', input_type: 'text' },
  { field_key: 'followup_date', area: 'Follow-Up Date', question: 'When should we follow up?', input_type: 'date' },
];

async function validateApiKey(base44, req) {
  const apiKey = req.headers.get('api_key') || req.headers.get('x-api-key') || '';
  if (!apiKey) return false;
  const existing = await base44.asServiceRole.entities.SyncState.filter({ key: 'copilot_api_key' });
  if (!existing || existing.length === 0) {
    // Bootstrap: store the first key presented
    await base44.asServiceRole.entities.SyncState.create({ key: 'copilot_api_key', value: apiKey });
    return true;
  }
  return existing[0].value === apiKey;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: user token OR api_key header
    let isAuthed = false;
    try {
      const user = await base44.auth.me();
      if (user) isAuthed = true;
    } catch (_) {}
    if (!isAuthed) {
      isAuthed = await validateApiKey(base44, req);
    }
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    let landlordId = url.searchParams.get('landlord_id') || '';
    if (!landlordId) {
      try { const b = await req.json(); landlordId = b.landlord_id || ''; } catch (_) {}
    }
    if (!landlordId) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const landlord = await sr.entities.Landlord.get(landlordId);
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    // Active Founder's Directive
    let activeDirective = null;
    try {
      const directives = await sr.entities.LandlordDirective.filter({ landlord_id: landlordId, status: 'active' }, '-created_date', 1);
      if (directives && directives.length > 0) activeDirective = directives[0];
    } catch (_) {}

    // Unit valuation from LandlordProperty
    let unitValuation = null;
    try {
      const props = await sr.entities.LandlordProperty.filter({ landlord_id: landlordId }, '-created_date', 1);
      if (props && props.length > 0) {
        const lp = props[0];
        unitValuation = {
          estimated_value_aed: lp.ai_estimated_value_aed || null,
          estimated_price_sqft: lp.ai_estimated_price_sqft || null,
          valuation_confidence: lp.ai_valuation_confidence || null,
          valuation_basis: lp.ai_valuation_basis || null,
          building_name: lp.building_name || null,
          unit_no: lp.unit_no || null,
          area_sqft: lp.area_sqft || null,
          bedrooms: lp.bedrooms || null,
          bathrooms: lp.bathrooms || null,
        };
      }
    } catch (_) {}

    // BrandVoice charter
    let brandVoice = null;
    try {
      const voices = await sr.entities.BrandVoice.filter({ is_active: true }, '-version', 1);
      if (voices && voices.length > 0) brandVoice = voices[0];
    } catch (_) {}

    // WS token for cockpit connection
    let wsToken = '';
    try {
      const tokenState = await sr.entities.SyncState.filter({ key: 'copilot_ws_token' });
      if (tokenState && tokenState.length > 0) wsToken = tokenState[0].value || '';
    } catch (_) {}

    return Response.json({
      ok: true,
      landlord: {
        id: landlord.id,
        full_name_en: landlord.full_name_en || landlord.full_name || '',
        phone: landlord.phone || '',
        email: landlord.email || '',
        preferred_language: landlord.preferred_language || 'en',
        residence_country: landlord.residence_country || '',
        landlord_archetype: landlord.landlord_archetype || '',
        source: landlord.source || '',
        rapport_level: landlord.rapport_level || 'cold',
      },
      ai_intelligence: {
        trust_score: landlord.trust_score ?? null,
        urgency_score: landlord.urgency_score ?? null,
        mandate_win_probability: landlord.mandate_win_probability ?? null,
        trust_score_rationale: landlord.trust_score_rationale || '',
        urgency_score_rationale: landlord.urgency_score_rationale || '',
        mandate_win_rationale: landlord.mandate_win_rationale || '',
        deal_thesis: landlord.ai_deal_thesis || '',
        next_best_action: landlord.ai_next_best_action || null,
        rolling_summary: landlord.ai_rolling_summary || '',
        coaching: landlord.ai_coaching_for_agent || '',
        momentum: landlord.ai_momentum || '',
        strike_now: landlord.ai_strike_now ?? false,
        objections: landlord.ai_objections || [],
        red_flags: landlord.red_flags || [],
        buying_signals: landlord.buying_signals || [],
      },
      pipeline: {
        stage: landlord.stage || 'initial_contact',
        mandate_status: landlord.mandate_status || 'none',
        mandate_type: landlord.mandate_type || null,
        asking_price_aed: landlord.asking_price_aed ?? null,
        commission_pct_negotiated: landlord.commission_pct_negotiated ?? null,
        is_currently_listed_with_others: landlord.is_currently_listed_with_others ?? false,
        competing_brokers_count: landlord.competing_brokers_count ?? 0,
      },
      active_directive: activeDirective ? {
        id: activeDirective.id,
        text: activeDirective.directive_text || activeDirective.text || '',
        author: activeDirective.author_email || '',
        created_date: activeDirective.created_date,
      } : null,
      unit_valuation: unitValuation,
      brand_voice: brandVoice ? {
        name: brandVoice.name,
        charter_text: brandVoice.charter_text || '',
        banned_patterns: brandVoice.banned_patterns || [],
        language_rules: brandVoice.language_rules || '',
      } : null,
      qualify_questions: QUESTION_BANK,
      ws_token: wsToken,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});