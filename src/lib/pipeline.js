// Pipeline track + stage definitions for the Erudite two-track pipeline.
// Source of truth for stage metadata, document checklists (advisory in v1),
// suggested actions, and health thresholds.

export const LEAD_INTENTS = ['buyer', 'tenant', 'unknown'];
export const LEAD_STATUSES = ['active', 'lost', 'on_hold'];
export const LOST_REASONS = [
  'price',
  'timing',
  'location',
  'competitor',
  'financing',
  'no_response',
  'not_qualified',
  'wrong_inventory',
  'other',
];

export const STAGE_KEYS = {
  // SALE (9-stage refined flow)
  CONTACT_IDENTITY: 'contact_identity',
  FINANCIAL_QUALIFICATION: 'financial_qualification',
  INTENT_LOCK: 'intent_lock',
  UNIT_MATCHING: 'unit_matching',
  VIEWING: 'viewing',
  OBJECTION_OFFER: 'objection_offer',
  NEGOTIATION_DEAL_LOCK: 'negotiation_deal_lock',
  CLOSING_DLD: 'closing_dld',
  CLOSED: 'closed',
  // RENT
  NEW_TENANT_LEAD: 'new_tenant_lead',
  QUALIFIED_TENANT: 'qualified_tenant',
  VIEWING_DECISION: 'viewing_decision',
  CONTRACT_CHEQUES: 'contract_cheques',
  EJARI_MOVEIN: 'ejari_movein',
  // INTAKE
  INTAKE_CLARIFY: 'intake_clarify',
};

export const DEFAULT_HEALTH_THRESHOLDS = { stalling_hours: 48, critical_hours: 72 };

export const STAGES = {
  // ────── SALE TRACK (9-stage refined flow) ──────
  contact_identity: {
    key: 'contact_identity',
    label: 'Contact & Identity Capture',
    order: 1,
    intent: 'buyer',
    required_data_fields: ['channel_of_contact', 'first_contact_attempted_at', 'full_name', 'nationality'],
    required_documents: [],
    suggested_actions: [
      'Respond within 5 minutes',
      'Capture buyer name and nationality',
      'Confirm buyer (not tenant) intent',
    ],
    health_thresholds: { stalling_hours: 1, critical_hours: 4 },
    ai_assist: 'Draft a warm first-response message in the buyer\'s language; classify inbound intent as buyer vs tenant.',
  },
  financial_qualification: {
    key: 'financial_qualification',
    label: 'Financial Qualification',
    order: 2,
    intent: 'buyer',
    required_data_fields: ['budget_min', 'budget_max', 'financing_method', 'proof_of_funds_status', 'pre_approved_amount'],
    required_documents: [
      { key: 'passport_copy', label: 'Passport Copy' },
      { key: 'proof_of_funds', label: 'Proof of Funds — bank statements (cash buyers)' },
      { key: 'mortgage_preapproval', label: 'Mortgage Pre-Approval Letter (mortgage buyers)' },
    ],
    suggested_actions: [
      'Confirm cash vs mortgage',
      'Verify budget range',
      'Request proof of funds or pre-approval letter',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Suggest qualifying questions; flag if stated budget mismatches proof of funds.',
  },
  intent_lock: {
    key: 'intent_lock',
    label: 'Seriousness & Intent Lock',
    order: 3,
    intent: 'buyer',
    required_data_fields: ['move_in_timeline', 'transaction_type', 'notes'],
    required_documents: [
      { key: 'form_b', label: 'Form B — Buyer-Broker Agreement (RERA)' },
    ],
    suggested_actions: [
      'Confirm they are a serious buyer',
      'Lock commitment and timeline',
      'Sign Form B (buyer-broker agreement)',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Identify hesitation signals; suggest commitment-lock talking points.',
  },
  unit_matching: {
    key: 'unit_matching',
    label: 'Unit Matching & Presentation',
    order: 4,
    intent: 'buyer',
    required_data_fields: ['preferred_locations', 'preferred_property_types', 'bedrooms_min', 'bedrooms_max', 'notes'],
    required_documents: [],
    suggested_actions: [
      'Build a controlled shortlist of 3-7 units',
      'Present shortlist to buyer',
      'Capture buyer feedback per unit',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Match buyer criteria against active inventory; rank units by fit score.',
  },
  viewing: {
    key: 'viewing',
    label: 'Viewing — Schedule & Execute',
    order: 5,
    intent: 'buyer',
    required_data_fields: ['next_appointment_at', 'notes'],
    required_documents: [
      { key: 'viewing_form', label: 'Signed Viewing Form (recommended)' },
    ],
    suggested_actions: [
      'Schedule viewings',
      'Confirm completion with buyer',
      'Control the viewing experience',
      'Log feedback after each viewing',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Summarize post-viewing feedback; identify front-runner property from notes.',
  },
  objection_offer: {
    key: 'objection_offer',
    label: 'Objection Handling & Offer',
    order: 6,
    intent: 'buyer',
    required_data_fields: ['notes'],
    required_documents: [],
    suggested_actions: [
      'Handle objections in a structured way',
      'Secure and document the offer',
      'Present offer to seller',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Draft objection-handling scripts; suggest offer price based on market data.',
  },
  negotiation_deal_lock: {
    key: 'negotiation_deal_lock',
    label: 'Negotiation & Deal Lock',
    order: 7,
    intent: 'buyer',
    required_data_fields: ['deal_value_aed', 'notes'],
    required_documents: [],
    suggested_actions: [
      'Negotiate and track counter-offers',
      'Lock the financial commitment',
      'Confirm agreed price in writing',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Track counter-offer history; suggest negotiation anchors; flag deal fatigue.',
  },
  closing_dld: {
    key: 'closing_dld',
    label: 'Closing & DLD Processing',
    order: 8,
    intent: 'buyer',
    required_data_fields: ['deal_value_aed', 'next_appointment_at', 'notes'],
    required_documents: [
      { key: 'form_f_mou', label: 'Form F — MOU (signed)' },
      { key: 'noc_developer', label: 'NOC from Developer' },
      { key: 'mortgage_final_approval', label: 'Final Mortgage Approval (if applicable)' },
      { key: 'title_deed_seller', label: 'Original Title Deed (from seller)' },
      { key: 'manager_cheque_dld', label: "Manager's Cheque — DLD Fee (4%)" },
      { key: 'cash_trustee_fee', label: 'Trustee Office Fee — AED 4,200 CASH' },
      { key: 'cash_title_deed', label: 'Title Deed Fee — AED 580 CASH' },
    ],
    suggested_actions: [
      'Sign Form F / MOU at Trustee Office',
      'Collect 10% deposit from buyer',
      'Obtain NOC from developer',
      'Finalize mortgage (if applicable)',
      'Prepare all fees and cheques',
      'Generate payment-breakdown PDF',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Generate payment-breakdown summary; checklist all DLD documents; calculate exact fees.',
  },
  closed: {
    key: 'closed',
    label: 'Closed — Won / Lost',
    order: 9,
    intent: 'buyer',
    required_data_fields: ['status', 'notes', 'lost_reason'],
    required_documents: [
      { key: 'new_title_deed', label: "New Title Deed (buyer's name)" },
      { key: 'commission_invoice', label: 'Final Commission Invoice' },
    ],
    suggested_actions: [
      'Complete DLD transfer',
      'Hand over keys to buyer',
      'Issue commission invoice',
      'Request testimonial / Google review',
      '(If lost) Record lost reason for pipeline analytics',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
    ai_assist: 'Draft testimonial request message; auto-generate commission invoice data.',
  },

  // ────── RENT TRACK ──────
  new_tenant_lead: {
    key: 'new_tenant_lead',
    label: 'New Tenant Lead',
    order: 1,
    intent: 'tenant',
    required_data_fields: ['channel_of_contact', 'first_contact_attempted_at'],
    required_documents: [],
    suggested_actions: [
      'Make first contact within 5 minutes',
      'Confirm tenant intent',
    ],
    health_thresholds: { stalling_hours: 1, critical_hours: 4 },
  },
  qualified_tenant: {
    key: 'qualified_tenant',
    label: 'Qualified Tenant',
    order: 2,
    intent: 'tenant',
    required_data_fields: [
      'budget_yearly',
      'location_preference',
      'property_type',
      'bedrooms_required',
      'movein_date',
      'household_composition',
      'cheques_count',
    ],
    required_documents: [
      { key: 'passport_copy', label: 'Tenant Passport Copy' },
      { key: 'emirates_id', label: 'Emirates ID' },
      { key: 'uae_visa', label: 'UAE Visa Copy' },
      { key: 'employment_proof', label: 'Employment/Income Proof (if requested by landlord)' },
    ],
    suggested_actions: [
      'Confirm budget',
      'Capture move-in date',
      'Collect documents',
      'Confirm cheque count',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  viewing_decision: {
    key: 'viewing_decision',
    label: 'Viewing & Decision',
    order: 3,
    intent: 'tenant',
    required_data_fields: [
      'shortlist_property_ids',
      'viewings_count',
      'viewing_feedback',
      'chosen_property_id',
    ],
    required_documents: [],
    suggested_actions: [
      'Shortlist 2-5 properties',
      'Schedule viewings',
      'Capture feedback',
      'Confirm tenant choice',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  contract_cheques: {
    key: 'contract_cheques',
    label: 'Contract & Cheques',
    order: 4,
    intent: 'tenant',
    required_data_fields: [
      'agreed_yearly_rent',
      'security_deposit_amount',
      'agency_fee_amount',
      'cheques_received_at',
      'uae_bank_account_confirmed',
    ],
    required_documents: [
      { key: 'tenancy_contract', label: 'Tenancy Contract (signed)' },
      { key: 'title_deed_copy', label: 'Property Title Deed Copy' },
      { key: 'landlord_passport_id', label: 'Landlord Passport + Emirates ID' },
      { key: 'security_deposit_cheque', label: 'Security Deposit Cheque (~5%)' },
      { key: 'rent_cheques', label: 'Post-Dated Rent Cheques' },
      { key: 'agency_fee_cheque', label: 'Agency Fee Cheque (5% + VAT)' },
    ],
    suggested_actions: [
      'Draft tenancy contract',
      'Collect cheques',
      'Collect security deposit',
      'Confirm UAE bank account',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  ejari_movein: {
    key: 'ejari_movein',
    label: 'Ejari & Move-In',
    order: 5,
    intent: 'tenant',
    required_data_fields: [
      'ejari_certificate_number',
      'dewa_account_number',
      'movein_date',
      'inspection_report_url',
    ],
    required_documents: [
      { key: 'ejari_certificate', label: 'Ejari Certificate' },
      { key: 'dewa_registration', label: 'DEWA Registration Confirmation' },
      { key: 'movein_inspection', label: 'Move-In Inspection Form (signed by both parties)' },
    ],
    suggested_actions: [
      'Register Ejari (AED 220)',
      'Set up DEWA',
      'Conduct move-in inspection',
      'Hand over keys',
      'Set reminder for lease renewal (60 days before expiry)',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },

  // ────── INTAKE ──────
  intake_clarify: {
    key: 'intake_clarify',
    label: 'Intake — Clarify Intent',
    order: 1,
    intent: 'unknown',
    required_data_fields: ['original_source', 'first_message_received'],
    required_documents: [],
    suggested_actions: [
      "Ask: 'Are you looking to buy or rent?'",
      'Once answered, route to correct track',
    ],
    health_thresholds: { stalling_hours: 0.5, critical_hours: 2 },
  },
};

export const SALE_STAGES = [
  STAGES.contact_identity,
  STAGES.financial_qualification,
  STAGES.intent_lock,
  STAGES.unit_matching,
  STAGES.viewing,
  STAGES.objection_offer,
  STAGES.negotiation_deal_lock,
  STAGES.closing_dld,
  STAGES.closed,
];

// Legacy stage key → new stage key mapping (for migration)
export const BUYER_STAGE_MIGRATION_MAP = {
  new_buyer_lead: 'contact_identity',
  qualified_buyer: 'financial_qualification',
  property_matching: 'unit_matching',
  viewing_engagement: 'viewing',
  offer_negotiation: 'objection_offer',
  mou_dld_processing: 'closing_dld',
  transfer_closure: 'closed',
};

export const RENT_STAGES = [
  STAGES.new_tenant_lead,
  STAGES.qualified_tenant,
  STAGES.viewing_decision,
  STAGES.contract_cheques,
  STAGES.ejari_movein,
];

export const INTAKE_STAGES = [STAGES.intake_clarify];

export function getStagesForIntent(intent) {
  if (intent === 'buyer') return SALE_STAGES;
  if (intent === 'tenant') return RENT_STAGES;
  return INTAKE_STAGES;
}

export function getStageMetadata(stageKey) {
  return STAGES[stageKey] || null;
}

export function getNextStage(currentStageKey) {
  const meta = STAGES[currentStageKey];
  if (!meta) return null;
  const track = getStagesForIntent(meta.intent);
  const idx = track.findIndex((s) => s.key === currentStageKey);
  if (idx < 0 || idx >= track.length - 1) return null;
  return track[idx + 1];
}