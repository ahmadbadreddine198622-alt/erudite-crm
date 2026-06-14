import React, { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Calendar, Clock, DollarSign, Search, X, Plus } from 'lucide-react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import PipelineBoard from '@/components/pipeline/PipelineBoard';
import LeadDetailSheet from '@/components/leads/LeadDetailSheet';
import MobilePipeline from '@/components/mobile/MobilePipeline';
import { useIsMobile } from '@/hooks/use-mobile';
import { STAGES } from '@/lib/pipeline';
import { useCurrentUser } from '@/lib/useCurrentUser';

function formatRelativeShort(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms) || ms < 0) return null;
  const minutes = ms / 60_000;
  const hours = minutes / 60;
  const days = hours / 24;
  if (days >= 1) return `${Math.floor(days)}d ago`;
  if (hours >= 1) return `${Math.floor(hours)}h ago`;
  if (minutes >= 1) return `${Math.floor(minutes)}m ago`;
  return 'just now';
}

function mostRecentSync(credRow) {
  if (!credRow) return null;
  const candidates = [
    credRow.sync_last_completed_at,
    credRow.listings_sync_last_completed_at,
    credRow.last_tested_at,
  ].filter(Boolean);
  if (!candidates.length) return null;
  return candidates.sort().reverse()[0];
}

export default function Pipeline() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  // Store only the ID; derive the live lead object from the leads cache so
  // mutations made inside LeadDetailSheet are reflected immediately.
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [activeTab, setActiveTab] = useState('sale');
  const [projectFilter, setProjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [financeFilter, setFinanceFilter] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);

  const { user: currentUser, permissions } = useCurrentUser();

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: () => base44.entities.Lead.list('-stage_entered_at', 5000),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['pipeline-listings'],
    queryFn: () => base44.entities.PFListing.list('-updated_date', 5000),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['pipeline-users'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    staleTime: 120_000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, email }) => base44.entities.Lead.update(id, { assigned_agent_email: email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      toast.success('Agent assigned');
    },
    onError: () => toast.error('Failed to assign agent'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      toast.success('Lead deleted');
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  const { data: credRows = [] } = useQuery({
    queryKey: ['pf-credential'],
    queryFn: () => base44.entities.PFCredential.list(),
  });
  const credRow = credRows[0];
  const lastSyncedAt = mostRecentSync(credRow);

  // Listing lookup map for enrichment
  const listingsMap = useMemo(() => {
    const byId = {};
    const byRef = {};
    for (const l of listings) {
      if (l.listing_id) byId[l.listing_id] = l;
      if (l.listing_reference) byRef[l.listing_reference] = l;
    }
    return { byId, byRef };
  }, [listings]);

  const getListing = useMemo(() => (lead) => {
    const meta = lead.source_metadata || {};
    if (meta.listing_id && listingsMap.byId[meta.listing_id]) return listingsMap.byId[meta.listing_id];
    if (meta.listing_reference && listingsMap.byRef[meta.listing_reference]) return listingsMap.byRef[meta.listing_reference];
    return null;
  }, [listingsMap]);

  // Active leads — permissive: only EXCLUDE explicit lost/on_hold so legacy
  // status values (warm/hot/cold) and unset status still render.
  const activeLeads = useMemo(
    () => {
      let result = leads.filter((l) => l.status !== 'lost' && l.status !== 'on_hold');
      // Role-based filtering — must run before any user-facing filters
      if (currentUser && !permissions.view_all_pipeline) {
        result = result.filter(l => l.assigned_agent_email === currentUser.email);
      }
      if (projectFilter !== 'all') result = result.filter(l => l.project_id === projectFilter);
      // Additional UI filters (applied within the role-scoped result)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        result = result.filter(l =>
          (l.full_name || l.name || '').toLowerCase().includes(q) ||
          (l.first_name || '').toLowerCase().includes(q) ||
          (l.last_name || '').toLowerCase().includes(q) ||
          (l.email || '').toLowerCase().includes(q) ||
          (l.phone || '').toLowerCase().includes(q) ||
          (l.whatsapp || '').toLowerCase().includes(q)
        );
      }
      if (agentFilter) result = result.filter(l => l.assigned_agent_email === agentFilter);
      if (languageFilter) result = result.filter(l => l.preferred_language === languageFilter);
      if (assignmentFilter === 'assigned') result = result.filter(l => !!l.assigned_agent_email);
      if (assignmentFilter === 'unassigned') result = result.filter(l => !l.assigned_agent_email);
      if (financeFilter) result = result.filter(l => l.financing_type === financeFilter);
      return result;
    },
    [leads, projectFilter, searchQuery, agentFilter, languageFilter, assignmentFilter, financeFilter, currentUser, permissions],
  );

  // Live lead for the open detail drawer — re-derived whenever the cache
  // updates, so Select inputs reflect saved changes immediately.
  const selectedLead = useMemo(
    () => (selectedLeadId ? leads.find((l) => l.id === selectedLeadId) : null),
    [leads, selectedLeadId],
  );

  // Bucket into tracks. Lead routes to a track only when intent AND stage agree.
  // Anything else falls into Intake so it remains visible and triageable.
  const buckets = useMemo(() => {
    const sale = [], rent = [], intake = [];
    for (const lead of activeLeads) {
      const stageMeta = STAGES[lead.stage];
      const stageIntent = stageMeta && stageMeta.intent;
      if (lead.intent === 'buyer' && stageIntent === 'buyer') sale.push(lead);
      else if (lead.intent === 'tenant' && stageIntent === 'tenant') rent.push(lead);
      else intake.push(lead);
    }
    return { sale, rent, intake };
  }, [activeLeads]);

  const updateStageMutation = useMutation({
    mutationFn: ({ id, newStage }) =>
      base44.entities.Lead.update(id, {
        stage: newStage,
        stage_entered_at: new Date().toISOString(),
      }),
    onMutate: async ({ id, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline-leads'] });
      const previous = queryClient.getQueryData(['pipeline-leads']);
      queryClient.setQueryData(['pipeline-leads'], (old) =>
        (old || []).map((l) =>
          l.id === id
            ? { ...l, stage: newStage, stage_entered_at: new Date().toISOString() }
            : l,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context && context.previous) {
        queryClient.setQueryData(['pipeline-leads'], context.previous);
      }
      toast.error('Failed to move lead — reverting.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    },
  });

  const handleStageChange = (payload) => updateStageMutation.mutate(payload);

  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader title="Pipeline" />
        <MobilePipeline />
      </div>
    );
  }

  // Management intelligence strip calculations
  const stalledLeads = activeLeads.filter(l => {
    if (!l.stage_entered_at) return false;
    const daysInStage = (Date.now() - new Date(l.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysInStage > 14;
  }).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const followUpsDueToday = activeLeads.filter(l => {
    if (!l.next_appointment_at) return false;
    const apptDate = new Date(l.next_appointment_at);
    return apptDate >= today && apptDate < tomorrow;
  }).length;

  const appointmentsScheduled = activeLeads.filter(l => l.next_appointment_at && new Date(l.next_appointment_at) >= tomorrow).length;

  const totalPipelineValue = activeLeads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
      }}
    >
      <div className="px-8 pb-4">
        <div className="grid grid-cols-4 gap-3">
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Stalled &gt;14d</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{stalledLeads}</p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Due Today</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{followUpsDueToday}</p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Scheduled</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{appointmentsScheduled}</p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Pipeline Value</span>
            </div>
            <p className="text-xl font-bold truncate" style={{ color: 'hsl(38 92% 50%)' }}>
              {totalPipelineValue >= 1_000_000 ? `AED ${(totalPipelineValue / 1_000_000).toFixed(1)}M` : totalPipelineValue >= 1_000 ? `AED ${(totalPipelineValue / 1_000).toFixed(0)}K` : `AED ${totalPipelineValue}`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 pt-0 pb-2">
        <PageHeader
          title="Pipeline"
          subtitle="Command center — drag leads between stages"
        >
          {lastSyncedAt && (
            <div className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <RefreshCw className="w-3 h-3" />
              Last synced: {formatRelativeShort(lastSyncedAt) || 'never'}
            </div>
          )}
          <Button
            size="sm"
            onClick={() => setShowAddLead(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> New Lead
          </Button>
          {projects.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-44 h-8 text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </PageHeader>
      </div>

      {/* Filter row */}
      <div className="px-8 pb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, email, phone…"
            className="pl-8 pr-7 py-2 text-xs rounded-lg w-52 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Agent filter — only visible to admins (non-admins can only see their own leads anyway) */}
        {permissions.view_all_pipeline && (
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          >
            <option value="">All Agents</option>
            {users.map(u => (
              <option key={u.id} value={u.email}>{u.full_name || u.email}</option>
            ))}
          </select>
        )}

        <select
          value={languageFilter}
          onChange={e => setLanguageFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        >
          <option value="">All Languages</option>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
          <option value="fr">French</option>
          <option value="ru">Russian</option>
          <option value="zh">Chinese</option>
          <option value="hi">Hindi</option>
          <option value="ur">Urdu</option>
          <option value="fa">Farsi</option>
        </select>

        <select
          value={assignmentFilter}
          onChange={e => setAssignmentFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        >
          <option value="">All Assignments</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>

        <select
          value={financeFilter}
          onChange={e => setFinanceFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        >
          <option value="">All Finance Types</option>
          <option value="cash">Cash</option>
          <option value="mortgage">Mortgage</option>
          <option value="pre_approved">Pre-approved</option>
          <option value="mixed">Mixed</option>
        </select>

        {(searchQuery || agentFilter || languageFilter || assignmentFilter || financeFilter) && (
          <button
            onClick={() => { setSearchQuery(''); setAgentFilter(''); setLanguageFilter(''); setAssignmentFilter(''); setFinanceFilter(''); }}
            className="text-xs px-2.5 py-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 px-8 mt-0">
        <TabsList
          className="self-start"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
          }}
        >
          <TabsTrigger value="sale" className="gap-1.5 text-xs font-semibold">
            Sale <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>({buckets.sale.length})</span>
          </TabsTrigger>
          <TabsTrigger value="rent" className="gap-1.5 text-xs font-semibold">
            Rent <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>({buckets.rent.length})</span>
          </TabsTrigger>
          <TabsTrigger value="intake" className="gap-1.5 text-xs font-semibold">
            Intake <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>({buckets.intake.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sale" className="flex-1 flex flex-col min-h-0 mt-4">
          {leadsLoading ? (
            <LoadingState />
          ) : (
            <PipelineBoard
              track="buyer"
              leads={buckets.sale}
              getListing={getListing}
              onLeadClick={(l) => setSelectedLeadId(l.id)}
              onStageChange={handleStageChange}
              users={users}
              onAssign={(id, email) => assignMutation.mutate({ id, email })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="rent" className="flex-1 flex flex-col min-h-0 mt-4">
          {leadsLoading ? (
            <LoadingState />
          ) : (
            <PipelineBoard
              track="tenant"
              leads={buckets.rent}
              getListing={getListing}
              onLeadClick={(l) => setSelectedLeadId(l.id)}
              onStageChange={handleStageChange}
              users={users}
              onAssign={(id, email) => assignMutation.mutate({ id, email })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="intake" className="flex-1 flex flex-col min-h-0 mt-4">
          {leadsLoading ? (
            <LoadingState />
          ) : (
            <PipelineBoard
              track="unknown"
              leads={buckets.intake}
              getListing={getListing}
              onLeadClick={(l) => setSelectedLeadId(l.id)}
              onStageChange={handleStageChange}
              users={users}
              onAssign={(id, email) => assignMutation.mutate({ id, email })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}
        </TabsContent>
      </Tabs>

      <AddLeadDialog open={showAddLead} onClose={() => setShowAddLead(false)} />

      {selectedLead && (
        <LeadDetailSheet
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      Loading pipeline…
    </div>
  );
}