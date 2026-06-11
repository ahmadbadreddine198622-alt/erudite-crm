import { PhoneCall } from 'lucide-react';

/**
 * Opens an Aircall Power Dialer / click-to-call URL for a given phone number.
 * Requires the Aircall desktop app or Chrome extension to be installed.
 */
export default function AircallButton({ phone, name, iconOnly = false, size = 'sm' }) {
  if (!phone) return null;

  // Normalize phone: strip spaces/dashes, ensure + prefix
  const normalized = phone.replace(/[\s\-()]/g, '');

  // Aircall click-to-call deep link
  const aircallUrl = `aircall://dial?phone=${encodeURIComponent(normalized)}`;

  return (
    <a
      href={aircallUrl}
      title={`Aircall: Call ${name || normalized}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 select-none"
      style={{
        background: 'rgba(0,190,255,0.12)',
        color: '#00beff',
        border: '1px solid rgba(0,190,255,0.25)',
        textDecoration: 'none',
      }}
    >
      <PhoneCall className="w-3 h-3" />
      {!iconOnly && 'Aircall'}
    </a>
  );
}