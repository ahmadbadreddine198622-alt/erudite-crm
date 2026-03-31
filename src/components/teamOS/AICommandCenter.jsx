import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, Brain, Sparkles, User } from 'lucide-react';

const QUICK_COMMANDS = [
  'Who should handle the next unassigned lead?',
  'Which agents are underperforming this week?',
  'Which leads are at risk of going cold?',
  'Summarize today\'s pipeline health',
  'Which agent has the best conversion rate?',
  'What are the top deals to close this week?',
];

export default function AICommandCenter({ leads, agents, activities }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `**Welcome to the AI Team OS** 🧠\n\nI am the brain of your real estate team. I have full visibility of:\n- **${leads.length} leads** across your pipeline\n- **${agents.length} agents** and their workload\n- **${activities.length} activities** tracked\n\nAsk me anything — lead distribution, agent performance, deal analysis, or communication strategies. I'll give you data-backed decisions.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const buildContext = () => {
    const stageBreakdown = {};
    leads.forEach(l => { stageBreakdown[l.stage] = (stageBreakdown[l.stage] || 0) + 1; });

    const now = Date.now();
    const coldLeads = leads.filter(l => {
      if (!l.last_contact_date) return true;
      return (now - new Date(l.last_contact_date).getTime()) > 14 * 24 * 60 * 60 * 1000;
    });

    const unassigned = leads.filter(l => !l.assigned_agent);

    return `
TEAM DATA CONTEXT (as of today):

LEADS OVERVIEW:
- Total leads: ${leads.length}
- Unassigned: ${unassigned.length}
- Cold (>14 days no contact): ${coldLeads.length}
- Stage breakdown: ${JSON.stringify(stageBreakdown)}

AGENT ROSTER (${agents.length} agents):
${agents.map(a => `- ${a.agent_name} (${a.agent_email}): ${a.assigned_conversations || 0} active convos, ${a.closed_deals || 0} closed deals, ${(a.conversion_rate || 0).toFixed(1)}% conversion, ${a.avg_response_time_minutes || 0}min avg response, ${a.sla_breaches || 0} SLA breaches`).join('\n')}

RECENT ACTIVITY: ${activities.length} total activities logged

LEAD SAMPLES (top 20 by recency):
${leads.slice(0, 20).map(l => `- ${l.name}: ${l.stage}, budget AED ${l.budget_aed || '?'}, assigned to ${l.assigned_agent || 'UNASSIGNED'}, last contact: ${l.last_contact_date ? new Date(l.last_contact_date).toDateString() : 'never'}`).join('\n')}
`.trim();
  };

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    const history = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');

    const prompt = `You are the AI Operating System (brain) of a Dubai real estate CRM team. You act as Sales Manager, Team Leader, and CRM intelligence engine combined.

${buildContext()}

CONVERSATION HISTORY:
${history}

User: ${userMsg}

Respond as a sharp, data-driven real estate team manager. Be concise but actionable. Use bullet points. Always reference the actual data provided. If recommending assignment, name the specific agent and justify why. If flagging risk, name the specific lead.`;

    try {
      const response = await base44.integrations.Core.InvokeLLM({ prompt });
      setMessages(m => [...m, { role: 'assistant', content: response }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ Error: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-white/10 text-white/90 border border-white/10'
            }`}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-white/60" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span className="text-white/50 text-xs">Analysing team data…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Commands */}
      <div className="px-6 pb-3 flex gap-2 flex-wrap">
        {QUICK_COMMANDS.map((cmd, i) => (
          <button
            key={i}
            onClick={() => sendMessage(cmd)}
            disabled={loading}
            className="text-[10px] px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 hover:border-indigo-500/40 transition-all font-medium"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-6 pb-6 flex-shrink-0">
        <div className="flex gap-3 items-end bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask anything about your team, leads, or deals…"
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none resize-none leading-relaxed"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}