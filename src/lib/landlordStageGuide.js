// Landlord pipeline stage guide — STATIC config (no Landlord-record bloat, no enum changes).
// The orchestrator, backfills and webhooks keep using the same `stage` enum keys untouched;
// this file only adds display metadata + agent guidance the UI reads.

// ── 3 visual phases (grouping only — the 17 enum keys are unchanged) ──
export const PHASES = [
  {
    key: 'win_mandate',
    name: 'Win the Mandate',
    purpose: 'Relationship — earn trust and sign the mandate.',
    color: '#C9A24B', // gold
    stages: ['initial_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation', 'form_a_signing'],
  },
  {
    key: 'build_listing',
    name: 'Build the Listing',
    purpose: 'Operations — documents, media and a live, compliant listing.',
    color: '#5a93e0', // blue
    stages: ['owner_documents', 'photos_videos', 'photographer_scheduling', 'listing_creation', 'internal_verification', 'listing_publication', 'final_confirmation'],
  },
  {
    key: 'sell_unit',
    name: 'Sell the Unit',
    purpose: 'Marketing & close — drive offers and transfer the deal.',
    color: '#3fb98a', // emerald
    stages: ['marketing_agents', 'marketing_network', 'open_house', 'client_blast', 'deal_closed'],
  },
];

// Full ordered stage enum (17 keys) — single source of truth for adjacent-stage moves.
// Matches the Landlord.stage enum exactly; never reorder or rename without an entity migration.
export const STAGE_ORDER = [
  'initial_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation', 'form_a_signing',
  'owner_documents', 'photos_videos', 'photographer_scheduling', 'listing_creation', 'internal_verification',
  'listing_publication', 'final_confirmation', 'marketing_agents', 'marketing_network', 'open_house',
  'client_blast', 'deal_closed',
];

// Adjacent stage helpers — return the prev/next enum key, or null at the ends.
export function prevStage(stage) {
  const i = STAGE_ORDER.indexOf(stage);
  return i > 0 ? STAGE_ORDER[i - 1] : null;
}
export function nextStage(stage) {
  const i = STAGE_ORDER.indexOf(stage);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}

// Phase lookup by stage key.
export const PHASE_BY_STAGE = (() => {
  const map = {};
  PHASES.forEach((p) => p.stages.forEach((s) => { map[s] = p; }));
  return map;
})();

// ── Per-stage guidance (exact text from the spec) ──
// mindset 🧠 · move 🎯 · exitRule ✅ · capture 📋
export const STAGE_GUIDE = {
  initial_contact: {
    title: 'Initial Contact',
    meaning: "First touch. They don't know us yet.",
    mindset: '"Who is this? Another broker? Do they actually know my building?"',
    move: 'Open warm, prove I know their project/unit, ask one smart question about the property. Build the first thread of trust. Confirm we have the right person.',
    exitRule: 'Landlord replies and confirms they own (or represent) the unit AND shows any willingness to talk price or listing.',
    capture: 'Confirm vCard basics — name, phone/WhatsApp, email, project, unit reference, language, nationality. Set rapport to warming once they engage.',
  },
  price_discovery: {
    title: 'Price Discovery & Negotiation',
    meaning: 'We talk numbers and expectations.',
    mindset: '"What\'s my unit really worth? Don\'t lowball me. Are you realistic?"',
    move: 'Share honest market comps. Find their real number vs. their dream number. Surface motivation and timeline. Set the gap between asking and achievable.',
    exitRule: 'Landlord gives a workable asking price (or a range we can list at) and agrees in principle to list with us.',
    capture: 'asking_price_aed, reserve_price, urgency_score, motivation note. Log every price they say into asking_price_history.',
  },
  listing_commitment: {
    title: 'Listing Commitment',
    meaning: 'They say yes — verbally — to listing with us.',
    mindset: '"OK I\'ll work with you. But am I tied down? What about other brokers?"',
    move: 'Lock the verbal yes. Explain exclusive vs. non-exclusive clearly and sell exclusivity (better service, one accountable agent). Set commission expectation.',
    exitRule: 'Landlord verbally commits to list with us and agrees to sign Form A. Mandate type chosen.',
    capture: 'mandate_type (exclusive/non-exclusive), mandate_status = verbal, commission_pct_negotiated. Set rapport to rapport_built.',
  },
  form_a_initiation: {
    title: 'Form A Initiation',
    meaning: 'We start the official RERA listing agreement.',
    mindset: '"Now it\'s getting formal. Is this safe? What am I signing?"',
    move: 'Generate Form A via Trakheesi, walk them through every clause in plain language, reassure on legality. Make signing feel easy.',
    exitRule: 'Form A is drafted and sent to the landlord; they\'ve reviewed it and raised no blockers.',
    capture: 'form_a_contract_number, mandate_status = form_a_drafted, mandate_start_date, draft form_a_pdf_url.',
  },
  form_a_signing: {
    title: 'Form A Signing — Critical Gate',
    meaning: 'The mandate becomes real and legal.',
    mindset: '"I\'m committing. I trust this agent to deliver."',
    move: 'Secure the signature (UAE PASS / digital). Confirm Trakheesi permit issues. This is the gate — no marketing is legal before this.',
    exitRule: 'Form A is signed and the Trakheesi permit number exists.',
    capture: 'mandate_status = form_a_signed, mandate_expires_at, signed form_a_pdf_url, Trakheesi permit number. Set rapport to trust_established.',
  },
  owner_documents: {
    title: 'Owner Documents',
    meaning: 'We collect the legal paperwork to list and sell.',
    mindset: '"More documents? Why do you need my ID and title deed?"',
    move: 'Request Emirates ID/passport, title deed, and any mortgage/NOC info. Explain each is required by DLD. Make it a 2-minute upload, not a chore.',
    exitRule: 'All required owner documents received and stored.',
    capture: 'emirates_id_file_url, passport_file_url, passport_no, title deed file, mortgage/NOC status. Flag any red_flags (title dispute, mortgage arrears).',
  },
  photos_videos: {
    title: 'Photos / Videos',
    meaning: 'We decide and gather the visual content.',
    mindset: '"Will my place look good? When are people coming in?"',
    move: 'Confirm what media we need (photos, video, 360). Confirm unit is tenant-free/ready or arrange access. Set expectations on quality.',
    exitRule: 'Media plan agreed and access to the unit is confirmed.',
    capture: 'media fields (what\'s needed vs. done), access notes, tenant status.',
  },
  photographer_scheduling: {
    title: 'Photographer Scheduling',
    meaning: 'We book the shoot.',
    mindset: '"Just tell me the date and time."',
    move: 'Lock a date with photographer + landlord/tenant. Add to calendar (Asia/Dubai). Send confirmation + reminder.',
    exitRule: 'Shoot date booked and confirmed by all sides; media captured.',
    capture: 'shoot datetime, photographer, calendar event id, media files.',
  },
  listing_creation: {
    title: 'Listing Creation — Backend',
    meaning: 'We build the actual listing.',
    mindset: '(mostly hands-off) "Is it live yet?"',
    move: 'Listing manager: write the headline + description, select best photos, set price, fill all portal fields (Property Finder/Bayut). Build it right the first time.',
    exitRule: 'Listing fully drafted in the backend, ready for internal QC.',
    capture: 'listing draft reference, listing_manager_email, portal fields complete.',
  },
  internal_verification: {
    title: 'Internal Verification',
    meaning: 'We quality-check before it goes public.',
    mindset: '(hands-off) "Hope it looks premium."',
    move: 'QC pass — correct price, correct unit, no errors, photos sharp, permit attached, compliant copy. Erudite-quality standard.',
    exitRule: 'Listing passes internal QC with no errors.',
    capture: 'QC checklist result, reviewer, fixes applied.',
  },
  listing_publication: {
    title: 'Listing Publication',
    meaning: 'The unit goes live to the market.',
    mindset: '"Finally! Let\'s get buyers."',
    move: 'Publish across portals + website. Send the landlord the live links — this is a trust moment, show them we delivered.',
    exitRule: 'Listing is live and links sent to landlord.',
    capture: 'live listing URLs, publish date, portal reference numbers.',
  },
  final_confirmation: {
    title: 'Final Landlord Confirmation',
    meaning: 'Landlord signs off that everything is correct.',
    mindset: '"Yes, that\'s my property, presented well. Go sell it."',
    move: 'Send the live listing for their approval. Fix anything they flag. Get explicit "looks great, go ahead."',
    exitRule: 'Landlord confirms the live listing is correct and approves active marketing.',
    capture: 'confirmation note + timestamp. Set rapport to champion if they\'re delighted.',
  },
  marketing_agents: {
    title: 'Marketing — Agents',
    meaning: 'We push the unit to our own agent network.',
    mindset: '"Get it in front of every agent who can sell it."',
    move: 'Brief the internal team, share to agent WhatsApp groups, add to internal stock list, enable Form I collaboration.',
    exitRule: 'Unit circulated to all internal agents and co-broke partners.',
    capture: 'broadcast date, channels used.',
  },
  marketing_network: {
    title: 'Marketing — Network',
    meaning: 'We push to the wider broker/buyer network.',
    mindset: '"Reach the whole market, not just our desk."',
    move: 'Share to external broker networks, portal boosts, social, qualified buyer database.',
    exitRule: 'External campaign live; inbound leads starting.',
    capture: 'campaign channels, lead count.',
  },
  open_house: {
    title: 'Open House',
    meaning: 'We run viewings / open house events.',
    mindset: '"Are people actually coming to see it?"',
    move: 'Schedule and host viewings, capture buyer feedback, report activity back to landlord (keeps trust high).',
    exitRule: 'Viewings held and feedback collected; serious interest identified.',
    capture: 'viewing dates, attendee count, buyer feedback notes.',
  },
  client_blast: {
    title: 'Client Blast',
    meaning: 'We push to our matched buyer clients directly.',
    mindset: '"Bring me a serious buyer."',
    move: 'Match the unit to active buyer leads in the CRM and send targeted blasts. Drive offers.',
    exitRule: 'Offer(s) received and negotiation underway.',
    capture: 'offers received, offer amounts, buyer lead links.',
  },
  deal_closed: {
    title: 'Deal Closed',
    meaning: 'Sold. Form F signed, transfer done.',
    mindset: '"They delivered. I\'d use them again / refer them."',
    move: 'Close on Form F, manage Trustee Office transfer, collect commission, ask for a referral + review.',
    exitRule: 'Deal transferred at DLD Trustee Office; commission invoiced.',
    capture: 'sale price, commission, Form F reference, transfer date, referral ask logged.',
  },
};

// A short "Next step:" line for the card — the 🎯 move, trimmed to its first sentence.
export function nextStepFor(stage) {
  const g = STAGE_GUIDE[stage];
  if (!g) return '';
  const first = g.move.split(/(?<=\.)\s/)[0];
  return first || g.move;
}

// ── Capture-completeness check ──
// Returns { complete, missing } for the stage's required-data fields. Read-only — never writes.
// Only the stages with a checkable rule return complete=false-able results; others default to complete.
const has = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

const CAPTURE_RULES = {
  initial_contact: (l) => {
    const missing = [];
    if (!has(l.full_name_en) && !has(l.full_name)) missing.push('Name');
    if (!has(l.phone) && !has(l.whatsapp)) missing.push('Phone');
    if (!has(l.email)) missing.push('Email');
    if (!has(l.project_name)) missing.push('Project');
    if (!has(l.unit_reference)) missing.push('Unit ref');
    return missing;
  },
  price_discovery: (l) => {
    const missing = [];
    if (!has(l.asking_price_aed)) missing.push('Asking price');
    return missing;
  },
  listing_commitment: (l) => {
    const missing = [];
    if (!has(l.mandate_type)) missing.push('Mandate type');
    if (!has(l.commission_pct_negotiated)) missing.push('Commission %');
    return missing;
  },
  form_a_initiation: (l) => {
    const missing = [];
    if (!has(l.form_a_contract_number)) missing.push('Form A number');
    return missing;
  },
  form_a_signing: (l) => {
    const missing = [];
    if (l.mandate_status !== 'form_a_signed') missing.push('Form A signed');
    if (!has(l.mandate_expires_at)) missing.push('Mandate expiry');
    return missing;
  },
  owner_documents: (l) => {
    const missing = [];
    if (!has(l.emirates_id_file_url) && !has(l.passport_file_url)) missing.push('ID document');
    return missing;
  },
  final_confirmation: (l) => {
    const missing = [];
    if (!has(l.listing_manager_email)) missing.push('Listing manager');
    return missing;
  },
};

export function getCaptureStatus(landlord, stage) {
  const rule = CAPTURE_RULES[stage];
  if (!rule || !landlord) return { complete: true, missing: [] };
  const missing = rule(landlord);
  return { complete: missing.length === 0, missing };
}

// Stages that show the "Contact data" vCard mini-panel in their column header.
export const VCARD_STAGES = ['initial_contact', 'owner_documents'];