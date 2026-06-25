// ─────────────────────────────────────────────────────────────────────────────
// SHARED LANDLORD THEME — single source of truth for ALL landlord colors.
//
// The Landlord Pipeline (pages/Landlords + components/landlord/LandlordCard) and the
// Landlord Detail v-card (pages/LandlordDetailPage + its sub-panels) BOTH read from
// this module. Neither page may define its own shades or use generic Tailwind colors
// for these concepts — if a color isn't here, it's wrong.
//
// Values are the EXACT tokens the pipeline already uses, promoted verbatim.
// ─────────────────────────────────────────────────────────────────────────────

/* ── Surfaces & accents ── */
export const CANVAS = '#0F1419';          // pipeline page background
export const SURFACE = '#0B1F3A';         // pipeline card navy
export const SURFACE_BORDER = 'rgba(201,162,75,0.18)';  // pipeline card border (gold-tinted)
export const SURFACE_SHADOW = '0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)';
export const INSET_BG = 'rgba(255,255,255,0.04)';       // nested inner row inside a navy card
export const INSET_BORDER = 'rgba(255,255,255,0.08)';

export const GOLD = '#C9A24B';            // primary accent / CTAs / active tab / AED amounts / progress
export const GOLD_SOFT = '#C9A961';       // secondary gold (hover / text)
export const GOLD_HSL = 'hsl(38 92% 50%)';// the pipeline's literal gold (interchangeable with GOLD)
export const GOLD_TEXT = 'hsl(38 92% 60%)';

export const TEXT = 'rgba(255,255,255,0.92)';
export const TEXT_MUTED = 'rgba(255,255,255,0.5)';      // pipeline muted grey
export const TEXT_FAINT = 'rgba(255,255,255,0.38)';

/* ── Fonts ── */
export const FONT_TITLE = "'Cormorant Garamond', serif";
export const FONT_BODY = "'Montserrat', sans-serif";

/* ── Semantic chip families (bg / text / border) — pipeline values ── */
export const CHIP = {
  gold:    { bg: 'rgba(201,162,75,0.12)',  text: GOLD_SOFT,   border: 'rgba(201,162,75,0.32)' },
  blue:    { bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd',   border: 'rgba(59,130,246,0.3)' },
  teal:    { bg: 'rgba(20,184,166,0.15)',  text: '#5eead4',   border: 'rgba(20,184,166,0.3)' },
  cyan:    { bg: 'rgba(6,182,212,0.15)',   text: '#67e8f9',   border: 'rgba(6,182,212,0.3)' },
  green:   { bg: 'rgba(16,185,129,0.15)',  text: '#34d399',   border: 'rgba(16,185,129,0.3)' },
  emerald: { bg: 'rgba(16,185,129,0.15)',  text: '#34d399',   border: 'rgba(16,185,129,0.3)' },
  amber:   { bg: 'rgba(245,158,11,0.15)',  text: GOLD_TEXT,   border: 'rgba(245,158,11,0.3)' },
  red:     { bg: 'rgba(239,68,68,0.15)',   text: '#f87171',   border: 'rgba(239,68,68,0.3)' },
  rose:    { bg: 'rgba(244,63,94,0.15)',   text: '#fda4af',   border: 'rgba(244,63,94,0.3)' },
  purple:  { bg: 'rgba(139,92,246,0.15)',  text: '#c4b5fd',   border: 'rgba(139,92,246,0.3)' },
  pink:    { bg: 'rgba(236,72,153,0.15)',  text: '#f9a8d4',   border: 'rgba(236,72,153,0.3)' },
  sky:     { bg: 'rgba(14,165,233,0.15)',  text: '#7dd3fc',   border: 'rgba(14,165,233,0.3)' },
  slate:   { bg: 'rgba(148,163,184,0.12)', text: 'rgba(255,255,255,0.6)', border: 'rgba(148,163,184,0.28)' },
};

/* ── Archetype → chip family (mirrors LandlordCard.ARCHETYPE_COLORS) ── */
export const ARCHETYPE_CHIP = {
  professional_investor: 'gold',
  individual_end_user_relocating: 'gold',
  first_time_seller: 'gold',
  portfolio_optimizer: 'emerald',
  distressed_seller: 'red',
  inherited_owner: 'purple',
  developer_resale: 'cyan',
  overseas_owner: 'rose',
  accidental_landlord: 'sky',
  speculator_flipping: 'pink',
};

/* ── Stage → phase → chip family (pipeline phase bands) ──
   Phase 1 Win the Mandate (gold) · Phase 2 Build the Listing (gold) · Phase 3 Sell the Unit (green) */
const PHASE3 = new Set([
  'marketing_agents', 'marketing_network', 'open_house', 'client_blast', 'deal_closed',
]);
export function stageChipFamily(stage) {
  if (PHASE3.has(stage)) return 'green';   // late-stage / completion = green, never blue
  return 'gold';                            // Phase 1 + Phase 2 = gold
}

/* ── lead_type → chip family (teal/cyan, NOT generic green) ── */
export const LEAD_TYPE_CHIP = {
  landlord_sale: 'teal',
  landlord_rent: 'teal',
  landlord_both: 'teal',
};

/* ── Rapport scale ── */
export const RAPPORT_CHIP = {
  cold: 'slate',
  warming: 'amber',
  rapport_built: 'blue',
  trust_established: 'teal',
  champion: 'gold',
};

/* ── Momentum ── */
export const MOMENTUM_CHIP = {
  stalled: 'amber',
  building: 'amber',
  hot: 'green',
};

/* ── Priority ── */
export const PRIORITY_CHIP = {
  low: 'slate',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

/* ── Media chips ── */
export const MEDIA_CHIP = {
  '360': 'blue',     // matches LandlordCard (tour_3d = blue/360)
  video: 'purple',
  photos: 'green',
};

/* ── Channel dots — ONE consistent set, identical everywhere ── */
export const CHANNEL_DOT = {
  business: '#34d399',   // WhatsApp Business — green
  personal: '#5eead4',   // WhatsApp Personal — teal
  whatsapp: '#34d399',
  email: GOLD_SOFT,      // Email — gold
  imessage: '#93c5fd',   // iMessage — blue
  telegram: '#67e8f9',   // Telegram — cyan
  call: '#c4b5fd',       // Call — purple
};

/* ── Lifecycle states (processing / mandate / lease) → chip family ── */
export function lifecycleFamily(state) {
  const s = String(state || '').toLowerCase();
  if (['completed', 'signed', 'form_a_signed', 'received', 'verified', 'active', 'done'].includes(s)) return 'green';
  if (['pending', 'drafted', 'form_a_drafted', 'in_progress', 'requested', 'verbal', 'scheduled'].includes(s)) return 'amber';
  if (['failed', 'cancelled', 'expired', 'error', 'lost', 'blocked'].includes(s)) return 'red';
  return 'slate';
}

/* ── Call outcome → chip family ── */
export function callOutcomeFamily(status) {
  const s = String(status || '').toLowerCase();
  if (['done', 'completed', 'ended', 'connected'].includes(s)) return 'green';
  if (['missed', 'no-answer', 'no_answer', 'busy', 'failed'].includes(s)) return 'red';
  if (['queued', 'initiated', 'ringing', 'voicemail'].includes(s)) return 'amber';
  return 'slate';
}

/* ── SCORE VALUE SCALE — single 0–100 mapping used IDENTICALLY in the compact AI strip
   AND the big score cards. 0–33 red · 34–66 amber · 67–100 green. ── */
export function scoreFamily(value) {
  if (value == null || isNaN(value)) return 'slate';
  if (value >= 67) return 'green';
  if (value >= 34) return 'amber';
  return 'red';
}
export function scoreColor(value) {
  return CHIP[scoreFamily(value)].text;
}
export function scoreChip(value) {
  return CHIP[scoreFamily(value)];
}

/* ── Connected-system status ── */
export const LINKED_COLOR = '#34d399';                  // green
export const NOT_LINKED_COLOR = 'rgba(255,255,255,0.4)';// muted grey

/* Helper: build an inline-style chip object from a family key. */
export function chipStyle(family) {
  const c = CHIP[family] || CHIP.slate;
  return { background: c.bg, color: c.text, border: `1px solid ${c.border}` };
}