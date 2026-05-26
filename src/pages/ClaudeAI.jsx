import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bot, Send, Sparkles, Users, BarChart3, MessageSquare, Loader2,
  ChevronRight, Copy, Check, Zap, Brain, TrendingUp, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const QUICK_ACTIONS = [
  { id: 'pipeline_insights', label: 'Pipeline Health Report', icon: TrendingUp, color: 'text-blue-600', desc: 'Get a full AI analysis of your pipeline' },
  { id: 'stale_leads', label: 'Find Stale Leads', icon: AlertTriangle, color: 'text-amber-600', desc: 'Identify leads that need attention' },
  { id: 'top_leads', label: 'Rank Top Leads', icon: Users, color: 'text-green-600', desc: 'Score & prioritize your best opportunities' },
  { id: 'weekly_summary', label: 'Weekly Summary', icon: BarChart3, color: 'text-purple-600', desc: 'AI-generated weekly performance brief' },
];

const PROMPT_SUGGESTIONS = [
  "Which leads should I follow up with today?",
  "Write a WhatsApp message for a lead who showed a property last week",
  "Analyze my closed_lost leads and find patterns",
  "What's my best lead source and why?",
  "Draft a follow-up sequence for new_lead stage",
  "Which leads are most likely to close this month?",
];

function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[80%] group`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-card border rounded-tl-sm'
        }`}>
          {msg.content}
        </div>
        {msg.crm_actions?.length > 0 && (
          <div className="mt-2 space-y-1">
            {msg.crm_actions.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-green-500/10 text-green-700 border border-green-500/20 rounded-lg px-3 py-1.5">
                <Zap className="w-3 h-3" />
                CRM Action: {action.type} applied
              </div>
            ))}
          </div>
        )}
        {!isUser && (
          <button onClick={copy} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ClaudeAI() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Claude, your AI assistant for Erudite Property CRM. I can analyze your leads, generate messages, give pipeline insights, and help automate tasks. What would you like to do?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [insightsResult, setInsightsResult] = useState(null);
  const bottomRef = useRef(null);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-claude'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 20),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    // Build context summary for chat
    const stageMap = leads.reduce((acc, l) => { acc[l.stage] = (acc[l.stage] || 0) + 1; return acc; }, {});
    const contextData = {
      total_leads: leads.length,
      stage_distribution: stageMap,
      recent_leads: leads.slice(0, 5).map(l => ({ name: l.name, stage: l.stage, source: l.source, score: l.lead_score })),
    };

    const chatMessages = [...messages, { role: 'user', content: userMsg }].map(m => ({ role: m.role, content: m.content }));

    const res = await base44.functions.invoke('claudeAI', {
      mode: 'chat',
      messages: chatMessages,
      context_data: contextData,
    });

    setLoading(false);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: res.data?.reply || 'Sorry, I could not get a response.',
      crm_actions: res.data?.crm_actions || [],
    }]);
  };

  const runQuickAction = async (action) => {
    setActiveAction(action.id);
    setInsightsResult(null);

    if (action.id === 'pipeline_insights') {
      setMessages(prev => [...prev, { role: 'user', content: 'Give me a full pipeline health analysis.' }]);
      setLoading(true);
      const res = await base44.functions.invoke('claudeAI', { mode: 'pipeline_insights' });
      setLoading(false);
      const ins = res.data?.insights;
      if (ins) {
        setInsightsResult(ins);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: ins.summary + '\n\n**Priorities:**\n' + (ins.priorities || []).map((p, i) => `${i+1}. ${p}`).join('\n') +
            '\n\n**Recommendations:**\n' + (ins.recommendations || []).map((r, i) => `${i+1}. ${r}`).join('\n'),
        }]);
      }
    } else if (action.id === 'stale_leads') {
      setMessages(prev => [...prev, { role: 'user', content: 'Identify my stale leads and suggest what to do with each.' }]);
      setLoading(true);
      const staleLeads = leads.filter(l => (l.inactivity_days || 0) > 5).slice(0, 8).map(l => ({ name: l.name, stage: l.stage, days: l.inactivity_days, source: l.source }));
      const res = await base44.functions.invoke('claudeAI', {
        mode: 'chat',
        messages: [{ role: 'user', content: `Analyze these stale leads and give specific re-engagement strategies for each:\n${JSON.stringify(staleLeads, null, 2)}` }],
      });
      setLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data?.reply || 'No response.' }]);
    } else if (action.id === 'top_leads') {
      setMessages(prev => [...prev, { role: 'user', content: 'Rank my top 10 leads by closing potential and explain why.' }]);
      setLoading(true);
      const topLeads = leads.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0)).slice(0, 10);
      const res = await base44.functions.invoke('claudeAI', {
        mode: 'chat',
        messages: [{ role: 'user', content: `Rank and explain the closing potential for these leads:\n${JSON.stringify(topLeads.map(l => ({ name: l.name, stage: l.stage, score: l.lead_score, budget: l.budget_aed, source: l.source, days_inactive: l.inactivity_days })), null, 2)}` }],
      });
      setLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data?.reply || 'No response.' }]);
    } else if (action.id === 'weekly_summary') {
      setMessages(prev => [...prev, { role: 'user', content: 'Generate a concise weekly performance summary for my CRM.' }]);
      setLoading(true);
      const res = await base44.functions.invoke('claudeAI', { mode: 'pipeline_insights' });
      setLoading(false);
      const ins = res.data?.insights;
      const msg = ins ? `**Weekly Summary**\n\n${ins.summary}\n\nPipeline Health: ${ins.health_score}/100\n\n**Key Actions This Week:**\n${(ins.recommendations || []).map((r, i) => `${i+1}. ${r}`).join('\n')}` : 'Could not generate summary.';
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    }

    setActiveAction(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Claude AI</h2>
              <p className="text-xs text-muted-foreground">CRM Intelligence</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-2 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</p>
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.id}
              onClick={() => runQuickAction(action)}
              disabled={activeAction === action.id || loading}
              className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left disabled:opacity-50 border border-transparent hover:border-border"
            >
              <action.icon className={`w-4 h-4 mt-0.5 shrink-0 ${action.color}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
              {activeAction === action.id ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0 mt-0.5" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Prompt Ideas</p>
          <div className="space-y-1.5">
            {PROMPT_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                disabled={loading}
                className="w-full text-left text-xs text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
              >
                "{s}"
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t">
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs font-medium">{leads.length} leads in CRM</p>
            <p className="text-xs text-muted-foreground mt-0.5">Claude has context of your pipeline</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">

        <div className="flex items-center gap-3 px-6 py-4 border-b bg-card">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-sm">Chat with Claude</span>
          <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-xs">claude-opus-4-5</Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-card">
          <div className="flex gap-3 items-end">
            <Textarea
              placeholder="Ask Claude anything about your CRM, leads, deals..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              className="resize-none min-h-[48px] max-h-32 text-sm"
              rows={1}
              disabled={loading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="h-12 w-12 shrink-0 bg-gradient-to-br from-purple-600 to-blue-600 hover:opacity-90"
              size="icon"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}