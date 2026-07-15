import React from 'react';

// TelegramBadge — small inline badge showing whether the landlord has a Telegram
// contact target (chat_id, phone, or username). Pure presentational — mirrors the
// IMessageBadge / WhatsAppBadge pattern on the identity header channel micro-line.

const STATUS_META = {
  available: { label: 'Telegram ✓', color: '#29b6f6', bg: 'rgba(41,182,246,0.16)', border: 'rgba(41,182,246,0.4)' },
  not_available: { label: 'No Telegram', color: 'rgba(255,255,255,0.6)', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.3)' },
};

export default function TelegramBadge({ landlord = {} }) {
  const chatId = landlord.telegram_chat_id;
  const phone = landlord.phone;
  const username = landlord.telegram_username;
  const hasContact = !!(chatId || phone || username);

  const meta = hasContact ? STATUS_META.available : STATUS_META.not_available;
  const handle = chatId ? `chat ${String(chatId).slice(-6)}` : username ? `@${username}` : phone || null;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '99px',
        fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.02em', color: meta.color,
        background: meta.bg, border: '1px solid ' + meta.border, whiteSpace: 'nowrap',
      }}>
        ✈ {meta.label}
      </span>
      {hasContact && handle && (
        <span title="Telegram contact" style={{ fontSize: '9.5px', fontWeight: 600, color: '#4fc3f7', fontFamily: "'SF Mono','Menlo',monospace" }}>{handle}</span>
      )}
    </div>
  );
}