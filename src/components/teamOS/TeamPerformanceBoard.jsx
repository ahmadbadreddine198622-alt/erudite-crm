import React from 'react';
import { TrendingUp, TrendingDown, Minus, Award, AlertCircle } from 'lucide-react';

export default function TeamPerformanceBoard({ leads, agents, activities }) {
  // Per agent — leads assigned, closed, conversion
  const agentLeads = {};
  leads.forEach(l => {
    if (!l.assigned_agent) return;
    if (!agentLeads[l.assigned_agent]) agentLeads[l.assigned_agent] = { total: 0, closed: 0, lost: 0 };
    agentLeads[l.assigned_agent].total++;
    if (l.stage === 'closed_won') agentLeads[l.assigned_agent].closed++;
    if (l.stage === 'closed_lost') agentLeads[l.assigned_agent].lost++;
  });

  const agentActivities = {};
  activities.forEach(a => {
    if (!a.agent_email) return;
    agentActivities[a.agent_email] = (agentActivities[a.agent_email] || 0) + 1;
  });

  const ranked = agents.map(a => {
    const stats = agentLeads[a.agent_email] || { total: 0, closed: 0, lost: 0 };
    const conv = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;
    const score = conv * 0.5 + (agentActivities[a.agent_email] || 0) * 0.3 - (a.sla_breaches || 0) * 5 - (a.avg_response_time_minutes || 60) * 0.1;
    return { ...a, stats, conv, actCount: agentActivities[a.agent_email] || 0, score };
  }).sort((a, b) => b.score - a.score);

  // Source breakdown
  const sourceBreakdown = {};
  leads.forEach(l => { if (l.source) sourceBreakdown[l.source] = (sourceBreakdown[l.source] || 0) + 1; });
  const topSources = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const totalClosed = leads.filter(l => l.stage === 'closed_won').length;
  const totalLost = leads.filter(l => l.stage === 'closed_lost').length;
  const overallConv = leads.length > 0 ? ((totalClosed / leads.length) * 100).toFixed(1) : 0;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <h2 className="text-sm font-bold text-white">Team Performance Board</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Overall Conversion', value: `${overallConv}%`, color: 'text-indigo-300' },
          { label: 'Deals Closed', value: totalClosed, color: 'text-emerald-300' },
          { label: 'Deals Lost', value: totalLost, color: 'text-red-300' },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-white/30 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Agent Leaderboard */}
      <div>
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Agent Leaderboard</p>
        <div className="space-y-3">
          {ranked.map((agent, i) => {
            const isTop = i === 0;
            const needsAttention = agent.conv < 10 || (agent.sla_breaches || 0) > 2;
            return (
              <div key={agent.id} className={`p-4 rounded-xl border ${isTop ? 'bg-amber-500/10 border-amber-500/20' : needsAttention ? 'bg-red-500/5 border-red-500/15' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${isTop ? 'text-amber-400' : 'text-white/30'}`}>#{i + 1}</span>
                    {isTop && <Award className="w-4 h-4 text-amber-400" />}
                    <div>
                      <p className="text-sm font-bold text-white">{agent.agent_name}</p>
                      <p className="text-[10px] text-white/30">{agent.agent_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${agent.conv >= 30 ? 'text-emerald-400' : agent.conv >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                      {agent.conv}%
                    </p>
                    <p className="text-[10px] text-white/30">conversion</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Assigned', value: agent.stats.total },
                    { label: 'Closed', value: agent.stats.closed },
                    { label: 'Activities', value: agent.actCount },
                    { label: 'Response', value: `${agent.avg_response_time_minutes || 0}m` },
                  ].map(s => (
                    <div key={s.label} className="bg-white/5 rounded-lg p-2">
                      <p className="text-sm font-bold text-white">{s.value}</p>
                      <p className="text-[9px] text-white/30">{s.label}</p>
                    </div>
                  ))}
                </div>

                {needsAttention && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    {agent.conv < 10 ? 'Low conversion — review approach' : `${agent.sla_breaches} SLA breaches — needs attention`}
                  </div>
                )}
              </div>
            );
          })}

          {ranked.length === 0 && (
            <p className="text-sm text-white/30 text-center py-8">No agent data yet. Configure agents in Team settings.</p>
          )}
        </div>
      </div>

      {/* Lead Sources */}
      {topSources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Lead Sources</p>
          <div className="space-y-2">
            {topSources.map(([source, count]) => {
              const pct = Math.round((count / leads.length) * 100);
              return (
                <div key={source} className="flex items-center gap-3">
                  <span className="text-[10px] text-white/40 w-28 shrink-0 capitalize">{source.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500/50 rounded-full flex items-center justify-end pr-2" style={{ width: `${pct}%` }}>
                      <span className="text-[9px] text-indigo-200 font-bold">{count}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/30 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}