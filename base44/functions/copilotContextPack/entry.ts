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

// ── BUYER BRAIN V1 B4b — buyer/tenant question bank (field keys KEEP IN SYNC with
// buyerBrainQualify's whitelist: live qualify_updates map straight onto Lead fields). ──
const BUYER_QUALIFY_QUESTIONS = [
  { field_key: 'intent', question: 'Are you looking to buy, or to rent?', type: 'choice', options: ['buyer', 'tenant'] },
  { field_key: 'budget_max', question: "What budget do you have in mind? (RENT track: that's ANNUAL rent)", type: 'number' },
  { field_key: 'budget_min', question: 'Is there a floor to the range you are considering?', type: 'number' },
  { field_key: 'financing_method', question: 'Cash or mortgage — do you have a pre-approval?', type: 'choice', options: ['cash', 'mortgage', 'installments', 'mixed', 'unknown'] },
  { field_key: 'bedrooms_min', question: 'How many bedrooms do you need?', type: 'number' },
  { field_key: 'bedrooms_max', question: 'Up to how many bedrooms would you consider?', type: 'number' },
  { field_key: 'preferred_locations', question: 'Which areas are you focused on?', type: 'text' },
  { field_key: 'move_in_timeline', question: 'When do you want to move / complete?', type: 'choice', options: ['immediate', '1_month', '3_months', '6_months', '12_months', 'flexible', 'investor_no_move_in'] },
  { field_key: 'cheques_count', question: '(RENT) How many cheques would you prefer to pay in?', type: 'number' },
  { field_key: 'transaction_type', question: 'Is this to live in, a second home, or an investment?', type: 'choice', options: ['primary_residence', 'second_home', 'investment', 'short_term_rental', 'commercial'] },
];

// Buyer-side play per pipeline stage (twin of CARDONE_STAGE_PLAYS, buyer flavor).
const BUYER_STAGE_PLAYS = {
  intake_clarify: 'INTAKE: one question decides everything — buy or rent? Then budget band and area. Goal: routed to the right track with a number.',
  contact_identity: 'FIRST CONTACT: respond like they are your only client. Capture name, nationality, and what they are actually hunting. Goal: identity + intent locked.',
  new_tenant_lead: 'NEW TENANT: money is ANNUAL RENT. Get budget/yr, move-in date, cheque preference. Goal: qualified tenant with a viewing path.',
  financial_qualification: 'QUALIFICATION: cash vs mortgage changes everything. Ask for the pre-approval or proof-of-funds naturally — frame as unlocking better units. Goal: budget confirmed with evidence.',
  unit_matching: 'MATCHING: present a controlled shortlist of 3, never a firehose. Every listing named must be REAL (from the inventory pack). Goal: two units they want to see.',
  viewing: 'VIEWING: lock a specific slot on this call. Scarcity is real when the pack shows it. Goal: a viewing on the calendar.',
  objection_offer: 'OFFER: objections are buying signals. Anchor on market facts from the pack, never argue. Goal: a number they would sign at.',
  default: 'ADVANCE THE SEARCH: one clear commitment before hanging up — a viewing slot, a shortlist yes/no, a document. Follow up one more time than any competitor would.',
};

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
    const { call_log_id, landlord_id, lead_id, agent_email } = body;

    const pack = {
      call_log_id: call_log_id || null,
      landlord_id: landlord_id || null,
      lead_id: lead_id || null,
      agent_email: agent_email || null,
      generated_at: new Date().toISOString(),
      qualify_questions: QUALIFY_QUESTIONS,
    };

    // ── BUYER BRAIN V1 B4b — lead-aware pack: when a lead_id is on the call, the live
    // copilot speaks buyer/tenant (lead dossier + INVENTORY PACK + buyer question bank),
    // not landlord. SEPARATE BRAINS: no Landlord reads on this branch. ──
    if (lead_id) {
      pack.qualify_questions = BUYER_QUALIFY_QUESTIONS;
      const lead = await sr.entities.Lead.get(lead_id).catch(() => null);
      if (!lead) {
        pack.warning = `lead ${lead_id} not found`;
        return Response.json(pack);
      }
      const isRent = lead.intent === 'tenant';
      pack.mode = 'buyer';
      pack.lead = {
        name: lead.full_name || null,
        preferred_language: lead.preferred_language || null,
        nationality: lead.nationality || null,
        residence_country: lead.residence_country || null,
        intent: lead.intent || 'unknown',
        track_law: isRent
          ? 'RENT TRACK: every money figure is ANNUAL RENT (AED/year); cheque count matters; move-in date drives urgency. Never talk purchase/ROI.'
          : lead.intent === 'buyer' ? 'SALE TRACK: budget is purchase capital; financing (cash vs mortgage) is the core qualification axis.' : 'TRACK UNKNOWN: clarify buy vs rent FIRST.',
        stage: lead.stage || null,
        source: lead.source || null,
        budget_min: lead.budget_min ?? null,
        budget_max: lead.budget_max ?? null,
        bedrooms_min: lead.bedrooms_min ?? null,
        bedrooms_max: lead.bedrooms_max ?? null,
        preferred_locations: lead.preferred_locations || [],
        move_in_timeline: lead.move_in_timeline || null,
        cheques_count: lead.cheques_count ?? null,
        financing_method: lead.financing_method || lead.financing_type || null,
        lead_score: lead.ai_lead_score ?? null,
        conversion_probability: lead.ai_conversion_probability ?? null,
        momentum: lead.ai_momentum || null,
        red_flags: lead.ai_red_flags || null,
        buying_signals: Array.isArray(lead.ai_buying_signals) ? lead.ai_buying_signals : [],
      };
      pack.deal_thesis = lead.ai_deal_thesis || null;
      pack.next_best_action = Array.isArray(lead.ai_next_best_actions) && lead.ai_next_best_actions[0] ? lead.ai_next_best_actions[0] : null;
      pack.rolling_summary = lead.ai_rolling_summary || null;
      pack.coaching_for_agent = lead.ai_coaching_for_agent || null;
      pack.cardone_stage_play = BUYER_STAGE_PLAYS[lead.stage] || BUYER_STAGE_PLAYS.default;

      // INVENTORY PACK — KEEP IN SYNC with buyerOrchestrator's gatherInventoryPack scoring
      // (compact top 5): live suggestions may name ONLY these real listings.
      try {
        const listingType = isRent ? 'rent' : 'sale';
        const rows = await sr.entities.PFListing.filter({ status: 'active', listing_type: listingType }, '-published_at', 200).catch(() => []);
        const budgetMin = (typeof lead.budget_min === 'number' && lead.budget_min > 0) ? lead.budget_min : null;
        const budgetMax = (typeof lead.budget_max === 'number' && lead.budget_max > 0) ? lead.budget_max : null;
        const locs = (Array.isArray(lead.preferred_locations) ? lead.preferred_locations : []).map((l) => String(l).toLowerCase());
        const scored = (Array.isArray(rows) ? rows : []).map((r) => {
          let score = 0;
          const price = typeof r.price === 'number' ? r.price : null;
          if (price && budgetMax) {
            if (price >= (budgetMin ?? budgetMax * 0.5) * 0.8 && price <= budgetMax * 1.15) score += 3;
            else if (price <= budgetMax * 1.4) score += 1;
          }
          const loc = String(r.location || r.community || '').toLowerCase();
          if (locs.length && loc && locs.some((l) => loc.includes(l) || l.includes(loc))) score += 2;
          const beds = r.bedrooms;
          if (beds != null && lead.bedrooms_min != null && lead.bedrooms_max != null) {
            const b = Number(String(beds).replace(/\D/g, '') || 0);
            if (b >= lead.bedrooms_min && b <= lead.bedrooms_max) score += 2;
          }
          return { r, score };
        }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
        if (scored.length) {
          pack.inventory = scored.map(({ r }) => ({
            title: r.title || r.building_name || 'Listing',
            location: r.location || r.community || null,
            bedrooms: r.bedrooms ?? null,
            price_aed: typeof r.price === 'number' ? r.price : null,
            per: isRent ? 'year' : 'sale',
            ref: r.reference_number || null,
          }));
        }
      } catch (_) { /* non-fatal */ }

      // Active Founder's Directive (lead-side twin).
      try {
        const directives = await sr.entities.LeadDirective.filter(
          { lead_id, type: 'founder_directive', status: 'active' }, '-created_date', 3
        );
        if (directives?.length) {
          pack.founder_directive = directives.map(d => ({
            text: d.directive_text, priority: d.priority || 'normal',
          }));
        }
      } catch (_) { /* non-fatal */ }

      // Brand voice (shared, compact).
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

      console.log(`[copilotContextPack] served BUYER pack for lead=${lead_id} call=${call_log_id}`);
      return Response.json(pack);
    }

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
      unit_plan_code: L.unit_plan_code || null,
      unit_layout: L.unit_layout || null,
      unit_total_sqft: L.unit_total_sqft ?? null,
      unit_floor: L.unit_floor ?? null,
      unit_view: L.unit_view || null,
      unit_view_source: L.unit_view_source || null,
      unit_view_note: (L.unit_view && L.unit_view_source !== 'agent_verified') ? 'View is per developer plan — do NOT state it as verified fact on the live call; say "the plan shows".' : null,
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
