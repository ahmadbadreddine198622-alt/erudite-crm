import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { normalizePhone } from '@/hooks/useHasWhatsApp';
import { cn } from '@/lib/utils';

/**
 * WhatsAppPhone — renders a phone number with a clickable WhatsApp icon.
 * Clicking the icon navigates directly to /whatsapp?phone={e164}
 */
export default function WhatsAppPhone({
  phone,
  name,
  leadId,
  prefilledMessage,
  size = 'sm',
  showNumber = true,
  doNotContact = false,
}) {
  const navigate = useNavigate();
  const [showCtx, setShowCtx] = useState(false);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });

  const e164 = phone ? normalizePhone(phone) : null;
  const iconSize = size === 'xs' ? 12 : size === 'md' ? 18 : 14;
  const textSize = size === 'xs' ? 'text-[10px]' : size === 'md' ? 'text-sm' : 'text-xs';

  const handleWhatsAppClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (doNotContact || !e164) return;
    navigate(`/whatsapp?phone=${encodeURIComponent(e164)}`);
  };

  const handleContextMenu = (e) => {
    if (!e164) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxPos({ x: e.clientX, y: e.clientY });
    setShowCtx(true);
  };

  if (!phone) return null;

  return (
    <span className="inline-flex items-center gap-1 select-none" style={{ direction: 'ltr' }}>
      {showNumber && (
        <a
          href={`tel:${e164 || phone}`}
          onClick={e => e.stopPropagation()}
          className={cn('text-slate-700 hover:text-slate-900 hover:underline', textSize)}
        >
          {phone}
        </a>
      )}

      <button
        type="button"
        aria-label={doNotContact ? 'Lead is opted out of contact' : `Open WhatsApp chat`}
        title={doNotContact ? '⛔ Do not contact' : `Open WhatsApp chat${name ? ` with ${name}` : ''}`}
        disabled={doNotContact}
        onClick={handleWhatsAppClick}
        onContextMenu={handleContextMenu}
        onKeyDown={e => e.key === 'Enter' && handleWhatsAppClick(e)}
        className={cn(
          'inline-flex items-center justify-center rounded p-0.5 transition-all w-5 h-5 shrink-0',
          !doNotContact ? 'hover:bg-green-100 hover:scale-110 cursor-pointer' : 'opacity-30 cursor-not-allowed',
        )}
      >
        <WhatsAppIcon size={iconSize} color={doNotContact ? '#ef4444' : '#25D366'} />
      </button>

      {/* Context Menu */}
      {showCtx && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCtx(false)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px] text-sm"
            style={{ left: ctxPos.x, top: ctxPos.y }}
          >
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-50"
              onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(e); setShowCtx(false); }}
            >
              💬 Open in app
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://web.whatsapp.com/send?phone=${(e164 || '').replace('+', '')}`, '_blank');
                setShowCtx(false);
              }}
            >
              🌐 Open in WhatsApp Web
            </button>
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`https://wa.me/${(e164 || '').replace('+', '')}`);
                setShowCtx(false);
              }}
            >
              📋 Copy wa.me link
            </button>
          </div>
        </>
      )}
    </span>
  );
}