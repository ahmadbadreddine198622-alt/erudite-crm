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
  // SALE
  NEW_BUYER_LEAD: 'new_buyer_lead',
  QUALIFIED_BUYER: 'qualified_buyer',
  PROPERTY_MATCHING: 'property_matching',
  VIEWING_ENGAGEMENT: 'viewing_engagement',
  OFFER_NEGOTIATION: 'offer_negotiation',
  MOU_DLD_PROCESSING: 'mou_dld_processing',
  TRANSFER_CLOSURE: 'transfer_closure',
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
  // ────── SALE TRACK ──────
  new_buyer_lead: {
    key: 'new_buyer_lead',
    label: 'New Buyer Lead',
    order: 1,
    intent: 'buyer',
    required_data_fields: ['channel_of_contact', 'first_contact_attempted_at'],
    required_documents: [],
    suggested_actions: [
      'Make first contact within 5 minutes',
      'Confirm buyer intent',
      'Log channel',
    ],
    health_thresholds: { stalling_hours: 1, critical_hours: 4 },
  },
  qualified_buyer: {
    key: 'qualified_buyer',
    label: 'Qualified Buyer',
    order: 2,
    intent: 'buyer',
    required_data_fields: [
      'budget_min',
      'budget_max',
      'location_preference',
      'property_type',
      'bedrooms_required',
      'timeline',
      'payment_method',
      'nationality',
      'visa_status',
    ],
    required_documents: [
      { key: 'passport_copy', label: 'Buyer Passport Copy' },
      { key: 'emirates_id', label: 'Emirates ID (if UAE resident)' },
      { key: 'form_b', label: 'Form B — Buyer-Broker Agreement (RERA)' },
      { key: 'mortgage_preapproval', label: 'Mortgage Pre-Approval Letter (if applicable)' },
      { key: 'proof_of_funds', label: 'Proof of Funds — 3-6 months bank statements (cash buyers)' },
    ],
    suggested_actions: [
      'Confirm budget',
      'Capture requirements',
      'Sign Form B',
      'Collect ID documents',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  property_matching: {
    key: 'property_matching',
    label: 'Property Matching',
    order: 3,
    intent: 'buyer',
    required_data_fields: ['shortlist_property_ids', 'shortlist_sent_at'],
    required_documents: [],
    suggested_actions: [
      'Create shortlist of 3-7 properties',
      'Send shortlist to buyer',
      'Capture buyer feedback per property',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  viewing_engagement: {
    key: 'viewing_engagement',
    label: 'Viewing & Engagement',
    order: 4,
    intent: 'buyer',
    required_data_fields: ['first_viewing_date', 'viewings_count', 'viewing_feedback'],
    required_documents: [
      { key: 'viewing_form', label: 'Signed Viewing Form (recommended)' },
    ],
    suggested_actions: [
      'Schedule viewings',
      'Confirm viewing completion',
      'Log feedback after each viewing',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  offer_negotiation: {
    key: 'offer_negotiation',
    label: 'Offer & Negotiation',
    order: 5,
    intent: 'buyer',
    required_data_fields: [
      'offer_amount',
      'offer_date',
      'counter_offers_history',
      'target_property_id',
    ],
    required_documents: [],
    suggested_actions: [
      'Document offer',
      'Present to seller',
      'Track counter-offers',
      'Daily contact during negotiation',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  mou_dld_processing: {
    key: 'mou_dld_processing',
    label: 'MOU & DLD Processing',
    order: 6,
    intent: 'buyer',
    required_data_fields: [
      'agreed_price',
      'deposit_paid_at',
      'dld_appointment_date',
      'trustee_office_location',
    ],
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
      'Sign Form F at Trustee Office',
      'Collect 10% deposit',
      'Obtain NOC',
      'Finalize mortgage',
      'Prepare all fees',
      'Generate Payment Breakdown PDF',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
  },
  transfer_closure: {
    key: 'transfer_closure',
    label: 'Transfer & Closure',
    order: 7,
    intent: 'buyer',
    required_data_fields: ['transfer_date', 'new_title_deed_number', 'commission_invoice_sent_at'],
    required_documents: [
      { key: 'new_title_deed', label: "New Title Deed (buyer's name)" },
      { key: 'commission_invoice', label: 'Final Commission Invoice' },
    ],
    suggested_actions: [
      'Attend DLD transfer',
      'Hand over keys',
      'Issue commission invoice',
      'Request testimonial',
      'Schedule 30-day check-in',
    ],
    health_thresholds: DEFAULT_HEALTH_THRESHOLDS,
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
  STAGES.new_buyer_lead,
  STAGES.qualified_buyer,
  STAGES.property_matching,
  STAGES.viewing_engagement,
  STAGES.offer_negotiation,
  STAGES.mou_dld_processing,
  STAGES.transfer_closure,
];

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
