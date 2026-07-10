import React from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';

// WhatsAppNumberPicker — compact "Send to" selector shown above the WhatsApp composer.
// Lists only the numbers confirmed valid on WhatsApp (from checkLandlordWhatsApp).
// When 0 valid numbers: nothing is rendered (send falls back to the landlord's primary phone).
// When 1 valid number: shown as a static chip (no dropdown).
// When 2+ valid numbers: a styled <select> so the agent picks which to send to.

export default function WhatsAppNumberPicker({ handles, value, onChange }) {
  const list = Array.isArray(handles) ? handles : [];
  const valid = list.filter((h) => h && h.is_valid_whatsapp);
  if (valid.length === 0) return null;
  const current = value || (valid[0] && valid[0].handle) || '';

  if (valid.length === 1) {
    const h = valid[0];
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 8, fontSize: 10.5, fontWeight: 600, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.28)', color: '#4ade80', whiteSpace: 'nowrap' }}>
        <MessageCircle size={11} /> Send to {h.handle}
      </div>
    );
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
      <MessageCircle size={11} style={{ color: '#4ade80' }} /> Send to
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <select
          value={current}
          onChange={(e) => onChange && onChange(e.target.value)}
          style={{
            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
            padding: '4px 26px 4px 9px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            fontFamily: "'Inter',sans-serif", cursor: 'pointer',
            background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.28)',
            color: '#4ade80', outline: 'none',
          }}
        >
          {valid.map((h) => (
            <option key={h.handle} value={h.handle} style={{ background: '#1a2235', color: '#fff' }}>
              {h.handle} {h.source_field === 'phone' ? '(primary)' : h.source_field === 'whatsapp' ? '(WA)' : '(secondary)'}
            </option>
          ))}
        </select>
        <ChevronDown size={11} style={{ position: 'absolute', right: 7, pointerEvents: 'none', color: '#4ade80' }} />
      </div>
    </label>
  );
}