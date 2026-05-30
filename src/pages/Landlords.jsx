import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Plus, Filter, Upload, Clock, TrendingUp, DollarSign, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import KanbanBoard from '@/components/landlord/KanbanBoard';
import LandlordDetailPanel from '@/components/landlord/LandlordDetailPanel';
import AddLandlordDialog from '@/components/landlord/AddLandlordDialog';
import ImportOwnersDialog from '@/components/landlord/ImportOwnersDialog';

const STAGES = [
  'initial_contact',
  'price_discovery',
  'listing_commitment',
  'form_a_initiation',
  'form_a_signing',
  'owner_documents',
  'photos_videos',
  'photographer_scheduling',
  'listing_creation',
  'internal_verification',
  'listing_publication',
  'final_confirmation',
];

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery & Negotiation',
  listing_commitment: 'Listing Commitment Validation',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing — Critical Gate',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Photographer Scheduling',
  listing_creation: 'Listing Creation — Backend',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Landlord Confirmation',
};

export default function Landlords() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLandlordId, setSelectedLandlordId] = useState(searchParams.get('selected'));
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterArchetype, setFilterArchetype] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const queryClient = useQueryClient();

  // Sync URL ?selected=<id> with state, both ways
  useEffect(() => {
    const urlSelected = searchParams.get('selected');
    if (urlSelected && urlSelected !== selectedLandlordId) {
      setSelectedLandlordId(urlSelected);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedLandlordId && searchParams.get('selected') !== selectedLandlordId) {
      setSearchParams({ selected: selectedLandlordId }, { replace: true });
    } else if (!selectedLandlordId && searchParams.get('selected')) {
      const next = new URLSearchParams(searchParams);
      next.delete('selected');
      setSearchParams(next, { replace: true });
    }
  }, [selectedLandlordId]);

  // Fetch all landlords and projects
  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['landlords'],
    queryFn: () => base44.entities.Landlord.list('-updated_date', 500),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  // Find the selected landlord directly from the already-loaded list for instant open.
  // No separate async fetch needed — avoids the race where the Sheet never mounts
  // because selectedLandlord is undefined until the query resolves.
  const selectedLandlord = useMemo(
    () => landlords.find((l) => l.id === selectedLandlordId) || null,
    [landlords, selectedLandlordId],
  );

  // Group by stage
  const stageGroups = useMemo(() => {
    const grouped = {};
    STAGES.forEach(stage => {
      grouped[stage] = landlords.filter(l => l.stage === stage);
    });
    return grouped;
  }, [landlords]);

  // Apply filters
  const filteredGroups = useMemo(() => {
    const result = {};
    STAGES.forEach(stage => {
      result[stage] = stageGroups[stage]
        .filter(l => !filterAgent || l.assigned_agent_email === filterAgent)
        .filter(l => !filterArchetype || l.landlord_archetype === filterArchetype)
        .filter(l => !filterProject || l.project_id === filterProject || (filterProject === 'unassigned' && !l.project_id));
    });
    return result;
  }, [stageGroups, filterAgent, filterArchetype, filterProject]);

  // Calculate metrics
  const totalPipeline = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const mandateCount = landlords.filter(l => l.mandate_status === 'form_a_signed').length;
  const now = new Date();
  const mandatesThisMonth = landlords.filter(l => {
    if (!l.mandate_signed_at) return false;
    const signedDate = new Date(l.mandate_signed_at);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return signedDate >= monthAgo;
  }).length;
  const avgDaysToFormA = (() => {
    const withFormA = landlords.filter(l => l.mandate_status === 'form_a_signed' && l.created_date && l.mandate_signed_at);
    if (withFormA.length === 0) return 0;
    const totalDays = withFormA.reduce((sum, l) => {
      const created = new Date(l.created_date).getTime();
      const signed = new Date(l.mandate_signed_at).getTime();
      return sum + ((signed - created) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / withFormA.length);
  })();
  const stalledLeads = landlords.filter(l => {
    if (!l.created_date) return false;
    const daysSinceCreation = (now - new Date(l.created_date).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation > 21 && l.stage !== 'listing_publication';
  }).length;

  const handleLandlordCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['landlords'] });
    setShowNewDialog(false);
    toast.success('Landlord added successfully');
  };

  // Persist drag-and-drop stage moves with an optimistic cache update.
  const updateStageMutation = useMutation({
    mutationFn: ({ id, newStage }) =>
      base44.entities.Landlord.update(id, {
        stage: newStage,
        stage_entered_at: new Date().toISOString(),
      }),
    onMutate: async ({ id, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ['landlords'] });
      const previous = queryClient.getQueryData(['landlords']);
      queryClient.setQueryData(['landlords'], (old) =>
        (old || []).map((l) =>
          l.id === id
            ? { ...l, stage: newStage, stage_entered_at: new Date().toISOString() }
            : l,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['landlords'], context.previous);
      }
      toast.error('Failed to move landlord — reverting.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
    },
  });

  const handleStageChange = (payload) => updateStageMutation.mutate(payload);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading Landlord Pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - always visible */}
      <div className="px-8 pt-8 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Landlord Pipeline</h1>
              <p className="text-xs text-muted-foreground">Agent's A-to-Z Mandate Acquisition Engine</p>
            </div>
            {/* Action buttons next to title - always visible */}
            <div className="flex gap-2 ml-6">
              <Button variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import Owners
              </Button>
              <Button onClick={() => setShowNewDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Landlord
              </Button>
            </div>
          </div>
        </div>

        {/* Management Intelligence Strip */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Commission Pipeline</span>
            </div>
            <p className="text-2xl font-bold truncate" style={{ color: 'hsl(38 92% 50%)' }}>
              {totalPipeline >= 1_000_000 ? `AED ${(totalPipeline / 1_000_000).toFixed(1)}M` : totalPipeline >= 1_000 ? `AED ${(totalPipeline / 1_000).toFixed(0)}K` : `AED ${totalPipeline}`}
            </p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Mandates (30d)</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{mandatesThisMonth}</p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Avg Days to Form A</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{avgDaysToFormA}d</p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Stalled &gt;21d</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{stalledLeads}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Filter by agent..."
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="max-w-xs text-xs"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          />
          <select
            value={filterArchetype}
            onChange={(e) => setFilterArchetype(e.target.value)}
            className="px-3 py-2 text-xs rounded-md"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <option value="">All Archetypes</option>
            <option value="professional_investor">Professional Investor</option>
            <option value="individual_end_user_relocating">Individual Relocating</option>
            <option value="first_time_seller">First Time Seller</option>
            <option value="portfolio_optimizer">Portfolio Optimizer</option>
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2 text-xs rounded-md"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Kanban Board - scrolls horizontally within bounded container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 pb-4" style={{ minHeight: '420px' }}>
        <KanbanBoard
          stages={STAGES}
          stageLabels={STAGE_LABELS}
          stageGroups={filteredGroups}
          selectedLandlordId={selectedLandlordId}
          onSelectLandlord={setSelectedLandlordId}
          onStageChange={handleStageChange}
        />
      </div>

      {/* Detail Panel */}
      {selectedLandlord && (
        <LandlordDetailPanel
          landlord={selectedLandlord}
          open={!!selectedLandlord}
          onClose={() => setSelectedLandlordId(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['landlord', selectedLandlordId] });
            queryClient.invalidateQueries({ queryKey: ['landlords'] });
          }}
        />
      )}

      {/* Dialogs */}
      <AddLandlordDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSuccess={handleLandlordCreated}
      />
      <ImportOwnersDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
    </div>
  );
}