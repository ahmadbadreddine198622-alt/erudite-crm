import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import useHasWhatsApp from '@/hooks/useHasWhatsApp';
import { normalizePhone, formatPhone, waMeUrl } from '@/lib/phone';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * <WhatsAppPhone />
 *
 * Renders a phone number with click-to-call AND, when the number is on
 * WhatsApp, a one-click WhatsApp button that:
 *   - Opens the in-app conversation if leadId / phone exists in WhatsAppHub
 *   - Otherwise opens wa.me in a new tab with an optional prefilled message
 *
 * Props:
 *   - phone: raw phone string in any format (required)
 *   - name: contact display name — used in tooltip + prefilled msg
 *   - leadId: optional — deep-links into the in-app WhatsApp inbox
 *   - prefilledMessage: optional — pre-fills the wa.me text box
 *   - size: "xs" | "sm" | "md" (default "sm")
 *   - showNumber: boolean — render the formatted number (default true)
 *   - layout: "inline" | "stacked"
 *   - disabled: boolean — render disabled (e.g. when do_not_contact is true)
 *   - disabledReason: string — tooltip text when disabled
 */
export default function WhatsAppPhone({
  phone,
  name,
  leadId,
  prefilledMessage,
  size = 'sm',
  showNumber = true,
  layout = 'inline',
  disabled = false,
  disabledReason
}) {
  const navigate = useNavigate();
  const { status } = useHasWhatsApp(phone);
  const e164 = normalizePhone(phone);

  if (!phone) return null;

  const sizes = {
    xs: { icon: 14, text: 'text-xs', gap: 'gap-1.5', pad: 'p-0.5' },
    sm: { icon: 16, text: 'text-sm', gap: 'gap-2', pad: 'p-1' },
    md: { icon: 20, text: 'text-base', gap: 'gap-2.5', pad: 'p-1.5' }
  };
  const s = sizes[size] || sizes.sm;

  const display = e164 ? formatPhone(e164) : phone;
  const tooltipText = disabled
    ? (disabledReason || 'Contact disabled')
    : (status === 'yes'
        ? `Open WhatsApp chat with ${name || display}`
        : status === 'no'
          ? 'Not on WhatsApp'
          : status === 'loading'
            ? 'Checking WhatsApp…'
            : 'WhatsApp status unknown');

  function handleWhatsAppClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !e164) return;
    if (leadId) {
      navigate(`/whatsapp?phone=${encodeURIComponent(e164)}&lead=${leadId}`);
    } else {
      window.open(waMeUrl(e164, prefilledMessage), '_blank', 'noopener,noreferrer');
    }
  }

  // The icon button shows in 3 visual states:
  //   yes      → green, clickable
  //   loading  → muted gray, pulsing
  //   no       → muted gray, not clickable (tooltip explains)
  //   unknown  → muted gray, clickable (best-effort open wa.me)
  const iconButton = (
    <button
      type="button"
      onClick={handleWhatsAppClick}
      disabled={disabled || status === 'no'}
      aria-label={tooltipText}
      className={`shrink-0 inline-flex items-center justify-center rounded-md transition ${s.pad} ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : status === 'yes'
            ? 'hover:bg-emerald-50 hover:scale-110 active:scale-95'
            : status === 'no'
              ? 'opacity-30 cursor-not-allowed'
              : status === 'loading'
                ? 'opacity-50 animate-pulse'
                : 'opacity-60 hover:opacity-100 hover:bg-slate-100'
      }`}
      onContextMenu={(e) => {
        // Right-click → copy wa.me link
        if (!e164) return;
        e.preventDefault();
        navigator.clipboard?.writeText(waMeUrl(e164, prefilledMessage));
      }}
    >
      <WhatsAppIcon size={s.icon} muted={status !== 'yes'} />
    </button>
  );

  const phoneLink = showNumber && (
    <a
      href={`tel:${e164 || phone}`}
      onClick={(e) => e.stopPropagation()}
      className={`${s.text} text-foreground hover:text-accent transition tabular-nums`}
    >
      {display}
    </a>
  );

  const wrapper = layout === 'stacked' ? 'flex-col items-start' : 'items-center';

  return (
    <TooltipProvider delayDuration={300}>
      <span className={`inline-flex ${wrapper} ${s.gap}`}>
        {phoneLink}
        <Tooltip>
          <TooltipTrigger asChild>{iconButton}</TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      </span>
    </TooltipProvider>
  );
}