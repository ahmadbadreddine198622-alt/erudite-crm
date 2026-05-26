import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import {
  Bot, Send, Sparkles, Users, BarChart3, Loader2,
  ChevronRight, Copy, Check, Zap, Brain, TrendingUp, AlertTriangle,
  PlusCircle, Database, Bell, FileText, UserCheck, Home, DollarSign,
  MessageSquare, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

const QUICK_ACTIONS = [
  { id: 'pipeline_insights', label: 'Pipeline Health Report', icon: TrendingUp, color: 'text-blue-600', desc: 'Full AI analysis of your pipeline' },
  { id: 'stale_leads', label: 'Find Stale Leads', icon: AlertTriangle, color: 'text-amber-600', desc: 'Identify leads that need attention' },
  { id: 'top_leads', label: 'Rank Top Leads', icon: Users, color: 'text-green-600', desc: 'Score and prioritize best opportunities' },
  { id: 'weekly_summary', label: 'Weekly Summary', icon: BarChart3, color: 'text-purple-600', desc: 'AI-generated weekly brief' },
];

const PROMPT_SUGGESTIONS = [
  "Which leads should I follow up with today?",
  "Create a reminder for each hot lead to call them this week",
  "Summarize all active offers and their status",
  "Write a WhatsApp message for a lead after a viewing",
  "Which commission payments are pending and what's the total?",
  "List all properties available for sale with their prices",
  "Which WhatsApp conversations need urgent attention?",
  "Show me all stale leads and create follow-up reminders",
  "What's my pipeline conversion rate from viewing to offer?",
  "Tag my top 5 leads as VIP and schedule callbacks",
  "Analyze my closed_lost leads and find patterns",
  "Which agent has the most leads assigned?",
];

function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const executedActions = msg.executed_actions || [];

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
      <div className="max-w-[80%] group">
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap'
            : 'bg-card border rounded-tl-sm'
        }`}>
          {isUser ? msg.content : (
            <ReactMarkdown
              className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground"
              components={{
                code: ({ inline, children }) => inline
                  ? <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                  : <pre className="bg-muted rounded-lg p-3 overflow-x-auto text-xs font-mono whitespace-pre-wrap">{children}</pre>
              }}
            >{msg.content}</ReactMarkdown>
          )}
        </div>

        {executedActions.length > 0 && (
          <div className="mt-2 space-y-1">
            {executedActions.map((action, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs border rounded-lg px-3 py-1.5 ${
                action.ok
                  ? 'bg-green-500/10 text-green-700 border-green-500/20'
                  : 'bg-red-500/10 text-red-700 border-red-500/20'
              }`}>
                <Zap className="w-3 h-3 shrink-0" />
                {action.ok ? '✓ ' : '✗ '}{action.label || action.error || action.type}
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

const WELCOME_MSG = {
  role: 'assistant',
  content: `Hi! I'm **Claude** — your AI with **full read/write access** to your CRM.

I can:
- 📊 Analyze all your leads, pipeline and performance
- 🔔 **Create reminders** and follow-up tasks
- ✏️ **Update lead stages**, tags and notes
- 💬 Write WhatsApp and email messages
- 📋 **Log activities** and call notes
- 🏆 Rank and score your best opportunities

Just tell me what to do — I'll act on it directly in the CRM!`
};

export default function ClaudeAI() {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const bottomRef = useRef(null);

  const { data: crmStats } = useQuery({
    queryKey: ['claude-crm-stats'],
    queryFn: async () => {
      const [allLeads, allProps, allRem, allComm, allOffers, allConvos] = await Promise.all([
        base44.entities.Lead.list('-updated_date', 200).catch(() => []),
        base44.entities.Property.list('-updated_date', 100).catch(() => []),
        base44.entities.Reminder.filter({ status: 'pending' }).catch(() => []),
        base44.entities.Commission.filter({ status: 'pending' }).catch(() => []),
        base44.entities.Offer.list('-created_date', 50).catch(() => []),
        base44.entities.WhatsAppConversation.filter({ status: 'open' }).catch(() => []),
      ]);
      return {
        leads: allLeads.length,
        properties: allProps.length,
        reminders: allRem.length,
        commissions: allComm.length,
        offers: allOffers.length,
        conversations: allConvos.length,
        hot_leads: allLeads.filter(l => l.qualification_status === 'hot').length,
        stale_leads: allLeads.filter(l => (l.inactivity_days || 0) > 7).length,
      };
    },
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const newConversation = () => {
    setMessages([WELCOME_MSG]);
    setInput('');
  };

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;

    setInput('');
    const updatedMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(updatedMessages);
    setLoading(true);

    const chatMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }));

    const res = await base44.functions.invoke('claudeAI', {
      mode: 'chat',
      messages: chatMessages,
    });

    setLoading(false);

    if (res.data?.executed_actions?.length > 0) {
      const done = res.data.executed_actions.filter(a => a.ok).length;
      if (done > 0) toast.success(`${done} CRM action${done > 1 ? 's' : ''} executed`);
    }

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: res.data?.reply || 'Sorry, I could not get a response.',
      crm_actions: res.data?.crm_actions || [],
      executed_actions: res.data?.executed_actions || [],
    }]);
  };

  const runQuickAction = async (action) => {
    setActiveAction(action.id);

    if (action.id === 'pipeline_insights') {
      await sendMessage('Give me a full pipeline health analysis with priorities and recommendations.');
    } else if (action.id === 'stale_leads') {
      await sendMessage('Identify my stale leads (inactive 7+ days) and suggest specific re-engagement actions for each.');
    } else if (action.id === 'top_leads') {
      await sendMessage('Rank my top 10 leads by closing potential. Explain why each is ranked that way.');
    } else if (action.id === 'weekly_summary') {
      await sendMessage('Generate a concise weekly performance summary for my CRM including pipeline health, key metrics, and recommended actions this week.');
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
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm">Claude AI</h2>
              <p className="text-xs text-muted-foreground">Full CRM Access</p>
            </div>
            <button
              onClick={newConversation}
              title="New Conversation"
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-muted-foreground" />
            </button>
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
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
              {activeAction === action.id
                ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0 mt-0.5" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              }
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

        <div className="p-4 border-t space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live CRM Data</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Users, label: 'Leads', value: crmStats?.leads, color: 'text-blue-600' },
              { icon: Home, label: 'Properties', value: crmStats?.properties, color: 'text-green-600' },
              { icon: Bell, label: 'Reminders', value: crmStats?.reminders, color: 'text-amber-600' },
              { icon: DollarSign, label: 'Pending $', value: crmStats?.commissions, color: 'text-purple-600' },
              { icon: FileText, label: 'Offers', value: crmStats?.offers, color: 'text-rose-600' },
              { icon: MessageSquare, label: 'WA Open', value: crmStats?.conversations, color: 'text-teal-600' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-none">{value ?? '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>
          {crmStats && (
            <div className="flex gap-2">
              <div className="flex-1 bg-red-500/10 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-red-600">{crmStats.stale_leads}</p>
                <p className="text-xs text-muted-foreground">Stale</p>
              </div>
              <div className="flex-1 bg-green-500/10 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-green-600">{crmStats.hot_leads}</p>
                <p className="text-xs text-muted-foreground">Hot Leads</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Claude Has Access To</p>
            <div className="flex flex-wrap gap-1">
              <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-[10px]">Leads</Badge>
              <Badge className="bg-green-500/10 text-green-700 border-green-500/20 text-[10px]">Properties</Badge>
              <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">Reminders</Badge>
              <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-[10px]">Commissions</Badge>
              <Badge className="bg-rose-500/10 text-rose-700 border-rose-500/20 text-[10px]">Offers</Badge>
              <Badge className="bg-teal-500/10 text-teal-700 border-teal-500/20 text-[10px]">WhatsApp</Badge>
              <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20 text-[10px]">Activities</Badge>
              <Badge className="bg-cyan-500/10 text-cyan-700 border-cyan-500/20 text-[10px]">Invoices</Badge>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-2.5 space-y-1.5">
            <p className="text-xs font-semibold text-purple-700">Claude Can Execute</p>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-green-600" /> Create reminders
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-green-600" /> Update lead stages
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-green-600" /> Add tags and notes
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-green-600" /> Log activities
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-green-600" /> Assign leads
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">

        <div className="flex items-center gap-3 px-6 py-4 border-b bg-card">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-sm">Chat with Claude</span>
          <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-xs">claude-opus-4-5</Badge>
          <span className="ml-auto text-xs text-muted-foreground">Full CRM context on every message</span>
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
              placeholder="Ask Claude anything — or tell it to take action in your CRM..."
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
          <p className="text-xs text-muted-foreground mt-2">Enter to send · Shift+Enter for new line · Claude has access to all your CRM data</p>
        </div>
      </div>
    </div>
  );
}