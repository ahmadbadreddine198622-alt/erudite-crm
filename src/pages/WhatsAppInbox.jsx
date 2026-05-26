import React, { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Search, Loader2, ExternalLink, RefreshCw, CheckCheck } from 'lucide-react';
import ConversationItem from '@/components/whatsapp/ConversationItem';
import WhatsAppHeader from '@/components/whatsapp/WhatsAppHeader';
import ChatThread from '@/components/whatsapp/ChatThread';
import AIInsightsPanel from '@/components/whatsapp/AIInsightsPanel';
import TagsEditor from '@/components/whatsapp/TagsEditor';
import LeadScoreCard from '@/components/shared/LeadScoreCard';
import AutomationDashboard from '@/components/whatsapp/AutomationDashboard';
import WhatsAppComposer from '@/components/whatsapp/WhatsAppComposer';
import MobileInbox from '@/components/mobile/MobileInbox';

export default function WhatsAppInbox() {
  const isMobile = useIsMobile();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [search, setSearch] = useState('');

  const [showInsights, setShowInsights] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread | open | resolved
  const queryClient = useQueryClient();

  // Conversations with real-time refetch
  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 100),
    refetchInterval: 10000,
  });

  // Real-time subscription to conversation changes
  useEffect(() => {
    const unsub = base44.entities.WhatsAppConversation.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    });
    return () => unsub();
  }, [queryClient]);

  // Real-time subscription to new messages
  useEffect(() => {
    const unsub = base44.entities.WhatsAppMessage.subscribe((event) => {
      if (event.data?.conversation_id) {
        queryClient.invalidateQueries({ queryKey: ['wa_messages', event.data.conversation_id] });
        queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
      }
    });
    return () => unsub();
  }, [queryClient]);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });

  const { data: leadScores = [] } = useQuery({
    queryKey: ['lead_scores'],
    queryFn: () => base44.entities.LeadScore.list('-calculated_at', 200),
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId) || null;
  const selectedLead = leads.find(l => l.id === selectedConv?.lead_id) || null;

  const handleAction = (action, payload) => {
    if (!selectedConvId) return;
    if (action === 'toggle_vip') {
      base44.entities.WhatsAppConversation.update(selectedConvId, { is_vip: !selectedConv.is_vip });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    } else if (action === 'toggle_star') {
      base44.entities.WhatsAppConversation.update(selectedConvId, { is_starred: !selectedConv.is_starred });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    } else if (action === 'block') {
      base44.entities.WhatsAppConversation.update(selectedConvId, { status: 'blocked' });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    } else if (action === 'set_stage' && selectedLead) {
      base44.entities.Lead.update(selectedLead.id, { stage: payload });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } else if (action === 'schedule_viewing') {
      // handled by existing schedule viewing dialog
    }
  };
  const selectedScore = leadScores.find(s => s.conversation_id === selectedConvId) || null;

  // Filter + search
  const filtered = conversations.filter(c => {
    const lead = leads.find(l => l.id === c.lead_id);
    const phone = c.wa_phone_e164 || c.phone_number || '';
    const name = lead?.full_name || c.wa_display_name || phone;
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'unread' ? (c.unread_count || 0) > 0 :
      filter === 'open' ? ['open', 'new', 'pending_agent', 'pending_customer'].includes(c.status) :
      filter === 'resolved' ? c.status === 'resolved' : true;
    return matchesSearch && matchesFilter;
  });

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const sendMutation = useMutation({
    mutationFn: ({ conversation_id, message }) =>
      base44.functions.invoke('sendWhatsAppMessage', { conversation_id, message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (conversation_id) =>
      base44.functions.invoke('analyzeConversation', { conversation_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    },
  });

  const handleSend = (text) => {
    if (!text?.trim() || !selectedConvId) return;
    sendMutation.mutate({ conversation_id: selectedConvId, message: text.trim() });
  };

  const handleScheduleSend = (text, _minutes) => {
    // TODO: schedule support — for now send immediately
    handleSend(text);
  };

  const buildPitch = (rec) => {
    if (rec.suggested_pitch) return rec.suggested_pitch;
    return `I have a great property that matches your requirements:\n${rec.reasoning || ''}\n\nMatch score: ${rec.match_score}%`;
  };

  const handleSelectConv = (convId) => {
    setSelectedConvId(convId);
    const conv = conversations.find(c => c.id === convId);
    if (conv?.unread_count > 0) {
      base44.entities.WhatsAppConversation.update(convId, { unread_count: 0 });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    }
  };

  const handleMarkResolved = () => {
    if (!selectedConvId) return;
    base44.entities.WhatsAppConversation.update(selectedConvId, { status: 'resolved', unread_count: 0 });
    queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
  };

  if (isMobile) {
    return <MobileInbox />;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar — conversation list */}
      <div className="w-80 border-r flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <h2 className="font-bold text-lg">Messages</h2>
              {unreadTotal > 0 && (
                <Badge className="bg-green-600 text-white text-xs px-1.5 py-0">{unreadTotal}</Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 border border-green-500/30 px-2.5 py-1.5 rounded-lg hover:bg-green-500/5 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> WA Web
              </a>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 h-9 text-sm bg-muted/50"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Filter pills */}
          <div className="flex gap-1 flex-wrap">
            {['all', 'unread', 'open', 'resolved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-green-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all' ? 'All' : f === 'unread' ? `Unread${unreadTotal > 0 ? ` (${unreadTotal})` : ''}` : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {search || filter !== 'all' ? 'No matching conversations' : 'No conversations yet'}
              <p className="text-xs mt-1 opacity-60">Messages will appear here when leads contact you on WhatsApp</p>
            </div>
          ) : (
            filtered.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                lead={leads.find(l => l.id === conv.lead_id)}
                selected={conv.id === selectedConvId}
                onClick={() => handleSelectConv(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      {selectedConv ? (
        <div className="flex flex-1 min-w-0">
          <div className="flex flex-col flex-1 min-w-0">
            <WhatsAppHeader
              conversation={selectedConv}
              lead={selectedLead}
              agent={null}
              onAction={handleAction}
            />

            {/* Resolved banner */}
            {selectedConv.status === 'resolved' && (
              <div className="px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground flex items-center gap-2">
                <CheckCheck className="w-3.5 h-3.5 text-green-600" />
                This conversation is resolved.
                <button
                  onClick={() => {
                    base44.entities.WhatsAppConversation.update(selectedConvId, { status: 'open' });
                    queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
                  }}
                  className="text-green-600 hover:underline"
                >
                  Reopen
                </button>
              </div>
            )}

            {/* Messages */}
            <ChatThread conversationId={selectedConvId} />

            {/* Tags row */}
            <div className="px-4 py-2 border-t bg-muted/20">
              <TagsEditor conv={selectedConv} />
            </div>

            <WhatsAppComposer
              conversation={selectedConv}
              suggestions={selectedConv.ai_next_message_suggestions}
              onSend={handleSend}
              onSendProperty={() => setShowInsights(true)}
              onScheduleSend={handleScheduleSend}
            />
          </div>

          {/* AI Insights sidebar */}
          {showInsights && (
            <div className="w-72 border-l shrink-0 overflow-y-auto p-3 space-y-4">
              <LeadScoreCard score={selectedScore} conversation={selectedConv} />
              <AIInsightsPanel
                conversation={selectedConv}
                lead={selectedLead}
                recommendations={selectedConv.ai_recommendations || []}
                onSendProperty={rec => handleSend(buildPitch(rec))}
              />
              <AutomationDashboard />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-green-500 opacity-60" />
          </div>
          <p className="text-sm font-medium">Select a conversation to start</p>
          <p className="text-xs opacity-50">
            {conversations.length === 0
              ? 'Waiting for inbound WhatsApp messages…'
              : `${conversations.length} conversation${conversations.length > 1 ? 's' : ''} available`}
          </p>
        </div>
      )}
    </div>
  );
}