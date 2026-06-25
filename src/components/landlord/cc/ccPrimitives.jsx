// Shared primitives for the Landlord Command Center redesign.
// Erudite dark-glass aesthetic: page #0F1419, cards #0B1F3A, gold #C9A24B accent.
// Cormorant Garamond for titles, Montserrat for body. Read-only — no schema changes.
import React from 'react';

export const GOLD = '#C9A24B';
export const CARD_BG = '#0B1F3A';
export const PAGE_BG = '#0F1419';

export const CC_FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@300;400;500;600;700;800&display=swap');
.cc-root, .cc-root * { box-sizing: border-box; }
.cc-root { font-family: 'Montserrat', sans-serif; }
.cc-title { font-family: 'Cormorant Garamond', serif; }
.cc-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.cc-root ::-webkit-scrollbar-track { background: transparent; }
.cc-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
@keyframes cc-rise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes cc-pulse { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
.cc-card { transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease; }
.cc-card.cc-hoverable:hover { transform: translateY(-2px); border-color: rgba(201,162,75,0.4); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
.cc-grid { display: grid; grid-template-columns: 1.62fr 1fr; gap: 16px; align-items: start; }
@media (max-width: 1000px) { .cc-grid { grid-template-columns: 1fr; } }
`;

// Score color band: 0–33 red, 34–66 amber, 67–100 green.
export function scoreColor(n) {
  if (n == null || isNaN(n)) return 'rgba(255,255,255,0.4)';
  if (n <= 33) return '#f87171';
  if (n <= 66) return '#fbbf24';
  return '#34d399';
}

export function fmtAED(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return 'AED ' + (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
  if (n >= 1_000) return 'AED ' + Math.round(n / 1_000) + 'K';
  return 'AED ' + Math.round(n).toLocaleString();
}

export function fmtAEDFull(n) {
  if (n == null || isNaN(n)) return '—';
  return 'AED ' + Math.round(n).toLocaleString('en-US');
}

export function relativeTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts); if (isNaN(d)) return String(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  if (days < 30) return days + 'd ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d); if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function titleize(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Detect script for correct RTL / Cyrillic rendering of suggested-message text.
export function textDir(str) {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(String(str || '')) ? 'rtl' : 'ltr';
}

// A titled glass card with an icon. accent tints the left border + title.
export function Card({ icon, title, accent = GOLD, count, children, hoverable = true, style }) {
  return (
    <div
      className={'cc-card' + (hoverable ? ' cc-hoverable' : '')}
      style={{
        background: CARD_BG,
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 16,
        padding: '14px 16px',
        animation: 'cc-rise 0.4s cubic-bezier(0.22,1,0.36,1) both',
        ...style,
      }}
    >
      {(title || icon) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {icon && <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>}
          <span className="cc-title" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.01em', color: 'rgba(255,255,255,0.95)' }}>{title}</span>
          {count != null && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: `${accent}22`, color: accent }}>{count}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// A pill chip with availability color and optional tooltip.
export function Chip({ label, color = 'rgba(255,255,255,0.7)', bg = 'rgba(255,255,255,0.06)', border, icon, title, style }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, color, background: bg, border: `1px solid ${border || bg}`, whiteSpace: 'nowrap', ...style }}>
      {icon && <span style={{ fontSize: 11, lineHeight: 1 }}>{icon}</span>}
      {label}
    </span>
  );
}

export function EmptyLine({ children }) {
  return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, fontStyle: 'italic' }}>{children}</div>;
}

export function Label({ children }) {
  return <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)' }}>{children}</div>;
}

// label/value pair used across sidebar cards
export function KV({ label, value, accent }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: accent || 'rgba(255,255,255,0.9)', wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}