import React, { useState, useMemo } from 'react';
import { Bot, MessageCircle, Send, Mic, Phone, Video, Sparkles } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export default function AINegotiator() {
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-negotiator'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 50),
  });

  const activeDeals = useMemo(() => {
    return deals.filter(d => ['negotiation', 'offer_made'].includes(d.stage));
  }, [deals]);

  const negotiateMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await base44.functions.invoke('claudeAI', payload);
      return response.data;
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.message }]);
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() || !selectedDeal) return;

    const userMsg = { role: 'user', content: message };
    setMessages(prev => [...prev, userMsg]);

    // Send to AI negotiator
    negotiateMutation.mutate({
      prompt: `You are an expert Dubai luxury real estate negotiator. Help me negotiate this deal:
      
      Deal Context:
      - Property: ${selectedDeal.property_interest || 'Not specified'}
      - Value: AED ${(selectedDeal.value_aed || 0).toLocaleString()}
      - Stage: ${selectedDeal.stage}
      - Client: ${selectedDeal.lead_name || 'Unnamed'}
      
      My message: ${message}
      
      Provide:
      1. Analysis of the situation
      2. Suggested counter-strategy
      3. Exact wording for my response
      4. Red flags to watch for`,
      add_context_from_internet: false,
    });

    setMessage('');
  };

  const suggestedPhrases = [
    "Based on current market conditions in Dubai...",
    "I understand your concerns, however...",
    "Given the unique features of this property...",
    "My client is serious and ready to move forward if...",
    "The comparable sales in this area show...",
    "I can offer this terms if we can agree on...",
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Deals List */}
      <div
        className="rounded-2xl p-4 overflow-y-auto"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
          <h3 className="font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Active Negotiations</h3>
        </div>

        <div className="space-y-2">
          {activeDeals.map((deal) => (
            <div
              key={deal.id}
              onClick={() => {
                setSelectedDeal(deal);
                setMessages([]);
              }}
              className={`p-3 rounded-xl cursor-pointer transition-all ${
                selectedDeal?.id === deal.id 
                  ? 'bg-amber-500/20 border border-amber-500/50' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                {deal.lead_name || 'Unnamed Deal'}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                AED {(deal.value_aed / 1000000).toFixed(1)}M • {deal.stage}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="lg:col-span-2 flex flex-col">
        <div
          className="rounded-2xl flex-1 flex flex-col overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245,159,10,0.15)', border: '1px solid rgba(245,159,10,0.3)' }}
              >
                <Sparkles className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
              </div>
              <div>
                <h3 className="font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>AI Negotiation Coach</h3>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {selectedDeal ? `Coaching on: ${selectedDeal.lead_name}` : 'Select a deal to start'}
                </p>
              </div>
            </div>
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
              Powered by Claude
            </Badge>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {!selectedDeal ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Bot className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Select an active negotiation from the list to start<br />
                    getting AI-powered negotiation coaching
                  </p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <MessageCircle className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <p className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Start Your Negotiation Session
                  </p>
                  <p className="text-xs max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Describe the situation, share what the client said, or ask for specific negotiation advice.
                    The AI will provide real-time coaching and suggested responses.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] p-3 rounded-xl ${
                        msg.role === 'user'
                          ? 'bg-amber-600 text-white'
                          : 'bg-white/10'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Suggested Phrases */}
          {selectedDeal && messages.length > 0 && (
            <div className="px-4 pb-2">
              <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Quick Insert:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPhrases.map((phrase, i) => (
                  <Badge
                    key={i}
                    onClick={() => setMessage(phrase)}
                    className="cursor-pointer bg-white/5 hover:bg-white/10 text-xs"
                  >
                    {phrase.substring(0, 30)}...
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Describe the negotiation situation or ask for advice..."
                className="flex-1 bg-white/5 border-white/10 text-white"
                disabled={!selectedDeal}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!selectedDeal || !message.trim()}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Mic className="w-3 h-3 mr-1" />
                Voice
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Phone className="w-3 h-3 mr-1" />
                Call Analysis
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Video className="w-3 h-3 mr-1" />
                Meeting Notes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}