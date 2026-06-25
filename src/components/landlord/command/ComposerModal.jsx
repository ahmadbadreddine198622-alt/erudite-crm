// Slide-over modal that hosts the EXISTING composers based on the active channel.
// Reuses EmailComposer / IMessageComposer / AppointmentComposer / QuickChatComposer —
// no forked send logic. Opened by the header quick-actions, "Do it", and "Send".
import { X } from 'lucide-react';
import EmailComposer from '../EmailComposer';
import IMessageComposer from '../IMessageComposer';
import AppointmentComposer from '../AppointmentComposer';
import QuickChatComposer from './QuickChatComposer';
import { PALETTE } from './cmdHelpers';

const TITLES = {
  email: 'Email',
  imessage: 'iMessage / SMS',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  log_call: 'Log Call',
};

export default function ComposerModal({ open, channel, raw, prefill, onClose, onSent }) {
  if (!open) return null;
  const id = raw.id;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative h-full w-full max-w-md overflow-y-auto"
        style={{ background: PALETTE.card, borderLeft: `1px solid ${PALETTE.cardBorder}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3" style={{ background: PALETTE.card, borderBottom: `1px solid ${PALETTE.cardBorder}` }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: PALETTE.text }}>{TITLES[channel] || 'Compose'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: PALETTE.textDim }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          {channel === 'email' && <EmailComposer landlordId={id} toEmail={raw.email} onLogged={() => onSent?.()} />}
          {channel === 'imessage' && <IMessageComposer landlordId={id} onSent={() => onSent?.()} onFallback={() => {}} />}
          {(channel === 'whatsapp') && <QuickChatComposer landlordId={id} channel="whatsapp" prefill={prefill} onSent={() => onSent?.()} />}
          {channel === 'telegram' && <QuickChatComposer landlordId={id} channel="telegram" prefill={prefill} onSent={() => onSent?.()} />}
          {channel === 'log_call' && <AppointmentComposer landlordId={id} agentEmail={raw.assigned_agent_email} onBooked={() => onSent?.()} />}
        </div>
      </div>
    </div>
  );
}