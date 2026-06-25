// Sticky identity header — avatar, name (EN + AR/RTL), language/archetype/rapport chips,
// property sub-line, channel-aware quick actions, and the pipeline stage arrows.
// Reuses the existing StageArrows handler (onStageChange) — does not fork it.
import { Phone, MessageCircle, MessageSquare, Mail, Send, PhoneCall } from 'lucide-react';
import StageArrows from '../StageArrows';
import { PALETTE, initialsOf, fmtAED, titleize, RAPPORT_COLORS, LANG_LABEL } from './cmdHelpers.js';

function Chip({ label, color }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}1f`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

function ActionBtn({ icon: Icon, label, color, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} unavailable` : label}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors"
      style={{
        background: disabled ? 'rgba(255,255,255,0.03)' : `${color}1a`,
        color: disabled ? PALETTE.textFaint : color,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : color + '40'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function CommandHeader({ landlord, raw, options, onSwitch, onStageChange, onAction }) {
  const L = landlord;
  const imAvailable = raw.imessage_status === 'available';
  const rapport = raw.rapport_level || 'cold';
  const rapportColor = RAPPORT_COLORS[rapport] || RAPPORT_COLORS.cold;

  const subParts = [
    L.lead_type ? titleize(L.lead_type.replace('landlord_', '')) : null,
    raw.project_name,
    raw.unit_reference ? `Unit ${raw.unit_reference}` : null,
    raw.bedrooms != null ? `${raw.bedrooms} Bed` : null,
    L.sqft,
    `Asking ${raw.asking_price_aed ? fmtAED(raw.asking_price_aed) : '—'}`,
  ].filter(Boolean);

  return (
    <div
      className="sticky top-0 z-30"
      style={{ background: 'rgba(11,18,30,0.92)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${PALETTE.cardBorder}`, paddingLeft: '3.5rem' }}
    >
      <div className="px-4 pt-3 pb-2.5 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="shrink-0 flex items-center justify-center rounded-2xl"
              style={{ width: 48, height: 48, background: `${PALETTE.gold}1f`, border: `1px solid ${PALETTE.gold}44`, color: PALETTE.gold, fontWeight: 700, fontSize: 17 }}
            >
              {initialsOf(raw.first_name, raw.last_name) || L.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 26, lineHeight: 1.05, color: PALETTE.text }}>
                  {L.name}
                </h1>
                {raw.preferred_language && <Chip label={LANG_LABEL[raw.preferred_language] || raw.preferred_language.toUpperCase()} color={PALETTE.blue} />}
                {raw.landlord_archetype && <Chip label={titleize(raw.landlord_archetype)} color="#c4b5fd" />}
                <Chip label={titleize(rapport)} color={rapportColor} />
              </div>
              {raw.full_name_ar && (
                <div dir="rtl" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: PALETTE.textDim, marginTop: 1 }}>
                  {raw.full_name_ar}
                </div>
              )}
              <div className="text-[12px] mt-0.5" style={{ color: PALETTE.textDim }}>
                {subParts.join('  ·  ')}
              </div>
            </div>
          </div>

          {/* Viewing switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PALETTE.textFaint }}>Viewing</span>
            <select
              value={L.id}
              onChange={onSwitch}
              className="h-8 px-2 rounded-lg text-[12px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${PALETTE.cardBorder}`, color: PALETTE.text, cursor: 'pointer' }}
            >
              {(options || []).map((o) => (
                <option key={o.id} value={o.id} style={{ background: '#13182a' }}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <ActionBtn icon={Phone} label="Call" color={PALETTE.blue} disabled={!raw.phone} onClick={() => onAction('call')} />
          <ActionBtn icon={MessageCircle} label="WhatsApp" color={PALETTE.green} disabled={!(raw.whatsapp || raw.phone)} onClick={() => onAction('whatsapp')} />
          <ActionBtn icon={MessageSquare} label={imAvailable ? 'iMessage' : 'SMS'} color="#0A84FF" disabled={!raw.phone && !raw.imessage_handle} onClick={() => onAction('imessage')} />
          <ActionBtn icon={Mail} label="Email" color={PALETTE.gold} disabled={!raw.email} onClick={() => onAction('email')} />
          <ActionBtn icon={Send} label="Telegram" color="#29b6f6" disabled={!raw.telegram_chat_id} onClick={() => onAction('telegram')} />
          <ActionBtn icon={PhoneCall} label="Log Call" color="#c4b5fd" onClick={() => onAction('log_call')} />
          <div className="ml-1">
            <StageArrows landlord={{ id: L.id, stage: raw.stage, ...raw }} onStageChange={onStageChange} />
          </div>
        </div>
      </div>
    </div>
  );
}