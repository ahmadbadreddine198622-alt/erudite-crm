import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Sparkles, User, Phone, Mail, Tag, Building2, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const QUICK_PROMPTS = [
  'Summarize this contact',
  'Draft a follow-up email',
  'Suggest next action',
  'What are their pain points?',
];

export default function ContactChatPanel({ contactId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => base44.entities.Lead.read(contactId),
    enabled: !!contactId,
  });

  useEffect(() => {
    if (contactId) {
      setMessages([]);
    }
  }, [contactId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;
    setInput('');

    const userMsg = { role: 'user', content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const contactContext = contact
      ? `Contact: ${contact.name}, Phone: ${contact.phone}, Email: ${contact.email || 'N/A'}, Source: ${contact.source || 'N/A'}, Stage: ${contact.stage || 'N/A'}, Type: ${contact.type || 'N/A'}, Budget: ${contact.budget_aed ? `AED ${contact.budget_aed.toLocaleString()}` : 'N/A'}, Notes: ${contact.notes || 'None'}, Tags: ${contact.tags?.join(', ') || 'None'}`
      : 'No contact selected';

    const history = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an elite Dubai luxury real estate AI assistant. You help brokers manage relationships and close deals.

CONTACT CONTEXT:
${contactContext}

CONVERSATION HISTORY:
${history}

USER: ${userText}

Respond helpfully and concisely. If generating templates (email/WhatsApp), format them clearly. Use bullet points where appropriate. Keep tone professional and confident.`,
    });

    setIsLoading(false);
    setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!contactId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Bot className="w-8 h-8 text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold text-[#111827] text-base mb-1">AI Contact Assistant</h3>
          <p className="text-sm text-[#6B7280]">Select a contact to start a conversation with your AI assistant</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {QUICK_PROMPTS.map((p) => (
            <span key={p} className="px-3 py-1.5 rounded-full bg-[#F3F4F6] text-xs text-[#6B7280] border border-[#E5E7EB]">{p}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Contact Header */}
      {contact && (
        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-600 font-semibold text-sm">
                {contact.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[#111827] text-sm truncate">{contact.name}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                {contact.phone && (
                  <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                    <Phone className="w-3 h-3" /> {contact.phone}
                  </span>
                )}
                {contact.stage && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium capitalize">
                    {contact.stage.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-[#F9FAFB] rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs shadow-sm">
                <p className="text-sm text-[#111827] leading-relaxed">
                  Hi! I'm your AI assistant for <span className="font-semibold">{contact?.name}</span>. Ask me anything about this contact or request help with communication.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-10">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="px-3 py-1.5 rounded-full text-xs bg-white border border-[#E5E7EB] text-[#374151] hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'assistant' ? (
                <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-[#E5E7EB] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-[#6B7280]" />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 max-w-[75%] shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-500 text-white rounded-tr-sm'
                    : 'bg-[#F9FAFB] text-[#111827] rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-[#F9FAFB] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-[#E5E7EB] bg-white">
        <div className="flex items-end gap-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this contact…"
            className="flex-1 bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] resize-none outline-none min-h-[20px] max-h-24"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-[#9CA3AF] mt-1.5 ml-1">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}