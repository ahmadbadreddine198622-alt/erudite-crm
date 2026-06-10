import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Sparkles, MessageCircle, Building2, User, ExternalLink } from 'lucide-react';
import ChatThread from './ChatThread';
import TagsEditor from './TagsEditor';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

/**
 * LeadWhatsAppTab — shows Business and Personal WhatsApp conversations for a lead
 * in two separate tabs. Looks up conversations by phone number match.
 */
export default function LeadWhatsAppTab({ lead }) {
  const [activeChannel, setActiveChannel] = useState('business');
  const [reply, setReply] = useState('');
  const queryClient = useQueryClient();

  const leadPhone = lead.phone || lead.whatsapp || '';
  const normalizedLeadPhone = leadPhone ? normalizePhoneNumber(leadPhone) : '';

  // Fetch all conversations that match this lead's phone number
  const { data: allConvs = [], isLoading } = useQuery({
    queryKey: ['wa_conv_lead_phone', normalizedLeadPhone],
    queryFn: async () => {
      if (!normalizedLeadPhone) return [];
      // Fetch by wa_phone_e164 (primary field used by webhooks)
      const byE164 = await base44.entities.WhatsAppConversation.filter({ wa_phone_e164: normalizedLeadPhone }).catch(() => []);
      // Also fetch by lead_id link if set
      const byLeadId = lead.id ? await base44.entities.WhatsAppConversation.filter({ lead_id: lead.id }).catch(() => []) : [];
      // Merge + dedupe by id
      const map = new Map();
      [...byE164, ...byLeadId].forEach(c => { if (c?.id) map.set(c.id, c); });
      return Array.from(map.values());
    },
    enabled: !!normalizedLeadPhone || !!lead.id,
  });

  // Separate by channel
  const businessConv = allConvs.find(c => c.channel === 'business') || null;
  const personalConv = allConvs.find(c => c.channel === 'personal' || !c.channel) || null;

  const activeConv = activeChannel === 'business' ? businessConv : personalConv;

  const sendMutation = useMutation({
    mutationFn: ({ message, channel }) =>
      base44.functions.invoke('sendMultiChannelWhatsApp', {
        conversation_id: activeConv?.id,
        landlord_id: lead.id,
        text: message,
        channel,
      }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['wa_conv_lead_phone', normalizedLeadPhone] });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (conversation_id) =>
      base44.functions.invoke('analyzeConversation', { conversation_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_conv_lead_phone', normalizedLeadPhone] });
    },
  });

  const handleSend = () => {
    if (!reply.trim()) return;
    sendMutation.mutate({ message: reply.trim(), channel: activeChannel });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!normalizedLeadPhone) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <MessageCircle className="w-10 h-10 opacity-20" />
        <p className="text-sm">No phone number on this lead</p>
        <p className="text-xs">Add a phone number to see WhatsApp conversations</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[520px]">
      {/* Channel tabs */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setActiveChannel('business')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
          style={{
            background: activeChannel === 'business' ? 'hsl(152 69% 40% / 0.15)' : 'rgba(255,255,255,0.04)',
            border: activeChannel === 'business' ? '1px solid hsl(152 69% 40% / 0.4)' : '1px solid rgba(255,255,255,0.1)',
            color: activeChannel === 'business' ? 'hsl(152 69% 55%)' : 'rgba(255,255,255,0.5)',
          }}
        >
          <Building2 className="w-3.5 h-3.5" />
          Business
          {businessConv && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>
        <button
          onClick={() => setActiveChannel('personal')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
          style={{
            background: activeChannel === 'personal' ? 'hsl(217 91% 60% / 0.15)' : 'rgba(255,255,255,0.04)',
            border: activeChannel === 'personal' ? '1px solid hsl(217 91% 60% / 0.4)' : '1px solid rgba(255,255,255,0.1)',
            color: activeChannel === 'personal' ? 'hsl(217 91% 70%)' : 'rgba(255,255,255,0.5)',
          }}
        >
          <User className="w-3.5 h-3.5" />
          Personal
          {personalConv && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-400" />
          )}
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {activeConv && (
            <>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2"
                onClick={() => analyzeMutation.mutate(activeConv.id)}
                disabled={analyzeMutation.isPending}>
                {analyzeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-accent" />}
                Analyse
              </Button>
              <a
                href={`/whatsapp?conv=${activeConv.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 h-6 px-2 text-xs rounded-md opacity-60 hover:opacity-100 transition-opacity"
                title="Open in full inbox"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Chat area */}
      {!activeConv ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3 border rounded-xl border-white/10">
          <MessageCircle className="w-10 h-10 opacity-20" />
          <p className="text-sm">
            No {activeChannel} conversation yet
          </p>
          <p className="text-xs opacity-60">
            {activeChannel === 'business'
              ? 'Messages from your business number will appear here'
              : 'Messages from your personal number will appear here'}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 text-xs h-7"
            onClick={() => {
              sendMutation.mutate({ message: 'Hello!', channel: activeChannel });
            }}
          >
            Start conversation
          </Button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 border rounded-xl overflow-hidden"
          style={{ borderColor: activeChannel === 'business' ? 'hsl(152 69% 40% / 0.3)' : 'hsl(217 91% 60% / 0.3)' }}>
          {/* Header bar */}
          <div className="h-9 px-3 border-b flex items-center justify-between shrink-0"
            style={{
              background: activeChannel === 'business' ? 'hsl(152 69% 40% / 0.08)' : 'hsl(217 91% 60% / 0.08)',
              borderColor: activeChannel === 'business' ? 'hsl(152 69% 40% / 0.2)' : 'hsl(217 91% 60% / 0.2)',
            }}>
            <div className="flex items-center gap-1.5">
              {activeChannel === 'business'
                ? <Building2 className="w-3 h-3 text-emerald-500" />
                : <User className="w-3 h-3 text-blue-400" />}
              <p className="text-xs font-medium text-muted-foreground">{activeConv.wa_phone_e164 || activeConv.phone_number}</p>
            </div>
          </div>

          {/* Messages */}
          <ChatThread
            key={activeConv.id}
            conversationId={activeConv.id}
            allConversationIds={[activeConv.id]}
            contactName={lead.full_name || lead.name}
          />

          {/* Tags */}
          <div className="px-3 py-1.5 border-t bg-white/3">
            <TagsEditor conv={activeConv} />
          </div>

          {/* Reply box */}
          <div className="p-2 border-t flex gap-2 items-end shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <Textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder={`Reply via ${activeChannel} WhatsApp…`}
              className="min-h-[44px] max-h-24 text-sm resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0 h-9 w-9 text-white"
              style={{ background: activeChannel === 'business' ? 'hsl(152 69% 40%)' : 'hsl(217 91% 50%)' }}
              onClick={handleSend}
              disabled={!reply.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}