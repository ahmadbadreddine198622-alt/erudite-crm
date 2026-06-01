import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Clock, MessageSquare } from 'lucide-react';

export default function EruditeDashboard() {
  // Pipeline Health from auroraOrchestrator
  const { data: pipelineData } = useQuery({
    queryKey: ['aurora-pipeline-health'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('auroraOrchestrator', {});
        return res?.data;
      } catch (e) {
        console.error('Aurora orchestrator failed:', e);
        return null;
      }
    },
  });

  // Stale & Cold Leads
  const { data: staleLeads = [] } = useQuery({
    queryKey: ['stale-leads'],
    queryFn: async () => {
      try {
        const [staleRes, coldRes] = await Promise.all([
          base44.functions.invoke('checkStaleLead', {}),
          base44.functions.invoke('detectColdLeads', {}),
        ]);
        const stale = staleRes?.data?.stale_leads || [];
        const cold = coldRes?.data?.cold_leads || [];
        return [...stale, ...cold].slice(0, 10);
      } catch (e) {
        console.error('Stale/cold lead detection failed:', e);
        return [];
      }
    },
  });

  // Top Opportunities by AI Score
  const { data: topLeads = [] } = useQuery({
    queryKey: ['top-leads-by-score'],
    queryFn: async () => {
      try {
        const leads = await base44.entities.Lead.filter({ ai_lead_score: { $gte: 60 } }, '-ai_lead_score', 10);
        return leads;
      } catch (e) {
        console.error('Top leads fetch failed:', e);
        return [];
      }
    },
  });

  // Suggested Replies Queue
  const { data: priorityConversations = [] } = useQuery({
    queryKey: ['priority-whatsapp-conversations'],
    queryFn: async () => {
      try {
        const conversations = await base44.entities.WhatsAppConversation.filter(
          { ai_priority: { $in: ['high', 'urgent'] } },
          '-updated_date',
          10
        );
        return conversations;
      } catch (e) {
        console.error('Priority conversations fetch failed:', e);
        return [];
      }
    },
  });

  return (
    <div className="page-root">
      <div className="mb-6">
        <h1 className="page-title text-2xl">Erudite Manager Brief</h1>
        <p className="page-subtitle mt-1">Daily AI-powered overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pipeline Health */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Pipeline Health</h2>
          </div>
          {pipelineData ? (
            <div className="space-y-3 text-sm">
              {pipelineData.bottlenecks?.slice(0, 3).map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-foreground">{b.stage || b.description}</p>
                    <p className="text-muted-foreground text-xs">{b.count || 0} deals at risk</p>
                  </div>
                </div>
              ))}
              {(!pipelineData?.bottlenecks || pipelineData.bottlenecks.length === 0) && (
                <p className="text-muted-foreground text-sm">No bottlenecks detected</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Loading pipeline data...</p>
          )}
        </div>

        {/* Stale & Cold Leads */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Stale & Cold Leads</h2>
          </div>
          <div className="space-y-2">
            {staleLeads.slice(0, 5).map((lead, i) => (
              <Link
                key={i}
                to="/leads"
                className="block text-sm hover:bg-white/5 rounded p-1.5 -mx-1.5 transition-colors"
              >
                <p className="text-foreground font-medium">{lead.full_name || lead.name || 'Unnamed'}</p>
                <p className="text-muted-foreground text-xs">
                  {lead.stage || 'Unknown stage'} • {lead.days_in_stage || 0} days
                </p>
              </Link>
            ))}
            {staleLeads.length === 0 && (
              <p className="text-muted-foreground text-sm">No stale leads detected</p>
            )}
          </div>
        </div>

        {/* Top Opportunities */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-semibold text-foreground">Top Opportunities</h2>
          </div>
          <div className="space-y-2">
            {topLeads.slice(0, 5).map((lead, i) => (
              <Link
                key={i}
                to="/leads"
                className="block text-sm hover:bg-white/5 rounded p-1.5 -mx-1.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-foreground font-medium">{lead.full_name || 'Unnamed'}</p>
                  <span className="jewel-pill jewel-emerald">
                    {lead.ai_lead_score || 0}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {lead.deal_value_aed ? `AED ${Number(lead.deal_value_aed).toLocaleString()}` : 'No value'} • {lead.stage || 'Unknown'}
                </p>
              </Link>
            ))}
            {topLeads.length === 0 && (
              <p className="text-muted-foreground text-sm">No high-score leads</p>
            )}
          </div>
        </div>

        {/* Suggested Replies Queue */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Replies Queue</h2>
          </div>
          <div className="space-y-2">
            {priorityConversations.slice(0, 5).map((conv, i) => (
              <Link
                key={i}
                to="/whatsapp"
                className="block text-sm hover:bg-white/5 rounded p-1.5 -mx-1.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-foreground font-medium">{conv.wa_display_name || 'Unknown'}</p>
                  <span className={`jewel-pill ${conv.ai_priority === 'urgent' ? 'jewel-rose' : 'jewel-amber'}`}>
                    {conv.ai_priority}
                  </span>
                </div>
                {conv.ai_next_message_suggestions?.[0] && (
                  <p className="text-muted-foreground text-xs line-clamp-1 mt-1">
                    {conv.ai_next_message_suggestions[0]}
                  </p>
                )}
              </Link>
            ))}
            {priorityConversations.length === 0 && (
              <p className="text-muted-foreground text-sm">No priority conversations</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}