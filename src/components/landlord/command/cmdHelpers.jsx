// Shared palette, color maps, label maps and formatters for the Landlord Command Center.
// Pure helpers — no data writes, no schema changes.

export const PALETTE = {
  gold: '#C9A24B',
  blue: '#60a5fa',
  green: '#34d399',
  amber: '#f59e0b',
  red: '#f87171',
  text: 'rgba(255,255,255,0.95)',
  textDim: 'rgba(255,255,255,0.62)',
  textFaint: 'rgba(255,255,255,0.42)',
  card: 'rgba(255,255,255,0.035)',
  cardBorder: 'rgba(255,255,255,0.1)',
};

export const RAPPORT_COLORS = {
  cold: '#94a3b8',
  warming: '#f59e0b',
  rapport_built: '#60a5fa',
  trust_established: '#34d399',
  champion: '#C9A24B',
};

export const PRIORITY_COLOR = {
  low: '#94a3b8',
  medium: '#60a5fa',
  high: '#f59e0b',
  urgent: '#f87171',
};

export const LANG_LABEL = {
  en: 'English',
  ar: 'Arabic',
  ru: 'Russian',
  zh: 'Chinese',
  hi: 'Hindi',
};

export const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery',
  listing_commitment: 'Listing Commitment',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Documentation / Verification',
  listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Confirmation',
  marketing_agents: 'Marketing — Agents',
  marketing_network: 'Marketing — Network',
  open_house: 'Open House',
  client_blast: 'Client Blast',
  deal_closed: 'Deal Closed',
};

// "professional_investor" / "very-high" → "Professional Investor" / "Very High"
export function titleize(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initialsOf(first, last) {
  const a = (first || '').trim()[0] || '';
  const b = (last || '').trim()[0] || '';
  return (a + b).toUpperCase();
}

// Compact AED money: 1.25M / 320K / 4,500
export function fmtAED(amount) {
  if (amount == null || isNaN(amount)) return '—';
  const n = Number(amount);
  if (Math.abs(n) >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toLocaleString('en-US')}`;
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Whole days from now until a future date (negative when past).
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// "3h ago" / "2d ago" / "just now"
export function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(dateStr);
}

// RTL for Arabic/Hebrew/Farsi/Urdu, else LTR.
export function dirForLang(lang) {
  if (!lang) return 'ltr';
  return ['ar', 'he', 'fa', 'ur'].includes(String(lang).toLowerCase()) ? 'rtl' : 'ltr';
}

// 0–100 score → red/amber/green.
export function scoreColor(value) {
  if (value == null || isNaN(value)) return PALETTE.textFaint;
  if (value >= 75) return PALETTE.green;
  if (value >= 50) return PALETTE.amber;
  return PALETTE.red;
}

// Momentum string → color (accelerating/positive = green, stalling/negative = red).
export function MOMENTUM_COLOR(momentum) {
  const m = (momentum || '').toLowerCase();
  if (/accel|rising|strong|positive|up|hot/.test(m)) return PALETTE.green;
  if (/stall|cool|negative|down|drop|cold|slow/.test(m)) return PALETTE.red;
  if (/steady|stable|warm/.test(m)) return PALETTE.blue;
  return PALETTE.textFaint;
}