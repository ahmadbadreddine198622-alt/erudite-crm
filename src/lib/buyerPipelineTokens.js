// Private Bank × Light design tokens + shared helpers for the Buyer Pipeline.
// Mirrors the Landlord Pipeline token set (LandlordCard.jsx / pbTokens.js) exactly.
// Presentation + client-side aggregation ONLY — no schema changes, no backend calls.

import { STAGES, DEFAULT_HEALTH_THRESHOLDS } from '@/lib/pipeline';

export const PB = {
  GOLD: '#C6A15B',
  NAME: '#E9EDF6',
  SLATE: '#A7B0C4',
  MONEY: '#8A93A8',
  CLARET: '#B4463F',
  CLARET_TEXT: '#C86F66',
  CLARET_BG: 'rgba(180,70,63,0.08)',
  CLARET_BORDER: 'rgba(180,70,63,0.35)',
  HAIR: 'rgba(255,255,255,0.07)',
  HAIR2: 'rgba(255,255,255,0.10)',
  WELL: '#111A33',
  CARD: '#0E1428',
  BASE: '#0B1020',
  SAGE: '#A9C6B0',
  SAGE_BORDER: 'rgba(147,180,155,0.35)',
  CHAMPAGNE: 'linear-gradient(115deg,#D9B36C,#C6A15B 55%,#A88443)',
};

export const champagneInk = {
  backgroundImage: PB.CHAMPAGNE,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  fontVariantNumeric: 'tabular-nums',
};

// AT RISK: churn ≥ 0.6 OR stale beyond the stage's critical_hours threshold.
// Reuses the existing health-threshold computation from PipelineLeadCard — no new day counts.
// ai_churn_prediction is an object ({probability, risk_level}) on brain-written leads and a
// bare number on legacy rows — support both.
export function isAtRisk(lead) {
  if (!lead) return false;
  const churn = typeof lead.ai_churn_prediction === 'number'
    ? lead.ai_churn_prediction
    : (lead.ai_churn_prediction?.probability || 0);
  if (churn >= 0.6) return true;
  const meta = STAGES[lead.stage];
  const thresholds = (meta && meta.health_thresholds) || DEFAULT_HEALTH_THRESHOLDS;
  if (!lead.stage_entered_at) return false;
  const hours = (Date.now() - new Date(lead.stage_entered_at).getTime()) / 3_600_000;
  if (isNaN(hours) || hours < 0) return false;
  return hours >= thresholds.critical_hours;
}

export function daysInStage(lead) {
  if (!lead || !lead.stage_entered_at) return null;
  const ms = Date.now() - new Date(lead.stage_entered_at).getTime();
  if (isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

export function hoursInStage(lead) {
  if (!lead || !lead.stage_entered_at) return null;
  const ms = Date.now() - new Date(lead.stage_entered_at).getTime();
  if (isNaN(ms) || ms < 0) return null;
  return ms / 3_600_000;
}

export function isHot(lead) {
  return !!lead && (lead.ai_conversion_probability || 0) >= 0.7;
}

export function hasSignals(lead) {
  return !!lead && Array.isArray(lead.ai_buying_signals) && lead.ai_buying_signals.length > 0;
}

export function leadScore(lead) {
  if (!lead) return null;
  const s = lead.ai_lead_score ?? lead.lead_score;
  return typeof s === 'number' && isFinite(s) ? s : null;
}

export function formatDealValue(val) {
  if (!val || val <= 0) return '';
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return `AED ${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (val >= 1_000) return `AED ${Math.round(val / 1_000)}K`;
  return `AED ${val}`;
}

// RENT-TRACK SEMANTICS (B1.5c): on the rent track money is ANNUAL RENT — label it /yr.
export function formatLeadMoney(lead, val) {
  const base = formatDealValue(val);
  if (!base) return '';
  return lead?.intent === 'tenant' ? `${base}/yr` : base;
}

export function formatAEDCompact(n) {
  if (!n) return 'AED 0';
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`;
  return `AED ${Math.round(n)}`;
}

// Siren ranking — among at-risk leads, the one with the most days in stage + highest churn.
export function sirenScore(lead) {
  const d = daysInStage(lead) || 0;
  const churn = lead?.ai_churn_prediction || 0;
  return d * 1000 + churn * 5000;
}

// Next-step text for the NEXT well — uses the stage's first suggested action (guaranteed to exist).
export function nextStepFor(lead) {
  if (!lead || !lead.stage) return null;
  const meta = STAGES[lead.stage];
  if (!meta) return null;
  if (Array.isArray(meta.suggested_actions) && meta.suggested_actions.length > 0) {
    return meta.suggested_actions[0];
  }
  if (meta.ai_assist) return meta.ai_assist;
  return meta.label || null;
}