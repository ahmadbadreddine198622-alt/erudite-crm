import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import useHasWhatsApp, { normalizePhone } from '@/hooks/useHasWhatsApp';
import { cn } from '@/lib/utils';

/**
 * WhatsAppPhone — renders a phone number with a clickable WhatsApp icon.
 *
 * Props:
 *  phone           string   raw phone in any format
 *  name            string   contact name (for tooltip)
 *  leadId          string   lead ID (for deep-link)
 *  prefilledMessage string  pre-filled WA message
 *  size            "xs"|"sm"|"md"  default "sm"
 *  showNumber      boolean  default true
 *  doNotContact    boolean  if true, icon is disabled
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
  const { status, e164 } = useHasWhatsApp(phone);
  const [showCtx, setShowCtx] = useState(false);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });
  const ctxRef = useRef(null);

  const iconSize = size === 'xs' ? 12 : size === 'md' ? 18 : 14;
  const textSize = size === 'xs' ? 'text-[10px]' : size === 'md' ? 'text-sm' : 'text-xs';

  // Query existing WhatsApp conversation for this number
  const { data: convs = [] } = useQuery({
    queryKey: ['wa_conv_by_phone', e164],
    queryFn: () => e164 ? base44.entities.WhatsAppConversation.filter({ wa_phone_e164: e164 }) : [],
    enabled: !!e164 && status === 'yes',
    staleTime: 60000,
  });

  const handleWhatsAppClick = async (e) => {
    e.stopPropagation();
    if (doNotContact || !e164 || status === 'no') return;

    if (convs.length > 0) {
      navigate(`/whatsapp?phone=${encodeURIComponent(e164)}`);
    } else {
      // Create stub conversation so it appears in inbox
      try {
        await base44.entities.WhatsAppConversation.create({
          wa_phone_e164: e164,
          wa_display_name: name || e164,
          status: 'new',
          last_message: prefilledMessage || 'New conversation',
          last_message_at: new Date().toISOString(),
          ...(leadId ? { lead_id: leadId } : {}),
        });
      } catch (_) {}
      const waNum = e164.replace('+', '');
      const waUrl = `https://wa.me/${waNum}${prefilledMessage ? `?text=${encodeURIComponent(prefilledMessage)}` : ''}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleContextMenu = (e) => {
    if (!e164) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxPos({ x: e.clientX, y: e.clientY });
    setShowCtx(true);
  };

  const copyWaLink = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://wa.me/${(e164 || '').replace('+', '')}`);
    setShowCtx(false);
  };

  const displayPhone = showNumber ? (phone || '') : null;

  // Icon color based on status
  const iconColor = status === 'yes' ? '#25D366'
    : status === 'loading' ? '#94a3b8'
    : '#94a3b8';

  const iconVisible = status !== 'no';

  return (
    <span
      className="inline-flex items-center gap-1 select-none"
      style={{ direction: 'ltr' }}
    >
      {displayPhone && (
        <a
          href={`tel:${e164 || phone}`}
          onClick={e => e.stopPropagation()}
          className={cn('text-slate-700 hover:text-slate-900 hover:underline', textSize)}
        >
          {displayPhone}
        </a>
      )}

      {iconVisible && (
        <button
          type="button"
          aria-label={doNotContact ? 'Lead is opted out of contact' : `Open WhatsApp chat with ${name || phone}`}
          title={
            doNotContact ? '⛔ Lead is opted out of contact'
            : status === 'loading' ? 'Checking WhatsApp...'
            : status === 'yes' ? `Open WhatsApp chat with ${name || phone}`
            : 'Not on WhatsApp'
          }
          disabled={doNotContact || status === 'no'}
          onClick={handleWhatsAppClick}
          onContextMenu={handleContextMenu}
          onKeyDown={e => e.key === 'Enter' && handleWhatsAppClick(e)}
          className={cn(
            'inline-flex items-center justify-center rounded p-0.5 transition-all',
            'w-5 h-5 shrink-0', // reserve space — no layout shift
            status === 'yes' && !doNotContact
              ? 'hover:bg-green-100 hover:scale-110 cursor-pointer'
              : 'cursor-default opacity-50',
            doNotContact && 'opacity-30 cursor-not-allowed',
            status === 'loading' && 'animate-pulse',
          )}
        >
          <WhatsAppIcon
            size={iconSize}
            color={doNotContact ? '#ef4444' : iconColor}
          />
        </button>
      )}

      {/* Context Menu */}
      {showCtx && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCtx(false)} />
          <div
            ref={ctxRef}
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
              onClick={copyWaLink}
            >
              📋 Copy wa.me link
            </button>
          </div>
        </>
      )}
    </span>
  );
}