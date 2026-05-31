import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Brain, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import ClaudePresenceIcon from '@/components/ui/ClaudePresenceIcon';

export default function ClaudeChatSheet({ isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message) => {
      const response = await base44.functions.invoke('claudeAI', {
        prompt: message,
        conversation_context: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
      });
      return response.data;
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      const response = data.response || data.message || 'Thank you for your message!';
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setIsTyping(false);
    },
    onError: (error) => {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${error.message}` }]);
      setIsTyping(false);
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    sendMessageMutation.mutate(userMessage);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 md:left-[280px] md:right-0 z-[9999] md:rounded-t-3xl"
            style={{ maxHeight: '85vh', height: '85vh' }}
          >
            <div className="h-full flex flex-col" style={{
              background: 'rgba(8,12,28,0.98)',
              backdropFilter: 'blur(56px) saturate(240%)',
              WebkitBackdropFilter: 'blur(56px) saturate(240%)',
              borderTop: '1px solid rgba(255,255,255,0.13)',
              boxShadow: '0 -24px 64px rgba(0,0,0,0.70)',
            }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{
                background: 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 100%)',
              }}>
                <div className="flex items-center gap-3">
                  <ClaudePresenceIcon size={36} active={true} thinking={sendMessageMutation.isPending} />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Claude AI Assistant</h3>
                    <p className="text-xs text-muted-foreground">
                      {sendMessageMutation.isPending ? 'Thinking...' : 'Ready to help'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <ClaudePresenceIcon size={80} active={false} />
                    <h4 className="text-lg font-semibold text-foreground mt-4">Ask Claude Anything</h4>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                      Get insights about your CRM data, leads, properties, or any real estate questions
                    </p>
                    <div className="flex flex-wrap gap-2 mt-6 justify-center">
                      {[
                        'Analyze my pipeline',
                        'Find hot leads',
                        'Market trends',
                        'Coaching tips',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setInput(suggestion)}
                          className="px-3 py-1.5 text-xs rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <ReactMarkdown
                          className="text-sm prose prose-invert prose-sm max-w-none"
                          components={{
                            p: ({ children }) => <p className="my-1">{children}</p>,
                            ul: ({ children }) => <ul className="my-2 ml-4 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="my-2 ml-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="my-0.5">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        <span className="text-sm text-muted-foreground">Claude is thinking...</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-white/10 p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask Claude anything..."
                    rows={1}
                    className="flex-1 resize-none px-4 py-3 text-sm rounded-xl bg-white/5 border border-white/10 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 text-foreground placeholder:text-muted-foreground"
                    style={{ maxHeight: '120px', minHeight: '44px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sendMessageMutation.isPending}
                    className="p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{
                      background: 'hsl(38 92% 50%)',
                      color: 'hsl(222 47% 11%)',
                    }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}