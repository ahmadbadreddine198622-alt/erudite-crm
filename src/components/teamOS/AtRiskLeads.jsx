import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Clock, Loader2, Send, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const RISK_RULES = [
  { id: 'no_contact', label: 'No contact > 7 days', check: (l) => {
    if (!l.last_contact_date) return true;
    return (Date.now() - new Date(l.last_contact_date).getTime()) > 7 * 24 * 60 * 60 * 1000;
  }, severity: 'high', icon: Clock },
  { id: 'stuck_stage', label: 'Stuck in same stage > 14 days', check: (l) => {
    return (Date.now() - new Date(l.created_date).getTime()) > 14 * 24 * 60 * 60 * 1000
      && !['closed_won', 'closed_lost'].includes(l.stage);
  }, severity: 'medium', icon: RefreshCw },
  { id: 'unassigned', label: 'Unassigned lead', check: (l) => !l.assigned_agent, severity: 'critical', icon: AlertTriangle },
  { id: 'high_budget_cold', label: 'High budget + no recent contact', check: (l) => {
    if ((l.budget_aed || 0) < 2000000) return false;
    if (!l.last_contact_date) return true;
    return (Date.now() - new Date(l.last_contact_date).getTime()) > 3 * 24 * 60 * 60 * 1000;
  }, severity: 'critical', icon: AlertTriangle },
];

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-500/10 border-red-500/25', badge: 'text-red-400 bg-red-500/10', dot: 'bg-red-400' },
  high:     { bg: 'bg-amber-500/10 border-amber-500/25', badge: 'text-amber-400 bg-amber-500/10', dot: 'bg-amber-400' },
  medium:   { bg: 'bg-orange-500/10 border-orange-500/25', badge: 'text-orange-400 bg-orange-500/10', dot: 'bg-orange-400' },
};

export default function AtRiskLeads({ leads, agents }) {
  const queryClient = useQueryClient();
  const [reassigning, setReassigning] = useState(null);

  const atRisk = leads
    .filter(l => !['closed_won', 'closed_lost'].includes(l.stage))
    .map(l => {
      const risks = RISK_RULES.filter(r => r.check(l));
      if (risks.length === 0) return null;
      const severity = risks.find(r => r.severity === 'critical') ? 'critical' :
                       risks.find(r => r.severity === 'high') ? 'high' : 'medium';
      return { lead: l, risks, severity };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const s = { critical: 0, high: 1, medium: 2 };
      return s[a.severity] - s[b.severity];
    });

  const reassignMutation = useMutation({
    mutationFn: ({ leadId, agentEmail, agentName }) =>
      base44.entities.Lead.update(leadId, { assigned_agent: agentEmail, assigned_agent_name: agentName }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Reassigned to ${vars.agentName}`);
      setReassigning(null);
    },
  });

  const leastBusy = agents.length > 0
    ? agents.reduce((a, b) => (a.assigned_conversations || 0) <= (b.assigned_conversations || 0) ? a : b)
    : null;

  const whatsappRe = (lead) => {
    const phone = lead.phone || lead.phones?.[0]?.number;
    if (!phone) { toast.error('No phone number'); return; }
    const msg = encodeURIComponent(`Hi ${lead.name}, we wanted to check in and see if you're still looking for a property in Dubai. We have some great new options that match your criteria. Would you like to schedule a call?`);
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  const counts = { critical: atRisk.filter(r => r.severity === 'critical').length, high: atRisk.filter(r => r.severity === 'high').length, medium: atRisk.filter(r => r.severity === 'medium').length };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">At-Risk Lead Radar</h2>
        <div className="flex gap-2">
          {Object.entries(counts).map(([sev, count]) => count > 0 && (
            <span key={sev} className={`text-[10px] font-semibold px-2 py-1 rounded-full ${SEVERITY_STYLES[sev].badge}`}>
              {count} {sev}
            </span>
          ))}
        </div>
      </div>

      {atRisk.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-white">No at-risk leads detected</p>
          <p className="text-xs text-white/30 mt-1">Your team is on top of all leads. Keep it up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {atRisk.map(({ lead, risks, severity }) => {
            const style = SEVERITY_STYLES[severity];
            const silentFor = lead.last_contact_date
              ? formatDistanceToNow(new Date(lead.last_contact_date), { addSuffix: true })
              : 'never';
            return (
              <div key={lead.id} className={`p-4 rounded-xl border ${style.bg} space-y-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <p className="text-sm font-bold text-white">{lead.name}</p>
                    </div>
                    <p className="text-[10px] text-white/40">
                      {lead.stage?.replace(/_/g, ' ')} · {lead.assigned_agent || 'Unassigned'} · Last contact: {silentFor}
                      {lead.budget_aed && ` · AED ${lead.budget_aed.toLocaleString()}`}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${style.badge}`}>
                    {severity}
                  </span>
                </div>

                {/* Risk flags */}
                <div className="flex flex-wrap gap-1.5">
                  {risks.map(r => {
                    const Icon = r.icon;
                    return (
                      <span key={r.id} className="flex items-center gap-1 text-[9px] font-medium px-2 py-1 bg-white/5 border border-white/10 rounded-full text-white/50">
                        <Icon className="w-2.5 h-2.5" /> {r.label}
                      </span>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => whatsappRe(lead)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-all"
                  >
                    <Send className="w-3 h-3" /> Re-engage via WhatsApp
                  </button>
                  {leastBusy && lead.assigned_agent !== leastBusy.agent_email && (
                    <button
                      onClick={() => reassignMutation.mutate({ leadId: lead.id, agentEmail: leastBusy.agent_email, agentName: leastBusy.agent_name })}
                      disabled={reassignMutation.isPending && reassigning === lead.id}
                      className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg hover:bg-indigo-500/30 transition-all"
                    >
                      {reassignMutation.isPending && reassigning === lead.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />
                      }
                      Reassign to {leastBusy.agent_name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}