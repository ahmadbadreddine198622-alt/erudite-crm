// Single pill/chip design system for the Landlord card (kanban + detail header).
// Every pill: rounded-full, compact, dark translucent tinted fill, thin matching border,
// colored text — colored BY MEANING. Pure styling + color-selection helpers; no data logic.

import React from 'react';

// ── Accent palette (color by meaning) ───────────────────────────────────────
export const ACCENT = {
  gold:  '38 92% 50%',   // money + brand
  teal:  '160 60% 45%',  // project + sale/rent intent
  blue:  '214 90% 60%',  // unit + investor archetype
  amber: '38 92% 50%',   // warming / attention
  green: '142 71% 45%',  // positive / built states + signals
  red:   '0 72% 51%',    // urgent + flags + destructive
  grey:  '222 10% 60%',  // neutral / default
};

// Raw hsl(...) color string for an accent key — for coloring standalone text (not a pill).
export function accentHsl(accentKey) {
  return `hsl(${ACCENT[accentKey] || ACCENT.grey})`;
}

// Inline style for a pill of the given accent key (~12% fill, ~30% border, full-strength text).
export function pillStyle(accentKey) {
  const h = ACCENT[accentKey] || ACCENT.grey;
  return {
    background: `hsl(${h} / 0.12)`,
    border: `1px solid hsl(${h} / 0.30)`,
    color: `hsl(${h})`,
  };
}

// Base className shared by all pills — rounded-full, compact, text-xs, font-medium.
export const PILL_CLASS = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap';
// Category-label variant (archetype, stage) — uppercase, tracking-wide.
export const PILL_LABEL_CLASS = PILL_CLASS + ' uppercase tracking-wide';

// Generic pill component.
export function Pill({ accent = 'grey', label = false, className = '', style = {}, children, title }) {
  return (
    <span title={title} className={(label ? PILL_LABEL_CLASS : PILL_CLASS) + (className ? ' ' + className : '')} style={{ ...pillStyle(accent), ...style }}>
      {children}
    </span>
  );
}

// ── Per-field color/label maps ───────────────────────────────────────────────
export const LANGUAGE_FLAG = { en: '🇬🇧', ar: '🇦🇪', ru: '🇷🇺', zh: '🇨🇳', hi: '🇮🇳' };

export const ARCHETYPE_PILL = {
  individual_end_user_relocating: { label: 'Relocating', accent: 'amber' },
  professional_investor:          { label: 'Pro Investor', accent: 'blue' },
  portfolio_optimizer:            { label: 'Portfolio', accent: 'blue' },
  speculator_flipping:            { label: 'Flipper', accent: 'blue' },
  distressed_seller:              { label: 'Distressed', accent: 'red' },
  inherited_owner:                { label: 'Inherited', accent: 'grey' },
  developer_resale:               { label: 'Developer', accent: 'teal' },
  overseas_owner:                 { label: 'Overseas', accent: 'teal' },
  first_time_seller:              { label: 'First Time', accent: 'grey' },
  accidental_landlord:            { label: 'Accidental', accent: 'grey' },
};

export const LEAD_TYPE_PILL = {
  landlord_sale: 'For Sale',
  landlord_rent: 'For Rent',
  landlord_both: 'Sale + Rent',
};

export const RAPPORT_ACCENT = {
  cold: 'grey',
  warming: 'amber',
  rapport_built: 'green',
  trust_established: 'green',
  champion: 'green',
};

// ai_momentum is FREE-TEXT — match on keywords, default GREY (never crash on unexpected text).
export function momentumAccent(momentum) {
  const s = String(momentum || '').toLowerCase();
  if (/stall/.test(s)) return 'red';
  if (/slow/.test(s)) return 'amber';
  if (/build/.test(s)) return 'green';
  return 'grey';
}

// next-best-action priority → accent for the "NEXT:" label.
export const PRIORITY_ACCENT = { urgent: 'red', high: 'amber', medium: 'blue', low: 'grey' };

// Humanize an enum value (owner_documents → "Owner Documents").
export function humanize(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Score pill color by value (after any 0–1 → 0–100 conversion): <40 RED, 40–69 AMBER, ≥70 GREEN.
export function scoreAccent(n) {
  if (n == null || isNaN(n)) return 'grey';
  if (n < 40) return 'red';
  if (n < 70) return 'amber';
  return 'green';
}