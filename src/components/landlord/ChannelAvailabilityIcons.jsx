// Compact WhatsApp / iMessage / Telegram availability icons for the Landlord Kanban card.
// Shows three tiny dots — green (WhatsApp), teal (iMessage), blue (Telegram) —
// only when the landlord has at least one contact on that platform.
import { memo } from 'react';
import { MessageCircle, Send, MessageSquare } from 'lucide-react';
import useHasWhatsApp from '@/hooks/useHasWhatsApp';

function normalizePhone(raw) {
  let d = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.startsWith('971')) return '+' + d;
  if (d.startsWith('0')) return '+971' + d.slice(1);
  return '+971' + d;
}
function findHandleStatus(address, handles) {
  if (!address || !Array.isArray(handles)) return 'unknown';
  const norm = normalizePhone(address);
  const isEmail = String(address).includes('@');
  const hit = handles.find((h) => {
    if (!h || !h.handle) return false;
    if (isEmail) return String(h.handle).toLowerCase() === String(address).toLowerCase();
    return normalizePhone(h.handle) === norm;
  });
  return hit?.imessage_status || 'unknown';
}

function ChannelAvailabilityIcons({ landlord }) {
  const phone = landlord.phone || landlord.whatsapp;
  const { status: waStatus } = useHasWhatsApp(phone);

  const imessageHandles = Array.isArray(landlord.imessage_handles) ? landlord.imessage_handles : [];
  const imeStatus = phone ? findHandleStatus(phone, imessageHandles) : 'unknown';

  const hasTelegram = !!(landlord.telegram_chat_id || landlord.telegram_username || (phone && landlord.telegram_chat_id));

  const waOn = waStatus === 'yes';
  const imeOn = imeStatus === 'available';
  const tgOn = hasTelegram;

  // Only render if at least one channel is available
  if (!waOn && !imeOn && !tgOn) return null;

  const dot = (on, icon, color, label) => {
    if (!on) return null;
    return (
      <span
        title={label}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, borderRadius: 999, flex: 'none',
          background: color + '22', border: '1px solid ' + color + '55', color,
        }}
      >
        {icon}
      </span>
    );
  };

  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {dot(waOn, <MessageCircle size={8} />, '#25D366', 'On WhatsApp')}
      {dot(imeOn, <MessageSquare size={8} />, '#0A84FF', 'iMessage available')}
      {dot(tgOn, <Send size={8} />, '#29b6f6', 'Telegram available')}
    </span>
  );
}

export default memo(ChannelAvailabilityIcons);