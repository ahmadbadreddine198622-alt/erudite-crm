import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Send, ArrowLeft } from 'lucide-react';

export default function MobileInbox() {
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [reply, setReply] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 50),
    refetchInterval: 10000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['wa_messages', selectedConvId],
    queryFn: () => selectedConvId ? base44.entities.WhatsAppMessage.filter({ conversation_id: selectedConvId }, '-timestamp', 100) : [],
    enabled: !!selectedConvId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
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

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const selectedLead = selectedConv ? leads.find(l => l.id === selectedConv.lead_id) : null;
  const filtered = conversations.filter(c => {
    const lead = leads.find(l => l.id === c.lead_id);
    const name = lead?.name || c.phone_number || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  if (selectedConvId && selectedConv) {
    return (
      <div className="flex flex-col bg-background" style={{ height: '100dvh' }}>
        {/* Chat Header */}
        <div className="flex items-center gap-2 p-3 border-b bg-card sticky top-0 z-10">
          <button onClick={() => setSelectedConvId(null)} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{selectedLead?.name || selectedConv.phone_number}</p>
            <p className="text-xs text-muted-foreground truncate">{selectedConv.phone_number}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.direction === 'inbound'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-accent text-accent-foreground'
                }`}
              >
                <p className="break-words">{msg.body}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Reply Box */}
        <div className="border-t bg-card p-3 space-y-2">
          <Textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type message..."
            className="min-h-16 text-sm resize-none"
          />
          <Button
            onClick={() => {
              if (reply.trim()) {
                sendMutation.mutate({ conversation_id: selectedConvId, message: reply.trim() });
              }
            }}
            disabled={!reply.trim() || sendMutation.isPending}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <Input
        placeholder="Search conversations..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="text-sm"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No conversations</p>
        </div>
      ) : (
        filtered.map(conv => {
          const lead = leads.find(l => l.id === conv.lead_id);
          return (
            <Card
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{lead?.name || conv.phone_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                </div>
                {conv.unread_count > 0 && (
                  <Badge className="ml-2">{conv.unread_count}</Badge>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}