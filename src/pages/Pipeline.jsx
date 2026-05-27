import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import PipelineBoard from '@/components/pipeline/PipelineBoard';
import LeadDetailSheet from '@/components/leads/LeadDetailSheet';
import MobilePipeline from '@/components/mobile/MobilePipeline';
import { useIsMobile } from '@/hooks/use-mobile';
import { STAGES } from '@/lib/pipeline';

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
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeTab, setActiveTab] = useState('sale');

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: () => base44.entities.Lead.list('-stage_entered_at', 5000),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['pipeline-listings'],
    queryFn: () => base44.entities.PFListing.list('-updated_date', 5000),
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

  // Active leads (defensive: include unset status so leads from older code paths still render)
  const activeLeads = useMemo(
    () => leads.filter((l) => !l.status || l.status === 'active'),
    [leads],
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

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="px-8 pt-8 pb-2">
        <PageHeader
          title="Pipeline"
          subtitle="Two-track flow — drag leads between stages"
        >
          {lastSyncedAt && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              Last synced: {formatRelativeShort(lastSyncedAt) || 'never'}
            </div>
          )}
          <Button size="sm" variant="outline" disabled title="Filters coming soon">
            <Filter className="w-4 h-4 mr-1" /> Filters
          </Button>
        </PageHeader>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 px-8">
        <TabsList className="self-start">
          <TabsTrigger value="sale" className="gap-1.5">
            Sale <span className="text-xs text-muted-foreground">({buckets.sale.length})</span>
          </TabsTrigger>
          <TabsTrigger value="rent" className="gap-1.5">
            Rent <span className="text-xs text-muted-foreground">({buckets.rent.length})</span>
          </TabsTrigger>
          <TabsTrigger value="intake" className="gap-1.5">
            Intake <span className="text-xs text-muted-foreground">({buckets.intake.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sale" className="flex-1 flex flex-col min-h-0 mt-3">
          {leadsLoading ? (
            <LoadingState />
          ) : (
            <PipelineBoard
              track="buyer"
              leads={buckets.sale}
              getListing={getListing}
              onLeadClick={setSelectedLead}
              onStageChange={handleStageChange}
            />
          )}
        </TabsContent>

        <TabsContent value="rent" className="flex-1 flex flex-col min-h-0 mt-3">
          {leadsLoading ? (
            <LoadingState />
          ) : (
            <PipelineBoard
              track="tenant"
              leads={buckets.rent}
              getListing={getListing}
              onLeadClick={setSelectedLead}
              onStageChange={handleStageChange}
            />
          )}
        </TabsContent>

        <TabsContent value="intake" className="flex-1 flex flex-col min-h-0 mt-3">
          {leadsLoading ? (
            <LoadingState />
          ) : (
            <PipelineBoard
              track="unknown"
              leads={buckets.intake}
              getListing={getListing}
              onLeadClick={setSelectedLead}
              onStageChange={handleStageChange}
            />
          )}
        </TabsContent>
      </Tabs>

      {selectedLead && (
        <LeadDetailSheet
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
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
