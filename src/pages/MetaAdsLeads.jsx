import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import { Users, Brain, TrendingUp, Target, MessageCircle, Phone, Mail, Trash2, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function MetaAdsLeads() {
  const [filterIntent, setFilterIntent] = useState('all');
  const queryClient = useQueryClient();

  // Fetch leads from Meta/Google sources
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['metaLeads'],
    queryFn: async () => {
      const all = await base44.entities.Lead.list('-created_date', 50);
      return all.filter(l => 
        ['facebook', 'instagram', 'google_ads', 'meta_ads'].includes(l.source)
      );
    },
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Lead.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metaLeads'] });
      toast.success('Lead updated');
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Lead.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metaLeads'] });
      toast.success('Lead deleted');
    },
  });

  // Send WhatsApp mutation
  const sendWhatsAppMutation = useMutation({
    mutationFn: async ({ phone, message }) => {
      return await base44.functions.invoke('sendWhatsAppMessage', { phone, message });
    },
    onSuccess: () => {
      toast.success('WhatsApp sent');
    },
  });

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    if (filterIntent === 'all') return true;
    return lead.intent === filterIntent;
  });

  // Stats
  const stats = {
    total: leads.length,
    buyer: leads.filter(l => l.intent === 'buyer').length,
    tenant: leads.filter(l => l.intent === 'tenant').length,
    highScore: leads.filter(l => (l.ai_lead_score || 0) >= 70).length,
  };

  const handleAssignAgent = (leadId, agentEmail) => {
    updateLeadMutation.mutate({
      id: leadId,
      data: { assigned_agent_email: agentEmail },
    });
  };

  const handleSendFirstMessage = async (lead) => {
    const nba = lead.ai_next_best_actions?.[0];
    if (nba?.draft_message && lead.whatsapp) {
      sendWhatsAppMutation.mutate({
        phone: lead.whatsapp,
        message: nba.draft_message,
      });
    }
  };

  return (
    <EruditePage
      title="Meta Ads & Google Leads"
      subtitle="Auto-imported leads from advertising campaigns"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>Total Leads</span>
              <Users className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
            <p className="text-3xl font-light" style={{ color: 'rgba(255,255,255,0.95)' }}>{stats.total}</p>
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>Buyers</span>
              <Target className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
            <p className="text-3xl font-light" style={{ color: 'rgba(255,255,255,0.95)' }}>{stats.buyer}</p>
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>Tenants</span>
              <Users className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
            <p className="text-3xl font-light" style={{ color: 'rgba(255,255,255,0.95)' }}>{stats.tenant}</p>
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>High Score (70+)</span>
              <Brain className="w-4 h-4" style={{ color: 'hsl(38 92% 50% / 0.7)' }} />
            </div>
            <p className="text-3xl font-light" style={{ color: 'rgba(255,255,255,0.95)' }}>{stats.highScore}</p>
          </div>
        </EruditeCard>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <EruditeBadge 
          className={`cursor-pointer ${filterIntent === 'all' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setFilterIntent('all')}
        >
          All
        </EruditeBadge>
        <EruditeBadge 
          className={`cursor-pointer ${filterIntent === 'buyer' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setFilterIntent('buyer')}
        >
          Buyers
        </EruditeBadge>
        <EruditeBadge 
          className={`cursor-pointer ${filterIntent === 'tenant' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setFilterIntent('tenant')}
        >
          Tenants
        </EruditeBadge>
      </div>

      {/* Leads Grid */}
      <EruditeSection title="Imported Leads" subtitle={`${filteredLeads.length} leads from Meta & Google`} icon={Users}>
        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border border-dashed bg-white/[0.02] border-white/10">
            <Users className="w-8 h-8 mb-4" style={{ color: 'hsl(38 92% 50% / 0.6)' }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>No leads yet</h3>
            <p className="text-sm text-center max-w-md" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Configure your Meta/Google webhooks to start receiving leads automatically
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onAssignAgent={handleAssignAgent}
                onSendFirstMessage={handleSendFirstMessage}
                onDelete={() => deleteLeadMutation.mutate(lead.id)}
              />
            ))}
          </div>
        )}
      </EruditeSection>
    </EruditePage>
  );
}

// Compact Lead Card Component
function LeadCard({ lead, onAssignAgent, onSendFirstMessage, onDelete }) {
  const score = lead.ai_lead_score || 0;
  const conversionProb = lead.ai_conversion_probability ? Math.round(lead.ai_conversion_probability * 100) : 0;
  const persona = lead.ai_persona;
  const nba = lead.ai_next_best_actions?.[0];

  const scoreColor = score >= 70 ? 'emerald' : score >= 40 ? 'amber' : 'rose';

  return (
    <EruditeCard className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
            <User className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h3 className="font-medium text-sm" style={{ color: 'rgba(255,255,255,0.95)' }}>{lead.full_name}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{lead.source}</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* AI Score & Conversion */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
          <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>AI Score</p>
          <div className="flex items-center gap-1.5">
            <span className={`text-lg font-semibold ${
              score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-rose-400'
            }`}>{score}</span>
            <EruditeBadge variant={scoreColor} className="text-xs">{score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold'}</EruditeBadge>
          </div>
        </div>
        <div className="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
          <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Conversion</p>
          <p className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{conversionProb}%</p>
        </div>
      </div>

      {/* Persona */}
      {persona?.archetype && (
        <div className="mb-3 px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <p className="text-xs font-medium mb-0.5" style={{ color: 'hsl(38 92% 50% / 0.8)' }}>Persona</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{persona.archetype.replace(/_/g, ' ')}</p>
        </div>
      )}

      {/* Next Best Action */}
      {nba && (
        <div className="mb-3 px-2 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(59,130,246,0.7)' }}>Next Action</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{nba.action.replace(/_/g, ' ')}</p>
        </div>
      )}

      {/* Intent & Location */}
      <div className="flex gap-2 mb-3">
        <EruditeBadge variant={lead.intent === 'buyer' ? 'blue' : 'purple'}>
          {lead.intent}
        </EruditeBadge>
        {lead.preferred_locations?.[0] && (
          <EruditeBadge variant="default">
            {lead.preferred_locations[0]}
          </EruditeBadge>
        )}
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 mb-3 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3 h-3" />
            <span>{lead.email}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/10">
        <div className="flex-1">
          <Select
            value={lead.assigned_agent_email || ''}
            onValueChange={(value) => onAssignAgent(lead.id, value)}
          >
            <SelectTrigger className="h-8 text-xs glass-input">
              <SelectValue placeholder="Assign agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent1@erudite.com">Agent 1</SelectItem>
              <SelectItem value="agent2@erudite.com">Agent 2</SelectItem>
              <SelectItem value="agent3@erudite.com">Agent 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {nba?.draft_message && lead.whatsapp && (
          <button
            onClick={() => onSendFirstMessage(lead)}
            className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
            title="Send AI-suggested first message"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        )}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        {lead.whatsapp && (
          <a
            href={`https://wa.me/${lead.whatsapp.replace('+', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        )}
      </div>
    </EruditeCard>
  );
}