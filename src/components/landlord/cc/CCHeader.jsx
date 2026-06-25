// Sticky identity header for the Landlord Command Center.
// Channel-aware quick actions + stage move arrows. Read-only; reuses passed-in handlers.
import React from 'react';
import { Phone, MessageCircle, MessageSquare, Mail, Send, PhoneCall, ChevronLeft, ChevronRight } from 'lucide-react';
import { GOLD, Chip, fmtAEDFull, titleize } from './ccPrimitives';

const RAPPORT_META = {
  cold: { label: 'Cold', color: 'rgba(255,255,255,0.6)', bg: 'rgba(148,163,184,0.14)' },
  warming: { label: 'Warming', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  rapport_built: { label: 'Rapport built', color: '#93c5fd', bg: 'rgba(59,130,246,0.14)' },
  trust_established: { label: 'Trust established', color: '#5eead4', bg: 'rgba(20,184,166,0.14)' },
  champion: { label: 'Champion', color: GOLD, bg: 'rgba(201,162,75,0.16)' },
};

function ActionBtn({ icon: Icon, label, enabled, onClick, accent = GOLD }) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      title={enabled ? label : `${label} — unavailable`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10,
        fontSize: 11.5, fontWeight: 600, fontFamily: 'Montserrat,sans-serif',
        cursor: enabled ? 'pointer' : 'not-allowed',
        background: enabled ? `${accent}1f` : 'rgba(255,255,255,0.03)',
        color: enabled ? accent : 'rgba(255,255,255,0.3)',
        border: `1px solid ${enabled ? `${accent}55` : 'rgba(255,255,255,0.08)'}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export default function CCHeader({ vm, actions, landlordOptions, currentId, onSwitch }) {
  const rm = RAPPORT_META[vm.rapport] || RAPPORT_META.cold;
  const imLabel = vm.imessageAvailable ? 'iMessage' : 'SMS';

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'linear-gradient(180deg, rgba(11,31,58,0.98), rgba(11,31,58,0.92))',
        backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(201,162,75,0.18)',
        padding: '12px 20px 12px 56px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{ flex: 'none', width: 50, height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: GOLD, background: 'rgba(201,162,75,0.14)', border: '1px solid rgba(201,162,75,0.35)' }}>
          {vm.initials}
        </div>

        {/* Identity */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="cc-title" style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.97)' }}>{vm.name}</h1>
            {vm.language && <Chip label={vm.language} color="rgba(255,255,255,0.7)" />}
            {vm.archetypeLabel && <Chip label={vm.archetypeLabel} color="#c4b5fd" bg="rgba(139,92,246,0.14)" border="rgba(139,92,246,0.3)" />}
            <Chip label={rm.label} color={rm.color} bg={rm.bg} border={rm.bg} />
          </div>
          {vm.nameAr && (
            <div dir="rtl" style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: 18, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{vm.nameAr}</div>
          )}
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              vm.leadTypeLabel,
              vm.projectName,
              vm.unitReference,
              vm.sqft != null ? `${vm.sqft} sqft` : null,
              vm.bedsLabel,
            ].filter(Boolean).map((seg, i, arr) => (
              <React.Fragment key={i}>
                <span>{seg}</span>
                {i < arr.length - 1 && <span style={{ opacity: 0.3 }}>·</span>}
              </React.Fragment>
            ))}
            <span style={{ opacity: 0.3 }}>·</span>
            <span style={{ color: GOLD, fontWeight: 600 }}>Asking {vm.askingPrice != null ? fmtAEDFull(vm.askingPrice) : '—'}</span>
          </div>
        </div>

        {/* Viewing switcher */}
        {landlordOptions && landlordOptions.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Viewing</span>
            <select value={currentId} onChange={onSwitch} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {landlordOptions.map((o) => <option key={o.id} value={o.id} style={{ background: '#0B1F3A' }}>{o.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, flexWrap: 'wrap' }}>
        <ActionBtn icon={Phone} label="Call" enabled={!!vm.phone} onClick={actions.onCall} />
        <ActionBtn icon={MessageCircle} label="WhatsApp" enabled={!!(vm.whatsapp || vm.phone)} onClick={actions.onWhatsApp} accent="#25D366" />
        <ActionBtn icon={MessageSquare} label={imLabel} enabled={!!(vm.imessageAvailable ? vm.imessageHandle : vm.phone)} onClick={actions.onIMessage} accent="#0A84FF" />
        <ActionBtn icon={Mail} label="Email" enabled={!!vm.email} onClick={actions.onEmail} />
        <ActionBtn icon={Send} label="Telegram" enabled={!!vm.telegramChatId} onClick={actions.onTelegram} accent="#29b6f6" />
        <ActionBtn icon={PhoneCall} label="Log Call" enabled onClick={actions.onLogCall} />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={actions.onStageBack} disabled={!vm.canStageBack} title={vm.prevStageLabel ? `Back to ${vm.prevStageLabel}` : 'At first stage'}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: vm.canStageBack ? 'pointer' : 'not-allowed', background: '#0B1F3A', border: `1px solid ${vm.canStageBack ? 'rgba(201,162,75,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
            <ChevronLeft className="w-4 h-4" style={{ color: vm.canStageBack ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)' }} />
          </button>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', minWidth: 120, textAlign: 'center' }}>{vm.stageLabel}</span>
          <button onClick={actions.onStageForward} disabled={!vm.canStageForward} title={vm.nextStageLabel ? `Advance to ${vm.nextStageLabel}` : 'At final stage'}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: vm.canStageForward ? 'pointer' : 'not-allowed', background: '#0B1F3A', border: `1px solid ${vm.canStageForward ? 'rgba(201,162,75,0.6)' : 'rgba(255,255,255,0.08)'}` }}>
            <ChevronRight className="w-4 h-4" style={{ color: vm.canStageForward ? GOLD : 'rgba(255,255,255,0.25)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}