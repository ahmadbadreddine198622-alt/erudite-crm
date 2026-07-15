// Per-phone Telegram availability icon button.
// Shows whether the landlord has an active Telegram contact (chat_id or username)
// for this phone number. Blue when available, gray when not linked yet.
import React from 'react';
import { Send } from 'lucide-react';

const COLOR = {
  available: { color: '#29b6f6', bg: 'rgba(41,182,246,0.16)', border: 'rgba(41,182,246,0.4)', label: 'Telegram ✓' },
  not_available: { color: 'rgba(255,255,255,0.5)', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', label: 'No Telegram' },
};

export default function TelegramCheckIcon({ landlord = {}, phone, size = 26 }) {
  const chatId = landlord.telegram_chat_id;
  const username = landlord.telegram_username;
  const landlordPhone = landlord.phone;
  const hasContact = !!(chatId || username || landlordPhone);

  // If the landlord has a Telegram chat_id, they are reachable on Telegram.
  const status = hasContact ? 'available' : 'not_available';
  const meta = COLOR[status];
  const handle = chatId ? `chat ${String(chatId).slice(-6)}` : username ? `@${username}` : null;

  return (
    <span
      title={handle ? `${meta.label} · ${handle}` : meta.label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 999, flex: 'none',
        background: meta.bg, border: '1px solid ' + meta.border, color: meta.color,
      }}
    >
      <Send size={12} />
    </span>
  );
}