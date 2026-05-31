import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Brain, Network, Zap, Users, Home, Building, MessageCircle, TrendingUp, AlertCircle, CheckCircle2, Clock, RefreshCw, Sparkles, Link2, Search, Filter, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import CriticalMetricsPanel from '@/components/aisync/CriticalMetricsPanel';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Entity type configuration
const ENTITY_CONFIG = {
  Lead: { icon: Users, color: '#3b82f6', label: 'Leads' },
  Property: { icon: Home, color: '#10b981', label: 'Properties' },
  Landlord: { icon: Building, color: '#f59e0b', label: 'Landlords' },
  Deal: { icon: TrendingUp, color: '#8b5cf6', label: 'Deals' },
  WhatsAppConversation: { icon: MessageCircle, color: '#22c55e', label: 'Conversations' },
  Reminder: { icon: Calendar, color: '#ec4899', label: 'Reminders' },
};

// Sync status badge
function SyncStatusBadge({ status, lastSync }) {
  const configs = {
    synced: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Synced' },
    syncing: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Syncing...', spin: true },
    pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Pending' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Error' },
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${config.color} ${config.spin ? 'animate-spin' : ''}`} />
      <span className={config.color}>{config.label}</span>
      {lastSync && <span className="text-muted-foreground ml-1">{format(new Date(lastSync), 'HH:mm')}</span>}
    </div>
  );
}

// Entity connection card
function EntityConnectionCard({ entity, connections, onSync }) {
  const config = ENTITY_CONFIG[entity.name] || { icon: Network, color: '#64748b', label: entity.name };
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 hover:bg-white/5 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${config.color}20` }}>
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
            <p className="text-xs text-muted-foreground">{entity.count} records</p>
          </div>
        </div>
        <SyncStatusBadge status={entity.syncStatus} lastSync={entity.lastSyncAt} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Connections</span>
          <span className="text-foreground font-medium">{connections.length} active</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {connections.slice(0, 4).map((conn, idx) => (
            <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-xs">
              <Link2 className="w-3 h-3 text-accent" />
              <span className="text-muted-foreground">{conn}</span>
            </div>
          ))}
          {connections.length > 4 && (
            <div className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-muted-foreground">
              +{connections.length - 4} more
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => onSync(entity.name)}
        className="w-full mt-4 py-2 rounded-xl text-xs font-semibold transition-colors"
        style={{
          background: 'hsl(38 92% 50%)',
          color: 'hsl(222 47% 11%)',
        }}
      >
        <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
        Sync Now
      </button>
    </motion.div>
  );
}

// Smart insight card
function SmartInsightCard({ insight, onAction }) {
  const configs = {
    recommendation: { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Recommendation' },
    warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Warning' },
    opportunity: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Opportunity' },
    critical: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Critical' },
  };

  const config = configs[insight.type] || configs.recommendation;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl p-4 border ${config.bg} border-white/10`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.color} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(insight.detectedAt), 'HH:mm')}</span>
          </div>
          <p className="text-sm font-medium text-foreground mb-2">{insight.title}</p>
          <p className="text-xs text-muted-foreground mb-3">{insight.description}</p>
          {insight.action && (
            <button
              onClick={() => onAction(insight)}
              className="text-xs font-semibold text-accent hover:text-accent/80"
            >
              {insight.actionLabel} →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Simple node-link diagram (replaces ForceDirectedGraph which doesn't exist in recharts)
function RelationshipGraph({ data }) {
  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <Network className="w-8 h-8 mr-2" />
        <span className="text-sm">No connections detected</span>
      </div>
    );
  }

  // Simple visualization using pie chart to show entity distribution
  const pieData = data.nodes.map(node => ({
    name: node.label,
    value: node.size,
    color: node.color,
  }));

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'rgba(20,28,48,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AISyncHub() {
  const qc = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [syncingEntity, setSyncingEntity] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [syncHistory, setSyncHistory] = useState(null);

  // Fetch all entities
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-sync'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
    staleTime: 60000,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-sync'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
    staleTime: 60000,
  });

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords-sync'],
    queryFn: () => base44.entities.Landlord.list('-created_date', 200),
    staleTime: 60000,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-sync'],
    queryFn: () => base44.entities.Deal.list('-created_date', 200),
    staleTime: 60000,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations-sync'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 200),
    staleTime: 60000,
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders-sync'],
    queryFn: () => base44.entities.Reminder.list('-due_at', 200),
    staleTime: 60000,
  });

  // Trigger AI synchronization
  const syncMutation = useMutation({
    mutationFn: async (entityName) => {
      setSyncingEntity(entityName);
      const response = await base44.functions.invoke('aiEntitySynchronizer', {
        entity_name: entityName,
        mode: 'full_sync',
      });
      return response.data;
    },
    onSuccess: (data, entityName) => {
      toast.success(`${entityName} synchronized successfully`, {
        description: `${data.syncedCount} records processed, ${data.connectionsFound} new connections discovered`,
      });
      qc.invalidateQueries({ queryKey: [`${entityName.toLowerCase()}-sync`] });
      setSyncingEntity(null);
    },
    onError: (error, entityName) => {
      toast.error(`Sync failed for ${entityName}`, {
        description: error.message,
      });
      setSyncingEntity(null);
    },
  });

  // Calculate entity stats
  const entityStats = [
    { name: 'Lead', count: leads.length, syncStatus: 'synced', lastSyncAt: new Date().toISOString() },
    { name: 'Property', count: properties.length, syncStatus: 'synced', lastSyncAt: new Date().toISOString() },
    { name: 'Landlord', count: landlords.length, syncStatus: 'synced', lastSyncAt: new Date().toISOString() },
    { name: 'Deal', count: deals.length, syncStatus: 'synced', lastSyncAt: new Date().toISOString() },
    { name: 'WhatsAppConversation', count: conversations.length, syncStatus: 'synced', lastSyncAt: new Date().toISOString() },
    { name: 'Reminder', count: reminders.length, syncStatus: 'synced', lastSyncAt: new Date().toISOString() },
  ];

  // Detect connections between entities
  const connections = useMemo(() => {
    const allConnections = [];

    // Lead ↔ Deal connections
    deals.forEach(deal => {
      const lead = leads.find(l => l.id === deal.lead_id);
      if (lead) {
        allConnections.push({
          source: `Lead-${lead.id}`,
          target: `Deal-${deal.id}`,
          type: 'owns',
          strength: 1,
        });
      }
    });

    // Deal ↔ Property connections
    deals.forEach(deal => {
      const property = properties.find(p => p.id === deal.property_id);
      if (property) {
        allConnections.push({
          source: `Deal-${deal.id}`,
          target: `Property-${property.id}`,
          type: 'interested_in',
          strength: 1,
        });
      }
    });

    // Landlord ↔ Property connections (via unit_reference or project)
    landlords.forEach(landlord => {
      const matchedProperties = properties.filter(p =>
        p.building_name === landlord.project_name ||
        p.address?.includes(landlord.unit_reference)
      );
      matchedProperties.forEach(property => {
        allConnections.push({
          source: `Landlord-${landlord.id}`,
          target: `Property-${property.id}`,
          type: 'owns',
          strength: 0.8,
        });
      });
    });

    // Lead ↔ WhatsApp connections
    conversations.forEach(convo => {
      const lead = leads.find(l =>
        l.phone === convo.wa_phone_e164 ||
        l.whatsapp === convo.wa_phone_e164
      );
      if (lead) {
        allConnections.push({
          source: `Lead-${lead.id}`,
          target: `WhatsApp-${convo.id}`,
          type: 'communicates_via',
          strength: 0.9,
        });
      }
    });

    // Reminder ↔ Lead connections
    reminders.forEach(reminder => {
      if (reminder.lead_id) {
        const lead = leads.find(l => l.id === reminder.lead_id);
        if (lead) {
          allConnections.push({
            source: `Reminder-${reminder.id}`,
            target: `Lead-${lead.id}`,
            type: 'follows_up',
            strength: 1,
          });
        }
      }

      // Reminder ↔ Property connections
      if (reminder.property_id) {
        const property = properties.find(p => p.id === reminder.property_id);
        if (property) {
          allConnections.push({
            source: `Reminder-${reminder.id}`,
            target: `Property-${property.id}`,
            type: 'related_to',
            strength: 0.8,
          });
        }
      }
    });

    return allConnections;
  }, [leads, properties, landlords, deals, conversations, reminders]);

  // Generate smart insights
  const insights = useMemo(() => {
    const generatedInsights = [];

    // Unmatched leads (no deal assigned)
    const unmatchedLeads = leads.filter(lead =>
      !deals.some(deal => deal.lead_id === lead.id) &&
      lead.stage !== 'closed' &&
      lead.status === 'active'
    );
    if (unmatchedLeads.length > 0) {
      generatedInsights.push({
        type: 'opportunity',
        title: `${unmatchedLeads.length} Active Leads Without Deals`,
        description: `These leads are engaged but haven't been converted to deals yet. Consider creating deals for high-scoring leads.`,
        detectedAt: new Date().toISOString(),
        action: 'create_deals',
        actionLabel: 'Review & Create Deals',
        data: unmatchedLeads.slice(0, 5),
      });
    }

    // Properties without interested leads
    const orphanProperties = properties.filter(property =>
      !deals.some(deal => deal.property_id === property.id) &&
      property.status === 'available'
    );
    if (orphanProperties.length > 0) {
      generatedInsights.push({
        type: 'recommendation',
        title: `${orphanProperties.length} Properties Need Promotion`,
        description: `These available properties have no active deals. Match them with interested leads based on preferences.`,
        detectedAt: new Date().toISOString(),
        action: 'match_properties',
        actionLabel: 'Auto-Match Leads',
        data: orphanProperties.slice(0, 5),
      });
    }

    // Landlords without listings
    const unlistedLandlords = landlords.filter(landlord =>
      landlord.stage === 'listing_commitment' &&
      !properties.some(p => p.agent_email === landlord.assigned_agent_email)
    );
    if (unlistedLandlords.length > 0) {
      generatedInsights.push({
        type: 'warning',
        title: `${unlistedLandlords.length} Landlords Awaiting Listings`,
        description: `These landlords are in the listing commitment stage but have no active properties listed.`,
        detectedAt: new Date().toISOString(),
        action: 'follow_up',
        actionLabel: 'Schedule Follow-ups',
        data: unlistedLandlords.slice(0, 5),
      });
    }

    // Stale conversations
    const staleConversations = conversations.filter(convo =>
      convo.last_message_at &&
      new Date(convo.last_message_at) < subDays(new Date(), 3) &&
      (convo.status === 'open' || convo.status === 'new')
    );
    if (staleConversations.length > 0) {
      generatedInsights.push({
        type: 'critical',
        title: `${staleConversations.length} Conversations Need Attention`,
        description: `These conversations haven't had activity in 3+ days and are still open.`,
        detectedAt: new Date().toISOString(),
        action: 'reengage',
        actionLabel: 'Send Follow-ups',
        data: staleConversations.slice(0, 5),
      });
    }

    // Overdue reminders
    const overdueReminders = reminders.filter(r =>
      r.due_date &&
      new Date(r.due_date) < new Date() &&
      r.status === 'pending'
    );
    if (overdueReminders.length > 0) {
      generatedInsights.push({
        type: 'warning',
        title: `${overdueReminders.length} Overdue Reminders`,
        description: `These reminders are past due and need immediate attention.`,
        detectedAt: new Date().toISOString(),
        action: 'review_reminders',
        actionLabel: 'Review & Reschedule',
        data: overdueReminders.slice(0, 5),
      });
    }

    // Reminders without leads
    const orphanReminders = reminders.filter(r =>
      !r.lead_id &&
      r.status === 'pending' &&
      r.priority === 'urgent'
    );
    if (orphanReminders.length > 0) {
      generatedInsights.push({
        type: 'recommendation',
        title: `${orphanReminders.length} Unlinked Urgent Reminders`,
        description: `These urgent reminders aren't linked to any lead. Consider associating them.`,
        detectedAt: new Date().toISOString(),
        action: 'link_reminders',
        actionLabel: 'Link to Leads',
        data: orphanReminders.slice(0, 5),
      });
    }

    return generatedInsights;
  }, [leads, properties, landlords, deals, conversations, reminders]);

  // Build graph data for visualization
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];

    // Add entity type nodes
    Object.keys(ENTITY_CONFIG).forEach(entityName => {
      const config = ENTITY_CONFIG[entityName];
      const entityData = {
        name: entityName,
        count: entityStats.find(e => e.name === entityName)?.count || 0,
      };

      nodes.push({
        id: entityName,
        label: config.label,
        color: config.color,
        size: Math.min(30, 10 + entityData.count / 10),
        entityType: entityName,
      });
    });

    // Aggregate connections by entity type
    const connectionCounts = {};
    connections.forEach(conn => {
      const sourceType = conn.source.split('-')[0];
      const targetType = conn.target.split('-')[0];
      const key = `${sourceType}-${targetType}`;
      connectionCounts[key] = (connectionCounts[key] || 0) + 1;
    });

    // Create links between entity types
    Object.entries(connectionCounts).forEach(([key, count]) => {
      const [source, target] = key.split('-');
      if (source !== target) {
        links.push({
          source,
          target,
          value: count,
          strength: count / 10,
        });
      }
    });

    return { nodes, links };
  }, [connections, entityStats]);

  const handleSyncAll = async () => {
    toast.info('Starting full synchronization...', {
      description: 'This may take a few minutes to process all entities',
    });

    try {
      const response = await base44.functions.invoke('aiEntitySynchronizer', {
        entity_name: 'all',
        mode: 'full_sync',
        detectConnections: true,
        generateInsights: true,
        useClaude: true,
      });

      let description = `${response.data.totalSynced} records processed, ${response.data.totalConnections} connections discovered`;
      if (response.data.executed_actions?.length > 0) {
        description += `, ${response.data.executed_actions.filter(a => a.success).length} AI actions executed`;
      }

      toast.success('Synchronization complete', {
        description,
      });

      // Store Claude insights and metrics for display
      if (response.data.claude_insights) {
        setSyncHistory({
          claude_insights: response.data.claude_insights,
          executed_actions: response.data.executed_actions || [],
          metrics: response.data.claude_insights.metrics || null,
        });
      }

      qc.invalidateQueries();
    } catch (error) {
      toast.error('Synchronization failed', {
        description: error.message,
      });
    }
  };

  const handleInsightAction = async (insight) => {
    if (insight.action === 'create_deals') {
      toast.info('Opening deal creation workflow...', {
        description: 'AI will pre-populate deal records for selected leads',
      });
    } else if (insight.action === 'match_properties') {
      toast.info('Running property matching algorithm...', {
        description: 'AI will analyze lead preferences and property features',
      });
      const response = await base44.functions.invoke('matchLeadToProperties', {});
      toast.success('Matching complete', {
        description: `${response.data.matches?.length || 0} matches found`,
      });
    }
  };

  return (
    <div className="min-h-screen page-root pb-24">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-4xl flex items-center gap-3">
              <Brain className="w-10 h-10 text-accent" />
              AI Sync Hub
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Intelligent entity synchronization and relationship discovery
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSyncAll}
              className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{
                background: 'hsl(38 92% 50%)',
                color: 'hsl(222 47% 11%)',
              }}
            >
              <Zap className="w-4 h-4" />
              Sync All
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search entities, connections, insights..."
              className="w-full pl-9 pr-3 py-2.5 text-sm glass-input rounded-xl"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2.5 text-sm glass-input rounded-xl"
          >
            <option value="all">All Types</option>
            <option value="Lead">Leads</option>
            <option value="Property">Properties</option>
            <option value="Landlord">Landlords</option>
            <option value="Deal">Deals</option>
            <option value="WhatsAppConversation">Conversations</option>
            <option value="Reminder">Reminders</option>
          </select>
        </div>

        {/* Entity Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {entityStats.map(entity => (
            <EntityConnectionCard
              key={entity.name}
              entity={entity}
              connections={connections
                .filter(c => c.source.startsWith(entity.name) || c.target.startsWith(entity.name))
                .map(c => c.source.startsWith(entity.name) ? c.target.split('-')[0] : c.source.split('-')[0])
              }
              onSync={syncMutation.mutate}
            />
          ))}
        </div>

        {/* Critical Business Metrics */}
        {syncHistory?.metrics && (
          <CriticalMetricsPanel metrics={syncHistory.metrics} />
        )}

        {/* Smart Insights */}
        {insights.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">Smart Insights</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {insights.length} {insights.length === 1 ? 'insight' : 'insights'} detected
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map((insight, idx) => (
                <SmartInsightCard
                  key={idx}
                  insight={insight}
                  onAction={handleInsightAction}
                />
              ))}
            </div>
          </div>
        )}

        {/* Claude AI Insights */}
        {syncHistory.claude_insights && (
          <div className="glass-card rounded-2xl p-5 border border-accent/20">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">Claude AI Analysis</h2>
              <span className="text-xs text-accent ml-auto">Powered by Claude Opus</span>
            </div>
            <div className="space-y-4">
              {syncHistory.claude_insights.insights?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Key Insights</h3>
                  <ul className="space-y-1">
                    {syncHistory.claude_insights.insights.map((insight, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {syncHistory.claude_insights.opportunities?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Opportunities</h3>
                  <ul className="space-y-1">
                    {syncHistory.claude_insights.opportunities.map((opp, idx) => (
                      <li key={idx} className="text-sm text-emerald-400 flex items-start gap-2">
                        <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {opp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {syncHistory.claude_insights.risk_factors?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Risk Factors</h3>
                  <ul className="space-y-1">
                    {syncHistory.claude_insights.risk_factors.map((risk, idx) => (
                      <li key={idx} className="text-sm text-red-400 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {syncHistory.executed_actions?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Executed Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {syncHistory.executed_actions.filter(a => a.success).map((action, idx) => (
                      <div key={idx} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ✓ {action.type}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Relationship Graph */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">Entity Relationship Map</h2>
            </div>
            <div className="flex gap-2 text-xs">
              {Object.entries(ENTITY_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: config.color }} />
                  <span className="text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
          <RelationshipGraph data={graphData} />
        </div>

        {/* Connection Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">Connection Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={[
                  { name: 'Lead→Deal', value: connections.filter(c => c.source.startsWith('Lead') && c.target.startsWith('Deal')).length },
                  { name: 'Deal→Property', value: connections.filter(c => c.source.startsWith('Deal') && c.target.startsWith('Property')).length },
                  { name: 'Landlord→Property', value: connections.filter(c => c.source.startsWith('Landlord') && c.target.startsWith('Property')).length },
                  { name: 'Lead→WhatsApp', value: connections.filter(c => c.source.startsWith('Lead') && c.target.startsWith('WhatsApp')).length },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={10} angle={-15} textAnchor="end" />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: 'rgba(20,28,48,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">Sync Activity (24h)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart
                data={[
                  { time: '00:00', entities: 2, connections: 5 },
                  { time: '04:00', entities: 1, connections: 3 },
                  { time: '08:00', entities: 8, connections: 15 },
                  { time: '12:00', entities: 12, connections: 28 },
                  { time: '16:00', entities: 15, connections: 35 },
                  { time: '20:00', entities: 10, connections: 22 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: 'rgba(20,28,48,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Legend />
                <Line type="monotone" dataKey="entities" stroke="#3b82f6" strokeWidth={2} />
                <Bar dataKey="connections" fill="#10b981" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}