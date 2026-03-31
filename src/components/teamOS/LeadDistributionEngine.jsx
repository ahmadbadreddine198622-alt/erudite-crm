import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, User, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

function scoreAgentForLead(agent, lead) {
  let score = 100;
  // Penalise overloaded agents
  const load = agent.assigned_conversations || 0;
  score -= load * 8;
  // Boost fast responders
  const rt = agent.avg_response_time_minutes || 60;
  if (rt < 5) score += 20;
  else if (rt < 15) score += 10;
  else if (rt > 60) score -= 15;
  // Boost high converters
  score += (agent.conversion_rate || 0) * 0.5;
  // SLA breaches penalty
  score -= (agent.sla_breaches || 0) * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function LeadDistributionEngine({ leads, agents }) {
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState({});

  const unassigned = leads.filter(l => !l.assigned_agent &&
    !['closed_won', 'closed_lost'].includes(l.stage)
  );

  const assignMutation = useMutation({
    mutationFn: ({ leadId, agentEmail, agentName }) =>
      base44.entities.Lead.update(leadId, { assigned_agent: agentEmail, assigned_agent_name: agentName }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Lead assigned to ${vars.agentName}`);
      setAssigning(a => { const n = { ...a }; delete n[vars.leadId]; return n; });
    },
  });

  const autoAssignAll = () => {
    if (agents.length === 0) { toast.error('No agents configured'); return; }
    unassigned.forEach(lead => {
      const ranked = agents.map(a => ({ agent: a, score: scoreAgentForLead(a, lead) }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0]?.agent;
      if (best) {
        assignMutation.mutate({ leadId: lead.id, agentEmail: best.agent_email, agentName: best.agent_name });
      }
    });
  };

  const urgencyColor = (stage) => {
    if (['new_lead'].includes(stage)) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (['contacted', 'viewing_scheduled'].includes(stage)) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">Lead Distribution Engine</h2>
          <p className="text-xs text-white/40 mt-0.5">{unassigned.length} unassigned leads · {agents.length} agents available</p>
        </div>
        {unassigned.length > 0 && agents.length > 0 && (
          <button
            onClick={autoAssignAll}
            disabled={assignMutation.isPending}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl transition-all disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            Auto-Assign All
          </button>
        )}
      </div>

      {/* Agent Load Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {agents.map(agent => {
          const load = agent.assigned_conversations || 0;
          const maxLoad = 8;
          const pct = Math.min(100, Math.round((load / maxLoad) * 100));
          const color = pct > 75 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <div key={agent.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <User className="w-3 h-3 text-indigo-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{agent.agent_name}</p>
                  <p className="text-[10px] text-white/30">{load}/{maxLoad} leads</p>
                </div>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[9px] text-white/30">
                <span>{(agent.conversion_rate || 0).toFixed(1)}% conv</span>
                <span>{agent.avg_response_time_minutes || 0}min response</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unassigned Leads */}
      <div>
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Unassigned Leads</p>
        {unassigned.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300 font-medium">All leads are assigned! Great team discipline.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {unassigned.map(lead => {
              const ranked = agents.map(a => ({ agent: a, score: scoreAgentForLead(a, lead) }))
                .sort((a, b) => b.score - a.score);
              const best = ranked[0];

              return (
                <div key={lead.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{lead.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyColor(lead.stage)}`}>
                          {lead.stage?.replace(/_/g, ' ')}
                        </span>
                        {lead.source && (
                          <span className="text-[10px] text-white/30">{lead.source}</span>
                        )}
                        {lead.budget_aed && (
                          <span className="text-[10px] text-white/40">AED {lead.budget_aed.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-red-400 font-semibold shrink-0 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Unassigned
                    </span>
                  </div>

                  {/* AI Recommendation */}
                  {best && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-indigo-300 font-semibold">AI Recommends: {best.agent.agent_name}</p>
                          <p className="text-[9px] text-white/30">Score {best.score}% · {best.agent.assigned_conversations || 0} active · {(best.agent.conversion_rate || 0).toFixed(0)}% conv</p>
                        </div>
                      </div>
                      <button
                        onClick={() => assignMutation.mutate({ leadId: lead.id, agentEmail: best.agent.agent_email, agentName: best.agent.agent_name })}
                        disabled={assignMutation.isPending}
                        className="text-[10px] font-semibold px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-all disabled:opacity-50 shrink-0"
                      >
                        {assignMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Assign'}
                      </button>
                    </div>
                  )}

                  {/* All agents ranked */}
                  <div className="flex gap-2 flex-wrap">
                    {ranked.slice(1, 4).map(({ agent, score }) => (
                      <button
                        key={agent.id}
                        onClick={() => assignMutation.mutate({ leadId: lead.id, agentEmail: agent.agent_email, agentName: agent.agent_name })}
                        disabled={assignMutation.isPending}
                        className="text-[10px] text-white/40 hover:text-white/70 px-2 py-1 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-all"
                      >
                        {agent.agent_name} ({score}%)
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}