import React from 'react';
import { AlertTriangle, Clock, CheckCircle2, User, TrendingDown, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ManagerVisibility({ leads, agents, activities, reminders }) {
  const now = Date.now();

  // Leads with no activity > 24h
  const stuckLeads = leads.filter(l => {
    if (['closed_won', 'closed_lost'].includes(l.stage)) return false;
    if (!l.last_contact_date) return true;
    const hours = (now - new Date(l.last_contact_date).getTime()) / (1000 * 60 * 60);
    return hours > 24;
  });

  // Overdue reminders
  const overdueReminders = reminders.filter(r =>
    r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date()
  );

  // Agents with no recent activity
  const activeAgentEmails = new Set(
    activities
      .filter(a => (now - new Date(a.created_date).getTime()) < 24 * 60 * 60 * 1000)
      .map(a => a.agent_email)
  );

  const inactiveAgents = agents.filter(a => !activeAgentEmails.has(a.agent_email));

  // Leads by stage
  const stageBreakdown = {};
  leads.forEach(l => { stageBreakdown[l.stage] = (stageBreakdown[l.stage] || 0) + 1; });

  const STAGE_ORDER = ['new_lead', 'contacted', 'viewing_scheduled', 'viewing_done', 'negotiation', 'offer_made', 'closed_won', 'closed_lost'];
  const STAGE_COLORS = {
    new_lead: 'bg-slate-500/20 text-slate-300',
    contacted: 'bg-blue-500/20 text-blue-300',
    viewing_scheduled: 'bg-indigo-500/20 text-indigo-300',
    viewing_done: 'bg-purple-500/20 text-purple-300',
    negotiation: 'bg-amber-500/20 text-amber-300',
    offer_made: 'bg-orange-500/20 text-orange-300',
    closed_won: 'bg-emerald-500/20 text-emerald-300',
    closed_lost: 'bg-red-500/20 text-red-300',
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <h2 className="text-sm font-bold text-white">Manager Visibility Dashboard</h2>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AlertCard
          icon={AlertTriangle}
          color="text-red-400"
          bg="bg-red-500/10 border-red-500/20"
          label="Leads Gone Silent (>24h)"
          value={stuckLeads.length}
          sub="Need immediate follow-up"
        />
        <AlertCard
          icon={Clock}
          color="text-amber-400"
          bg="bg-amber-500/10 border-amber-500/20"
          label="Overdue Tasks"
          value={overdueReminders.length}
          sub="Past due date"
        />
        <AlertCard
          icon={User}
          color="text-orange-400"
          bg="bg-orange-500/10 border-orange-500/20"
          label="Inactive Agents Today"
          value={inactiveAgents.length}
          sub="No activity logged"
        />
      </div>

      {/* Pipeline Funnel */}
      <div>
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Pipeline Funnel</p>
        <div className="space-y-2">
          {STAGE_ORDER.map(stage => {
            const count = stageBreakdown[stage] || 0;
            const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-[10px] text-white/40 w-32 shrink-0">{stage.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full flex items-center justify-end pr-2 text-[9px] font-bold transition-all ${STAGE_COLORS[stage]}`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  >
                    {count > 0 && count}
                  </div>
                </div>
                <span className="text-[10px] text-white/30 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stuck Leads */}
      {stuckLeads.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            Silent Leads — Action Required
          </p>
          <div className="space-y-2">
            {stuckLeads.slice(0, 8).map(lead => {
              const silentFor = lead.last_contact_date
                ? formatDistanceToNow(new Date(lead.last_contact_date), { addSuffix: true })
                : 'never contacted';
              return (
                <div key={lead.id} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-white">{lead.name}</p>
                    <p className="text-[10px] text-white/30">
                      {lead.stage?.replace(/_/g, ' ')} · {lead.assigned_agent || 'unassigned'} · silent {silentFor}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-red-400 px-2 py-1 bg-red-500/10 rounded-lg">
                    ⚠ At Risk
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inactive Agents */}
      {inactiveAgents.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
            Agents with No Activity Today
          </p>
          <div className="space-y-2">
            {inactiveAgents.map(agent => (
              <div key={agent.id} className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-white">{agent.agent_name}</p>
                  <p className="text-[10px] text-white/30">{agent.assigned_conversations || 0} active leads · {agent.closed_deals || 0} closed</p>
                </div>
                <span className="text-[10px] font-semibold text-amber-400">No activity logged</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCard({ icon: Icon, color, bg, label, value, sub }) {
  return (
    <div className={`p-4 rounded-xl border ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>
    </div>
  );
}