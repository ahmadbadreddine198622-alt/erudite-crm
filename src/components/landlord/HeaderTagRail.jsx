import React from 'react';
import { User, Flag, Snowflake, Thermometer, Flame, Zap } from 'lucide-react';

// Short archetype labels + color tints — mirrors the maps in LandlordCard.jsx so the detail
// header reads identically to the list cards (e.g. individual_end_user_relocating → "Relocating").
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

// Profile pill is violet (= who). Archetype-specific accents are intentionally NOT used here —
// in the header, color encodes the GROUP (profile/pipeline/channel), not the archetype variant.
const PROFILE_COLOR = { color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.32)' };
const PIPELINE_COLOR = { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)', border: 'hsl(38 92% 50% / 0.4)' };

// Temperature ramp for rapport: cold = blue/snowflake, warm = amber/thermometer, hot = red/flame.
function tempMeta(temperature) {
  if (temperature === 'hot') return { Icon: Flame, label: 'Hot', color: '#fca5a5', bg: 'rgba(239,68,68,0.16)', border: 'rgba(239,68,68,0.4)' };
  if (temperature === 'warm') return { Icon: Thermometer, label: 'Warm', color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.16)', border: 'hsl(38 92% 50% / 0.4)' };
  return { Icon: Snowflake, label: 'Cold', color: '#93c5fd', bg: 'rgba(59,130,246,0.16)', border: 'rgba(59,130,246,0.4)' };
}

// One consistent pill: rounded-full, ~3px 9px, 11px / weight 500, leading icon, sentence case.
function Pill({ Icon, label, meta }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      fontSize: 11, fontWeight: 500, lineHeight: 1.2, whiteSpace: 'nowrap',
      background: meta.bg, border: '1px solid ' + meta.border, color: meta.color,
      fontFamily: "'Inter',sans-serif",
    }}>
      <Icon style={{ width: 12, height: 12, flex: 'none' }} />
      {label}
    </span>
  );
}

const GroupLabel = ({ children }) => (
  <span style={{
    fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.38)', fontFamily: "'Inter',sans-serif",
  }}>{children}</span>
);

const Divider = () => (
  <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
);

/**
 * Grouped header "tag rail": Profile (who) · Pipeline (stage + warmth) · Channel (iMessage/SMS).
 * Each group has a tiny sentence-case label above it and a thin vertical divider between groups.
 *
 * Props:
 *  - archetypeKey: raw Landlord.landlord_archetype enum
 *  - stageLabel: human stage label (already resolved)
 *  - temperature: 'cold' | 'warm' | 'hot'
 *  - strikeNow / strikeText: pulsing leading badge
 *  - channelSlot: the iMessage/SMS badge node (+ its Resolve button), rendered unchanged
 */
export default function HeaderTagRail({ archetypeKey, stageLabel, temperature, strikeNow, strikeText, channelSlot }) {
  const archetypeLabel = ARCHETYPE_LABELS[archetypeKey] || 'Landlord';
  const t = tempMeta(temperature);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
      {strikeNow && (
        <span title={strikeText || undefined} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'center',
          padding: '4px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 800,
          letterSpacing: '0.04em', whiteSpace: 'nowrap',
          background: 'linear-gradient(135deg, hsl(38 92% 55%), hsl(38 92% 48%))',
          border: '1px solid hsl(38 92% 60%)', color: '#1a1205',
          boxShadow: '0 0 10px hsl(38 92% 50% / 0.45)',
          animation: 'ld-pulse 1.6s ease-in-out infinite', fontFamily: "'Inter',sans-serif",
        }}>
          <Zap style={{ width: 12, height: 12 }} /> Strike now
        </span>
      )}

      {/* Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <GroupLabel>Profile</GroupLabel>
        <Pill Icon={User} label={archetypeLabel} meta={PROFILE_COLOR} />
      </div>

      <Divider />

      {/* Pipeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <GroupLabel>Pipeline</GroupLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pill Icon={Flag} label={stageLabel} meta={PIPELINE_COLOR} />
          <Pill Icon={t.Icon} label={t.label} meta={t} />
        </div>
      </div>

      {channelSlot && (
        <>
          <Divider />
          {/* Channel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <GroupLabel>Channel</GroupLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {channelSlot}
            </div>
          </div>
        </>
      )}
    </div>
  );
}