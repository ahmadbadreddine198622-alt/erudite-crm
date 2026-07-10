// Shared design tokens for THE 17 — Erudite Success Academy pages.
// Midnight-navy + gold design system matching the existing CRM.

export const GOLD = '#d4af37';
export const GOLD_LITE = '#eccd72';
export const GOLD_DEEP = '#b8862b';
export const NAVY = 'hsl(222 47% 6%)';

export const pageWrap = {
  minHeight: '100vh',
  padding: '2rem 1rem 6rem',
  maxWidth: 920,
  margin: '0 auto',
};

export const card = {
  background: 'rgba(255,255,255,0.035)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(212,175,55,0.12)',
  borderRadius: 14,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  padding: 20,
};

export const goldStrip = {
  background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.03))',
  border: '1px solid rgba(212,175,55,0.25)',
  borderRadius: 10,
  padding: '14px 18px',
};

export const serif = { fontFamily: "'Playfair Display', serif" };

export const label = {
  fontSize: 10,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
};

export const goldBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 22px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
  border: '1px solid hsl(38 92% 50% / 0.5)',
  color: '#1a1205',
  fontFamily: "'Inter', sans-serif",
  transition: 'all 0.15s ease',
  textDecoration: 'none',
};

export const outlineBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.6)',
  fontFamily: "'Inter', sans-serif",
  textDecoration: 'none',
  transition: 'all 0.12s ease',
};

export const input = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.9)',
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  outline: 'none',
};

export const rankPill = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: 99,
  fontSize: 11,
  fontWeight: 700,
  background: 'rgba(212,175,55,0.15)',
  border: '1px solid rgba(212,175,55,0.3)',
  color: GOLD_LITE,
};