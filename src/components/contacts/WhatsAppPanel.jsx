import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Loader2, Phone, ExternalLink, Upload, Mic } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppPanel({ lead }) {
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState('text');
  const queryClient = useQueryClient();

  // Get all phone numbers for this lead
  const phones = [
    ...(lead?.phone ? [{ number: lead.phone, label: 'primary' }] : []),
    ...(lead?.phones || [])
  ];

  const uniquePhones = Array.from(
    new Map(phones.map(p => [p.number, p])).values()
  );

  // Fetch WhatsApp messages for selected phone
  const { data: messages = [] } = useQuery({
    queryKey: ['wa_messages_for_phone', selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      const allMessages = await base44.entities.WhatsAppMessage.list('-timestamp', 100);
      return allMessages.filter(m => 
        m.to_number === selectedPhone || m.from_number === selectedPhone
      );
    },
    enabled: !!selectedPhone
  });

  // Fetch conversation for selected phone
  const { data: conversation } = useQuery({
    queryKey: ['wa_conversation_for_phone', selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return null;
      const conversations = await base44.entities.WhatsAppConversation.list();
      return conversations.find(c => c.phone_number === selectedPhone) || null;
    },
    enabled: !!selectedPhone
  });

  const sendMutation = useMutation({
    mutationFn: ({ phone, text, media, type }) =>
      base44.functions.invoke('sendWhatsAppMessageFromCRM', {
        phone_number: phone,
        message_text: text,
        media_url: media,
        media_type: type
      }),
    onSuccess: () => {
      setMessage('');
      setMediaUrl(null);
      setMediaType('text');
      queryClient.invalidateQueries({ queryKey: ['wa_messages_for_phone'] });
      queryClient.invalidateQueries({ queryKey: ['wa_conversation_for_phone'] });
      toast.success('Message sent');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send message');
    }
  });

  const handleSend = () => {
    if (!selectedPhone || (!message.trim() && !mediaUrl)) return;
    sendMutation.mutate({
      phone: selectedPhone,
      text: message.trim(),
      media: mediaUrl,
      type: mediaType
    });
  };

  if (uniquePhones.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No phone numbers available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Phone selector */}
      <div className="p-3 border-b space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase">Phone Numbers</p>
        <div className="space-y-1.5">
          {uniquePhones.map((phone) => (
            <button
              key={phone.number}
              onClick={() => setSelectedPhone(phone.number)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors text-sm ${
                selectedPhone === phone.number
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs">{phone.number}</p>
                  <p className="text-xs text-muted-foreground capitalize">{phone.label}</p>
                </div>
                {conversation && (
                  <Badge variant="outline" className="text-[10px]">
                    {conversation.unread_count > 0 ? `${conversation.unread_count} new` : 'synced'}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
        {selectedPhone && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs gap-1"
            onClick={() => window.open(`/whatsapp?phone=${selectedPhone}`, '_blank')}
          >
            <ExternalLink className="w-3 h-3" /> Open in Chat
          </Button>
        )}
      </div>

      {/* Messages display */}
      {selectedPhone && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-8">
                No messages yet
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-green-600 text-white'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.media_url && (
                      <div className="mb-1">
                        {msg.media_type.includes('image') ? (
                          <img src={msg.media_url} alt="Media" className="max-w-[200px] rounded" />
                        ) : (
                          <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                            {msg.media_type}
                          </a>
                        )}
                      </div>
                    )}
                    <p className="text-xs">{msg.body}</p>
                    <p className="text-[10px] opacity-70 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Message input */}
          <div className="p-3 border-t space-y-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[60px] max-h-24 text-xs resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
              >
                <Upload className="w-3 h-3" /> File
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
              >
                <Mic className="w-3 h-3" /> Voice
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={(!message.trim() && !mediaUrl) || sendMutation.isPending}
                className="ml-auto gap-1 h-8 text-xs bg-green-600 hover:bg-green-700"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Send
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}