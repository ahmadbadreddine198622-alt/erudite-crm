import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { normalizePhone } from '@/lib/phone';
import { toast } from 'sonner';

/**
 * UniversalWhatsAppAction — one-tap WhatsApp action for any phone number.
 * 
 * Usage: Place next to any phone/whatsapp field across the CRM.
 * - Checks if number is on WhatsApp
 * - Opens/creates WhatsAppConversation linked to the source record
 * - Routes to unified composer in /whatsapp
 * 
 * Props:
 * - phone: string (required) — phone number in any format
 * - name: string — contact/display name
 * - leadId?: string — link to Lead entity
 * - landlordId?: string — link to Landlord entity (will resolve via lead)
 * - contactId?: string — link to Contact entity
 * - size?: 'xs' | 'sm' | 'md' | 'lg' (default 'sm')
 * - disabled?: boolean
 * - disabledReason?: string
 */
export default function UniversalWhatsAppAction({
  phone,
  name,
  leadId,
  landlordId,
  contactId,
  size = 'sm',
  disabled = false,
  disabledReason
}) {
  const navigate = useNavigate();
  const [isValidWhatsApp, setIsValidWhatsApp] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  const sizes = {
    xs: { icon: 14, text: 'text-xs', pad: 'p-0.5' },
    sm: { icon: 16, text: 'text-sm', pad: 'p-1' },
    md: { icon: 20, text: 'text-base', pad: 'p-1.5' },
    lg: { icon: 24, text: 'text-lg', pad: 'p-2' }
  };
  const s = sizes[size] || sizes.sm;

  const e164 = normalizePhone(phone);

  // Check WhatsApp validity on mount
  useEffect(() => {
    if (!e164 || disabled) {
      setIsValidWhatsApp(null);
      return;
    }

    const checkWhatsApp = async () => {
      try {
        const result = await base44.functions.invoke('checkWhatsAppNumber', { phone: e164 });
        setIsValidWhatsApp(result.is_valid_whatsapp);
      } catch (err) {
        console.error('WhatsApp check failed:', err);
        setIsValidWhatsApp(null);
      }
    };

    checkWhatsApp();
  }, [e164, disabled]);

  // Find or create conversation
  const findOrCreateConversation = useMutation({
    mutationFn: async () => {
      if (!e164) throw new Error('No phone number');

      // Try to find existing conversation
      const conversations = await base44.entities.WhatsAppConversation.filter({ wa_phone_e164: e164 });
      
      if (conversations.length > 0) {
        return conversations[0].id;
      }

      // Create new conversation
      const newConv = await base44.entities.WhatsAppConversation.create({
        wa_phone_e164: e164,
        wa_display_name: name || e164,
        lead_id: leadId || null,
        status: 'new',
        assigned_agent_email: (await base44.auth.me())?.email || null,
      });

      return newConv.id;
    },
    onSuccess: (convId) => {
      setConversationId(convId);
      navigate(`/whatsapp?phone=${encodeURIComponent(e164)}&conv=${convId}`);
    },
    onError: (err) => {
      toast.error('Failed to open WhatsApp: ' + err.message);
    }
  });

  const handleWhatsAppClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || !e164) return;

    if (isValidWhatsApp === false) {
      toast.error('This number is not on WhatsApp');
      return;
    }

    findOrCreateConversation.mutate();
  };

  const tooltipText = disabled
    ? (disabledReason || 'Contact disabled')
    : isValidWhatsApp === null
      ? 'Checking WhatsApp…'
      : isValidWhatsApp === false
        ? 'Not on WhatsApp'
        : conversationId
          ? 'Open conversation'
          : `Start WhatsApp chat with ${name || e164}`;

  const isLoading = findOrCreateConversation.isPending || isValidWhatsApp === null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`${s.pad} h-auto min-h-0`}
            onClick={handleWhatsAppClick}
            disabled={disabled || isLoading || isValidWhatsApp === false}
            style={{
              background: isValidWhatsApp === true ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
              border: isValidWhatsApp === true ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {isLoading ? (
              <Loader2 className={`w-${s.icon} h-${s.icon} animate-spin text-muted-foreground`} />
            ) : isValidWhatsApp === false ? (
              <AlertCircle className={`w-${s.icon} h-${s.icon} text-muted-foreground opacity-50`} />
            ) : (
              <MessageCircle className={`w-${s.icon} h-${s.icon}`} style={{ color: isValidWhatsApp === true ? 'rgb(34,197,94)' : 'hsl(38 92% 50%)' }} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}