import React, { useState, useEffect } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { Users, Brain, Target, Trash2, User, Home } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PropertyComparison from '@/components/properties/PropertyComparison';

export default function MetaAdsLeads() {
  const [filterIntent, setFilterIntent] = useState('all');
  const [showComparison, setShowComparison] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['metaLeads'],
    queryFn: async () => {
      const all = await base44.entities.Lead.list('-created_date', 50);
      return all.filter(l => 
        ['facebook', 'instagram', 'google_ads', 'meta_ads'].includes(l.source)
      );
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Lead.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metaLeads'] });
      toast.success('Lead updated');
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Lead.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metaLeads'] });
      toast.success('Lead deleted');
    },
  });

  const filteredLeads = leads.filter(lead => {
    if (filterIntent === 'all') return true;
    return lead.intent === filterIntent;
  });

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

  const handleShowProperties = async (lead) => {
    setSelectedLead(lead);
    setShowComparison(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meta Ads & Google Leads</h1>
          <p className="text-gray-500 mt-1">Auto-imported leads from advertising campaigns</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Total Leads</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Buyers</span>
              <Target className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.buyer}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Tenants</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.tenant}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">High Score (70+)</span>
              <Brain className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.highScore}</p>
          </iOSCard>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <iOSBadge 
            variant={filterIntent === 'all' ? 'blue' : 'gray'}
            className="cursor-pointer"
            onClick={() => setFilterIntent('all')}
          >
            All
          </iOSBadge>
          <iOSBadge 
            variant={filterIntent === 'buyer' ? 'blue' : 'gray'}
            className="cursor-pointer"
            onClick={() => setFilterIntent('buyer')}
          >
            Buyers
          </iOSBadge>
          <iOSBadge 
            variant={filterIntent === 'tenant' ? 'blue' : 'gray'}
            className="cursor-pointer"
            onClick={() => setFilterIntent('tenant')}
          >
            Tenants
          </iOSBadge>
        </div>

        {/* Leads Grid */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Imported Leads</h2>
              <p className="text-sm text-gray-500">{filteredLeads.length} leads from Meta & Google</p>
            </div>
          </div>

          <Dialog open={showComparison} onOpenChange={setShowComparison}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Property Comparison</DialogTitle>
                <DialogDescription>
                  Comparing properties for {selectedLead?.full_name}
                </DialogDescription>
              </DialogHeader>
              {selectedLead && (
                <PropertyComparisonWrapper 
                  lead={selectedLead} 
                  onClose={() => setShowComparison(false)} 
                />
              )}
            </DialogContent>
          </Dialog>

          {filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
              <Users className="w-12 h-12 mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2 text-gray-700">No leads yet</h3>
              <p className="text-sm text-center max-w-md text-gray-500">
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
                  onShowProperties={handleShowProperties}
                  onDelete={() => deleteLeadMutation.mutate(lead.id)}
                />
              ))}
            </div>
          )}
        </iOSCard>
      </div>
    </div>
  );
}

function PropertyComparisonWrapper({ lead, onClose }) {
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProperties = async () => {
      setIsLoading(true);
      try {
        const result = await base44.functions.invoke('matchLeadToProperties', { lead_id: lead.id });
        setProperties(result.properties || []);
      } catch (error) {
        console.error('Failed to fetch properties:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProperties();
  }, [lead.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Home className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No matching properties found for this lead</p>
      </div>
    );
  }

  return <PropertyComparison properties={properties} lead={lead} onClose={onClose} />;
}

function LeadCard({ lead, onAssignAgent, onShowProperties, onDelete }) {
  const score = lead.ai_lead_score || 0;
  const scoreColor = score >= 70 ? 'green' : score >= 40 ? 'orange' : 'red';

  return (
    <iOSCard className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-sm text-gray-900">{lead.full_name}</h3>
            <p className="text-xs text-gray-500">{lead.source}</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 mb-3">
        <p className="text-xs text-gray-500 mb-1">AI Score</p>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-semibold ${
            score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600'
          }`}>{score}</span>
          <iOSBadge variant={scoreColor} className="text-xs">
            {score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold'}
          </iOSBadge>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <iOSBadge variant={lead.intent === 'buyer' ? 'blue' : 'purple'}>
          {lead.intent}
        </iOSBadge>
        {lead.preferred_locations?.[0] && (
          <iOSBadge variant="gray">
            {lead.preferred_locations[0]}
          </iOSBadge>
        )}
      </div>

      <div className="space-y-1 mb-3 text-xs text-gray-600">
        {lead.phone && (
          <div className="flex items-center gap-2">
            <span>📞</span>
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-2">
            <span>✉️</span>
            <span>{lead.email}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        <div className="flex-1">
          <Select
            value={lead.assigned_agent_email || ''}
            onValueChange={(value) => onAssignAgent(lead.id, value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Assign agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent1@erudite.com">Agent 1</SelectItem>
              <SelectItem value="agent2@erudite.com">Agent 2</SelectItem>
              <SelectItem value="agent3@erudite.com">Agent 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={() => onShowProperties(lead)}
          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
          title="Show AI-matched properties"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>
    </iOSCard>
  );
}