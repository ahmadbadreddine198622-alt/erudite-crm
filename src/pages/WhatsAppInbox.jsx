import React, { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Search, Send, Loader2, Sparkles, RefreshCw, Tag, X, QrCode } from 'lucide-react';
import ConversationItem from '@/components/whatsapp/ConversationItem';
import ConversationListHeader from '@/components/whatsapp/ConversationListHeader';
import ChatHeader from '@/components/whatsapp/ChatHeader';
import ChatThread from '@/components/whatsapp/ChatThread';
import AIInsightsPanel from '@/components/whatsapp/AIInsightsPanel';
import TagsEditor from '@/components/whatsapp/TagsEditor';
import WhatsAppWebPanel from '@/components/whatsapp/WhatsAppWebPanel';
import SmartReplies from '@/components/whatsapp/SmartReplies';
import LeadScoreCard from '@/components/shared/LeadScoreCard';
import AutomationDashboard from '@/components/whatsapp/AutomationDashboard';
import VoiceRecorder from '@/components/whatsapp/VoiceRecorder';
import TemplateSelector from '@/components/whatsapp/TemplateSelector';
import MobileInbox from '@/components/mobile/MobileInbox';

export default function WhatsAppInbox() {
  const isMobile = useIsMobile();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [showInsights, setShowInsights] = useState(true);
  const [activeTab, setActiveTab] = useState('crm'); // 'crm' | 'web'
  const queryClient = useQueryClient();

  if (isMobile) {
    return <MobileInbox />;
  }

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 50),
    refetchInterval: 15000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: leadScores = [] } = useQuery({
    queryKey: ['lead_scores'],
    queryFn: () => base44.entities.LeadScore.list('-calculated_at', 200),
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId) || null;
  const selectedLead = leads.find(l => l.id === selectedConv?.lead_id) || null;
  const selectedScore = leadScores.find(s => s.conversation_id === selectedConvId) || null;

  const filtered = conversations.filter(c => {
    const lead = leads.find(l => l.id === c.lead_id);
    const name = lead?.name || c.phone_number || '';
    return name.toLowerCase().includes(search.toLowerCase()) || c.phone_number?.includes(search);
  });

  const sendMutation = useMutation({
    mutationFn: ({ conversation_id, message }) =>
      base44.functions.invoke('sendWhatsAppMessage', { conversation_id, message }),
    onSuccess: () => {
      setReply('');
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

  const handleSend = () => {
    if (!reply.trim() || !selectedConvId) return;
    sendMutation.mutate({ conversation_id: selectedConvId, message: reply.trim() });
  };

  // Mark as read on select
  useEffect(() => {
    if (selectedConvId && selectedConv?.unread_count > 0) {
      base44.entities.WhatsAppConversation.update(selectedConvId, { unread_count: 0 });
    }
  }, [selectedConvId]);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar — conversation list */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-4 border-b bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <h2 className="font-bold text-lg">Messages</h2>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('crm')}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors ${activeTab === 'crm' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                CRM
              </button>
              <button
                onClick={() => setActiveTab('web')}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${activeTab === 'web' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <QrCode className="w-3 h-3" /> Web
              </button>
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
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No conversations yet
            </div>
          ) : (
            filtered.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                lead={leads.find(l => l.id === conv.lead_id)}
                selected={conv.id === selectedConvId}
                onClick={() => setSelectedConvId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* WhatsApp Web Tab - opens guide to connect via new tab */}
      {activeTab === 'web' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <WhatsAppWebPanel key="wa-web-panel" />
        </div>
      )}

      {/* Main chat area */}
      {activeTab === 'crm' && selectedConv ? (
        <div className="flex flex-1 min-w-0">
          <div className="flex flex-col flex-1 min-w-0">
            <ChatHeader
              lead={selectedLead}
              conversation={selectedConv}
              onAnalyze={() => analyzeMutation.mutate(selectedConvId)}
              onToggleInsights={() => setShowInsights(v => !v)}
              analyzing={analyzeMutation.isPending}
              showingInsights={showInsights}
            />

            {/* Messages */}
            <ChatThread conversationId={selectedConvId} />

            {/* Tags row */}
            <div className="px-4 py-2 border-t bg-muted/20">
              <TagsEditor conv={selectedConv} />
            </div>

            {/* Smart Replies */}
            <div className="border-t bg-muted/10 pt-2">
              <SmartReplies conversationId={selectedConvId} onSelect={setReply} />
            </div>

            {/* Reply box */}
            <div className="border-t p-3 space-y-2 shrink-0">
              <VoiceRecorder onTranscribe={setReply} />
              <div className="flex gap-2 items-end">
                <Textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Type a message or use voice..."
                  className="min-h-[60px] max-h-32 text-sm resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!reply.trim() || sendMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                >
                  {sendMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex gap-2">
                <TemplateSelector onSelectTemplate={setReply} />
              </div>
            </div>
          </div>

          {/* AI Insights sidebar */}
          {showInsights && (
            <div className="w-72 border-l shrink-0 overflow-y-auto p-3 space-y-4">
              <LeadScoreCard score={selectedScore} conversation={selectedConv} />
              <AIInsightsPanel conv={selectedConv} lead={selectedLead} />
              <AutomationDashboard />
            </div>
          )}
        </div>
      ) : activeTab === 'crm' ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
          <MessageCircle className="w-12 h-12 opacity-20" />
          <p className="text-sm">Select a conversation</p>
          <button
            onClick={() => setActiveTab('web')}
            className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 border border-green-500/30 px-3 py-1.5 rounded-full hover:bg-green-500/5 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" /> Connect WhatsApp Web
          </button>
        </div>
      ) : null}
    </div>
  );
}