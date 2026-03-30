import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Sparkles, MessageCircle } from 'lucide-react';
import ChatThread from './ChatThread';
import AIInsightsPanel from './AIInsightsPanel';
import TagsEditor from './TagsEditor';

export default function LeadWhatsAppTab({ lead }) {
  const [reply, setReply] = useState('');
  const [showInsights, setShowInsights] = useState(true);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['wa_conv_lead', lead.id],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ lead_id: lead.id }),
    enabled: !!lead?.id,
  });

  const conv = conversations[0] || null;

  const sendMutation = useMutation({
    mutationFn: ({ conversation_id, message }) =>
      base44.functions.invoke('sendWhatsAppMessage', { conversation_id, message }),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['wa_messages', conv?.id] });
      queryClient.invalidateQueries({ queryKey: ['wa_conv_lead', lead.id] });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (conversation_id) =>
      base44.functions.invoke('analyzeConversation', { conversation_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_conv_lead', lead.id] });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!conv) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <MessageCircle className="w-10 h-10 opacity-20" />
        <p className="text-sm">No WhatsApp conversation yet</p>
        <p className="text-xs">Messages from this lead will appear here automatically</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[500px]">
      {/* Chat side */}
      <div className="flex flex-col flex-1 min-w-0 border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="h-10 px-3 border-b flex items-center justify-between bg-muted/30 shrink-0">
          <p className="text-xs font-medium text-muted-foreground">{conv.phone_number}</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2"
              onClick={() => analyzeMutation.mutate(conv.id)}
              disabled={analyzeMutation.isPending}>
              {analyzeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-accent" />}
              Analyse
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
              onClick={() => setShowInsights(v => !v)}>
              {showInsights ? 'Hide AI' : 'Show AI'}
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ChatThread conversationId={conv.id} />

        {/* Tags */}
        <div className="px-3 py-2 border-t bg-muted/20">
          <TagsEditor conv={conv} />
        </div>

        {/* Reply */}
        <div className="p-2 border-t flex gap-2 items-end shrink-0">
          <Textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Reply via WhatsApp..."
            className="min-h-[50px] max-h-24 text-sm resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (reply.trim()) sendMutation.mutate({ conversation_id: conv.id, message: reply.trim() });
              }
            }}
          />
          <Button size="icon" className="bg-green-600 hover:bg-green-700 text-white shrink-0 h-9 w-9"
            onClick={() => { if (reply.trim()) sendMutation.mutate({ conversation_id: conv.id, message: reply.trim() }); }}
            disabled={!reply.trim() || sendMutation.isPending}>
            {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* AI insights side */}
      {showInsights && (
        <div className="w-60 border rounded-lg overflow-y-auto shrink-0">
          <AIInsightsPanel conv={conv} lead={lead} />
        </div>
      )}
    </div>
  );
}