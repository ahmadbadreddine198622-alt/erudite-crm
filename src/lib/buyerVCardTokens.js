// Buyer vCard design tokens — 1:1 clone of the Landlord vCard. Dark theme only.
export const T = {
  base: 'radial-gradient(ellipse at 20% 20%, #1a2a4a 0%, #0F1419 45%, #121821 100%)',
  text: 'rgba(255,255,255,0.9)',
  gold: '#C6A15B',
  actionGoldText: 'hsl(38 92% 62%)',
  actionGoldBg: 'rgba(212,175,55,0.14)',
  actionGoldBorder: 'rgba(212,175,55,0.4)',
  ctaGold: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
  ctaGoldText: '#1a1205',
  identityBg: '#111A33',
  identityBorder: 'rgba(198,161,91,0.25)',
  identityShadow: '0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
  panelBg: 'rgba(255,255,255,0.03)',
  panelBorder: 'rgba(255,255,255,0.08)',
  hairline: 'rgba(255,255,255,0.08)',
  hairline2: 'rgba(255,255,255,0.12)',
  goBack: '#4F6AB4',
  success: '#34d399',
  error: '#f87171',
  amber: '#e4b94a',
  // Channels
  whatsapp: '#22c55e',
  whatsappSend: 'linear-gradient(180deg,#16a34a,#15803d)',
  imessage: '#0A84FF',
  telegram: '#29b6f6',
  telegram2: '#4fc3f7',
  call: '#60a5fa',
  facetime: '#8a64b2',
  aircall: '#00beff',
  twilio: '#4ade80',
  vapi: '#fb7185',
  // AI
  ai: '#c4b5fd',
  aiBg: 'rgba(139,92,246,0.06)',
  aiBorder: 'rgba(139,92,246,0.22)',
  aiBorderStrong: 'rgba(139,92,246,0.55)',
};

// Score color (TRUST / URGENCY etc.): >=70 green, 40-69 amber, <40 red.
export function scoreColor(v) {
  const n = Number(v);
  if (n >= 70) return '#34d399';
  if (n >= 40) return '#e4b94a';
  return '#DB7575';
}
export function scoreBg(v) {
  const n = Number(v);
  if (n >= 70) return 'rgba(52,211,153,0.12)';
  if (n >= 40) return 'rgba(228,185,74,0.12)';
  return 'rgba(219,117,117,0.12)';
}

// Win % color: <34 red, 34-66 gold, >=67 green.
export function winColor(pct) {
  const n = Number(String(pct).replace('%', ''));
  if (n < 34) return '#f87171';
  if (n <= 66) return 'hsl(38 92% 62%)';
  return '#34d399';
}
export function winBg(pct) {
  const n = Number(String(pct).replace('%', ''));
  if (n < 34) return 'rgba(248,113,113,0.12)';
  if (n <= 66) return 'rgba(228,185,74,0.12)';
  return 'rgba(52,211,153,0.12)';
}

// border = color + '50' (8-digit hex, ~31% alpha)
export function scoreBorder(v) { return scoreColor(v) + '50'; }
export function winBorder(pct) { return winColor(pct) + '50'; }

export const RAPPORT = {
  cold: { c: '#60a5fa', bg: 'rgba(59,130,246,0.18)' },
  warming: { c: '#fbbf24', bg: 'rgba(245,158,11,0.18)' },
  rapport_built: { c: '#818cf8', bg: 'rgba(129,140,248,0.18)' },
  trust_established: { c: '#4ade80', bg: 'rgba(74,222,128,0.18)' },
  champion: { c: '#fcd34d', bg: 'rgba(252,211,77,0.18)', glow: '0 0 10px rgba(252,211,77,0.5)' },
};