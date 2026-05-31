import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, MessageCircle, Phone, Video, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function WhatsAppPopup({ isOpen, onClose, phone, leadId, leadName }) {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const openWhatsAppWeb = () => {
    const phoneNum = phone?.replace(/\D/g, '');
    if (!phoneNum) {
      toast.error('Invalid phone number');
      return;
    }
    const url = `https://wa.me/${phoneNum}`;
    window.open(url, '_blank');
  };

  // Find or create conversation
  const { data: conversations = [] } = useQuery({
    queryKey: ['wa_conversations_lookup', phone],
    queryFn: async () => {
      const all = await base44.entities.WhatsAppConversation.list('-last_message_at', 100);
      const match = all.find(c => c.wa_phone_e164 === phone || c.phone_number === phone);
      if (match) {
        setConversationId(match.id);
        return [match];
      }
      return [];
    },
    enabled: !!phone && isOpen,
  });

  // Fetch messages
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['wa_messages', conversationId],
    queryFn: () => base44.entities.WhatsAppMessage.filter(
      { conversation_id: conversationId },
      '-created_date',
      50
    ),
    enabled: !!conversationId,
    refetchInterval: 3000,
  });

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;
    const unsub = base44.entities.WhatsAppMessage.subscribe((event) => {
      if (event.data?.conversation_id === conversationId) {
        refetchMessages();
      }
    });
    return () => unsub();
  }, [conversationId, refetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (text) => {
      if (!conversationId) {
        // Create new conversation first
        const newConv = await base44.entities.WhatsAppConversation.create({
          phone_number: phone,
          wa_phone_e164: phone,
          lead_id: leadId,
          status: 'open',
          last_message_at: new Date().toISOString(),
        });
        setConversationId(newConv.id);
      }
      
      const convList = await base44.entities.WhatsAppConversation.filter({ lead_id: leadId });
      const convId = conversationId || (convList.length > 0 ? convList[0].id : null);
      
      await base44.functions.invoke('sendWhatsAppMessage', {
        conversation_id: convId,
        message: text,
      });
    },
    onSuccess: () => {
      setMessage('');
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
      toast.success('Message sent');
    },
    onError: (err) => {
      console.error('Send error:', err);
      toast.error('Failed to send: ' + (err.message || 'Unknown error'));
    },
  });

  const handleSend = () => {
    if (!message.trim() || !phone) return;
    sendMutation.mutate(message.trim());
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const formatTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Popup */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
      >
        <div
          className="w-full max-w-2xl h-[600px] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'hsl(38 92% 50%)' }}
              >
                {leadName?.charAt(0)?.toUpperCase() || phone?.slice(-2)}
              </div>
              <div>
                <h3 className="font-bold text-white">{leadName || 'WhatsApp Chat'}</h3>
                <p className="text-xs text-muted-foreground">{phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="icon" 
                variant="ghost" 
                className="w-8 h-8 text-green-500 hover:text-green-400"
                onClick={openWhatsAppWeb}
                title="Open in WhatsApp Web"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-white">
                <Phone className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-white">
                <Video className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="w-8 h-8 text-muted-foreground hover:text-white"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1 opacity-50">Start the conversation</p>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex ${msg.is_sent_by_agent ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      msg.is_sent_by_agent
                        ? 'rounded-br-sm'
                        : 'rounded-bl-sm'
                    }`}
                    style={{
                      background: msg.is_sent_by_agent
                        ? 'hsl(38 92% 50%)'
                        : 'rgba(255,255,255,0.1)',
                      color: msg.is_sent_by_agent ? 'hsl(222 47% 11%)' : 'white',
                    }}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.is_sent_by_agent ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {formatTime(msg.created_date)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div
            className="p-4 border-t flex items-end gap-2"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex-1 relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="pr-12 min-h-10 resize-none"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                disabled={sendMutation.isPending}
              />
              <Button
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg"
                style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}