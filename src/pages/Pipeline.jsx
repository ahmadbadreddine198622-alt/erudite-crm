import React, { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Filter, RefreshCw, TrendingUp, Calendar, Clock, DollarSign } from 'lucide-react';
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
      // Role-based filtering
      if (currentUser && !permissions.view_all_pipeline) {
        result = result.filter(l => l.assigned_agent_email === currentUser.email);
      }
      if (projectFilter !== 'all') result = result.filter(l => l.project_id === projectFilter);
      return result;
    },
    [leads, projectFilter, currentUser, permissions],
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