// buildCommandCenterVM — read-only mapping from a raw Landlord record (+ related rows)
// into the view-model the Command Center components consume. Binds ONLY to existing
// Landlord fields. No schema changes, no writes.
import { STAGE_GUIDE, prevStage, nextStage } from '@/lib/landlordStageGuide';
import { fmtDate, titleize } from './ccPrimitives';

const ARCHETYPE_LABELS = {
  professional_investor: 'Pro Investor',
  individual_end_user_relocating: 'Relocating',
  distressed_seller: 'Distressed',
  inherited_owner: 'Inherited',
  developer_resale: 'Developer',
  overseas_owner: 'Overseas',
  first_time_seller: 'First Time',
  portfolio_optimizer: 'Portfolio',
  accidental_landlord: 'Accidental',
  speculator_flipping: 'Speculator',
};

const LANG_MAP = { en: 'EN', ar: 'AR', ru: 'RU', zh: 'ZH', hi: 'HI' };

const STAGE_LABEL = (s) => STAGE_GUIDE[s]?.title || titleize(s);

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function expiryInfo(expiresAt) {
  if (!expiresAt) return { countdown: null, soon: false, date: '—' };
  const d = new Date(expiresAt);
  if (isNaN(d)) return { countdown: null, soon: false, date: String(expiresAt) };
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const date = fmtDate(expiresAt);
  if (days < 0) return { countdown: `expired ${date}`, soon: true, date };
  return { countdown: `${date} · in ${days}d`, soon: days <= 14, date };
}

// L = raw Landlord; extras carries already-loaded related data (timeline, property, etc.)
export function buildCommandCenterVM(L, extras = {}) {
  if (!L) return null;
  const name = L.full_name_en || L.full_name || 'Unnamed landlord';
  const stage = L.stage || 'initial_contact';

  // Mandate-status pretty labels
  const statusMap = { form_a_signed: 'Signed', form_a_drafted: 'Draft', verbal: 'Verbal', expired: 'Expired', cancelled: 'Cancelled', none: 'None' };
  const exp = expiryInfo(L.mandate_expires_at);

  // Media chips from the six media_* fields (done when a URL/status is present).
  const mediaChips = [
    { label: 'Photos', done: !!L.media_photography_url || L.media_photography_status === 'delivered' },
    { label: 'Video', done: !!L.media_video_url },
    { label: '360', done: !!L.media_tour_360_url },
    { label: 'Drone', done: !!L.media_drone_url },
    { label: 'Floorplan', done: !!L.media_floorplan_url },
  ];

  // Price-conflict detection: any logged history price diverges >10% from asking_price_aed.
  const priceHistory = Array.isArray(L.asking_price_history) ? L.asking_price_history : [];
  const priceConflict = L.asking_price_aed != null && priceHistory.some((h) => h.price != null && Math.abs(h.price - L.asking_price_aed) / Math.max(L.asking_price_aed, 1) > 0.1);

  // Channel availability states ('available' | 'not' | 'unknown').
  const imAvail = L.imessage_status === 'available';
  const channels = {
    whatsapp: (L.whatsapp || L.phone) ? 'available' : 'not',
    imessage: imAvail ? 'available' : (L.imessage_status === 'not_available' ? 'not' : 'unknown'),
    telegram: L.telegram_chat_id ? 'available' : 'not',
    sms: L.phone ? 'available' : 'not',
    email: L.email ? 'available' : 'not',
  };

  const bedsLabel = (() => {
    const b = extras.property?.bedrooms ?? L.bedrooms;
    if (b == null) return '0 Bed';
    return b === 0 ? 'Studio' : `${b} Bed`;
  })();
  const sqft = extras.property?.area_sqft ?? L.area_sqft ?? null;

  return {
    // identity
    id: L.id,
    name,
    nameAr: L.full_name_ar || '',
    initials: initials(name),
    language: LANG_MAP[L.preferred_language] || (L.preferred_language ? L.preferred_language.toUpperCase() : ''),
    archetypeLabel: ARCHETYPE_LABELS[L.landlord_archetype] || titleize(L.landlord_archetype),
    rapport: L.rapport_level || 'cold',
    leadTypeLabel: titleize((L.lead_type || '').replace('landlord_', '')),
    projectName: L.project_name || null,
    unitReference: L.unit_reference || null,
    sqft,
    bedsLabel,
    askingPrice: L.asking_price_aed ?? null,

    // contact / channel targets
    phone: L.phone || '',
    whatsapp: L.whatsapp || '',
    email: L.email || '',
    imessageAvailable: imAvail,
    imessageHandle: L.imessage_handle || '',
    imessageHandles: Array.isArray(L.imessage_handles) ? L.imessage_handles : [],
    imessageCheckedAt: L.imessage_checked_at || null,
    telegramChatId: L.telegram_chat_id || '',
    telegramUsername: L.telegram_username || '',
    channels,

    // stage arrows
    stageLabel: STAGE_LABEL(stage),
    prevStageKey: prevStage(stage),
    nextStageKey: nextStage(stage),
    prevStageLabel: prevStage(stage) ? STAGE_LABEL(prevStage(stage)) : '',
    nextStageLabel: nextStage(stage) ? STAGE_LABEL(nextStage(stage)) : '',
    canStageBack: !!prevStage(stage),
    canStageForward: !!nextStage(stage),

    // vital signs
    trustScore: L.trust_score ?? null,
    trustRationale: L.trust_score_rationale || '',
    responsivenessScore: L.responsiveness_score ?? null,
    responsivenessRationale: L.responsiveness_score_rationale || '',
    urgencyScore: L.urgency_score ?? null,
    urgencyRationale: L.urgency_score_rationale || '',
    winProbPct: L.mandate_win_probability != null ? Math.round(L.mandate_win_probability * 100) : null,
    winRationale: L.mandate_win_rationale || '',
    momentum: L.ai_momentum || '',
    strikeNow: L.ai_strike_now === true,
    estCommission: L.estimated_commission_aed ?? null,
    daysInStage: L.days_in_stage ?? null,

    // left column AI
    aiNextBestAction: (L.ai_next_best_action && typeof L.ai_next_best_action === 'object') ? L.ai_next_best_action : null,
    aiCoaching: L.ai_coaching_for_agent || '',
    aiSuggestedMessages: Array.isArray(L.ai_suggested_messages) ? L.ai_suggested_messages : [],
    aiDealThesis: (typeof L.ai_deal_thesis === 'string' && L.ai_deal_thesis.trim()) ? L.ai_deal_thesis.trim() : '',
    aiRollingSummary: L.ai_rolling_summary || '',
    aiObjections: Array.isArray(L.ai_objections) ? L.ai_objections : [],
    aiOpenQuestions: Array.isArray(L.ai_open_questions) ? L.ai_open_questions.filter((q) => q && q.question) : [],
    suggestedTasks: Array.isArray(L.ai_suggested_tasks) ? L.ai_suggested_tasks : [],
    suggestedFollowups: Array.isArray(L.ai_suggested_followups) ? L.ai_suggested_followups : [],
    timeline: Array.isArray(extras.timeline) ? extras.timeline : [],

    // right sidebar — flags & signals
    redFlags: Array.isArray(L.red_flags) ? L.red_flags : [],
    buyingSignals: Array.isArray(L.buying_signals) ? L.buying_signals : [],

    // property & media
    property: {
      unitReference: L.unit_reference || null,
      projectName: L.project_name || null,
      bedsLabel,
      sqft,
      askingPrice: L.asking_price_aed ?? null,
      reservePrice: L.reserve_price ?? null,
      daysOnMarket: L.days_on_market ?? null,
      priceHistory,
      priceConflict,
      mediaChips,
      listingUrls: Array.isArray(extras.listingUrls) ? extras.listingUrls : [],
    },

    // mandate & pipeline
    mandate: {
      stageLabel: STAGE_LABEL(stage),
      subStage: L.sub_stage || '',
      daysInStage: L.days_in_stage ?? null,
      type: L.mandate_type ? titleize(L.mandate_type) : '—',
      statusLabel: statusMap[L.mandate_status] || titleize(L.mandate_status) || 'None',
      commissionPct: L.commission_pct_negotiated ?? null,
      startDate: fmtDate(L.mandate_start_date),
      expiryDate: exp.date,
      expiryCountdown: exp.countdown,
      expirySoon: exp.soon,
      formAContractNumber: L.form_a_contract_number || '',
      formAPdfUrl: L.form_a_pdf_url || null,
      formAContracts: Array.isArray(L.form_a_contracts) ? L.form_a_contracts : [],
      leaseStatus: L.lease_agreement_status || '',
      leasePdfUrl: L.lease_pdf_url || null,
      listedElsewhere: L.is_currently_listed_with_others === true,
      competingBrokers: L.competing_brokers_count ?? null,
      priorBrokerages: L.prior_brokerage_count ?? null,
    },

    // documents
    documents: [
      { label: 'Emirates ID', url: L.emirates_id_file_url || null },
      { label: 'Passport', note: L.passport_no || null, url: L.passport_file_url || null },
      { label: 'Form A', note: L.form_a_contract_number || null, url: L.form_a_pdf_url || null },
      { label: 'Lease', url: L.lease_pdf_url || null },
    ],

    // people & contact
    people: {
      assignedAgent: L.assigned_agent_email || '',
      coAgent: L.co_agent_email || '',
      listingManager: L.listing_manager_email || '',
      source: L.source || '',
      nationality: L.nationality || '',
      residence: L.residence_country || '',
      residentUAE: typeof L.is_resident_uae === 'boolean' ? (L.is_resident_uae ? 'Yes' : 'No') : '—',
      language: LANG_MAP[L.preferred_language] || (L.preferred_language || ''),
      phones: [L.phone, ...(Array.isArray(L.additional_phones) ? L.additional_phones : [])].filter(Boolean),
      emails: [L.email, ...(Array.isArray(L.additional_emails) ? L.additional_emails : [])].filter(Boolean),
    },

    // AI meta
    aiMeta: {
      model: L.ai_model_used || '—',
      lastRun: L.last_orchestrator_run_at || L.ai_processed_at || null,
      status: L.ai_processing_status || 'unknown',
      needsReview: L.needs_human_review === true,
      reviewReason: L.review_reason || '',
    },
  };
}