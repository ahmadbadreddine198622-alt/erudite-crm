import React from 'react';
import { User, Flag, Snowflake, Thermometer, Flame } from 'lucide-react';
import { ARCHETYPE_LABELS } from './LandlordCard';

// ── One consistent pill style for every tag in the rail ──
// rounded-full · ~3px 9px · 11px · weight 500 · leading icon · sentence case.
const PILL = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 9px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
  lineHeight: 1.2,
};

const GROUP_LABEL = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: 'rgba(255,255,255,0.42)',
  marginBottom: 5,
};

const DIVIDER = {
  width: 1,
  alignSelf: 'stretch',
  minHeight: 34,
  background: 'rgba(255,255,255,0.1)',
  margin: '0 2px',
};

// Archetype short label + its color family (reused from the Kanban card).
const ARCHETYPE_TONE = {
  professional_investor: { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.32)' },
  individual_end_user_relocating: { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.32)' },
  distressed_seller: { color: '#fca5a5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  inherited_owner: { color: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  developer_resale: { color: '#67e8f9', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)' },
  overseas_owner: { color: '#fda4af', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' },
  first_time_seller: { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.32)' },
  portfolio_optimizer: { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  accidental_landlord: { color: '#93c5fd', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  speculator_flipping: { color: '#f9a8d4', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)' },
};
const ARCHETYPE_FALLBACK = { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.32)' };

// Rapport → temperature color ramp.
const TEMP_META = {
  cold: { Icon: Snowflake, color: '#93c5fd', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.36)', label: 'Cold' },
  warm: { Icon: Thermometer, color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)', border: 'hsl(38 92% 50% / 0.38)', label: 'Warm' },
  hot: { Icon: Flame, color: '#fca5a5', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.4)', label: 'Hot' },
};

function Group({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={GROUP_LABEL}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

/**
 * Grouped tag rail for the landlord detail header.
 * Profile (archetype) · Pipeline (stage + rapport) · Channel (iMessage/SMS — passed as children).
 */
export default function LandlordHeaderTags({ archetypeKey, stageLabel, temperature, momentum, channel }) {
  const tone = ARCHETYPE_TONE[archetypeKey] || ARCHETYPE_FALLBACK;
  const archetypeLabel = ARCHETYPE_LABELS[archetypeKey] || 'Landlord';
  const temp = TEMP_META[temperature] || TEMP_META.cold;
  const TempIcon = temp.Icon;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
      {/* Profile */}
      <Group label="Profile">
        <span style={{ ...PILL, background: tone.bg, borderColor: tone.border, color: tone.color }}>
          <User size={12} strokeWidth={2} />
          {archetypeLabel}
          {momentum && (
            <span style={{ marginLeft: 2, opacity: 0.6, fontWeight: 400 }}>· {momentum}</span>
          )}
        </span>
      </Group>

      <div style={DIVIDER} />

      {/* Pipeline */}
      <Group label="Pipeline">
        <span style={{ ...PILL, background: 'hsl(38 92% 50% / 0.14)', borderColor: 'hsl(38 92% 50% / 0.4)', color: 'hsl(38 92% 62%)' }}>
          <Flag size={12} strokeWidth={2} />
          {stageLabel}
        </span>
        <span style={{ ...PILL, background: temp.bg, borderColor: temp.border, color: temp.color }}>
          <TempIcon size={12} strokeWidth={2} />
          {temp.label}
        </span>
      </Group>

      <div style={DIVIDER} />

      {/* Channel — the existing iMessage/SMS badge + Resolve button, unchanged */}
      <Group label="Channel">
        {channel}
      </Group>
    </div>
  );
}