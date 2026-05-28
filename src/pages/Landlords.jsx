import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Plus, Filter, Upload } from 'lucide-react';
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

  // Fetch all landlords
  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ['landlords'],
    queryFn: () => base44.entities.Landlord.list('-updated_date', 500),
  });

  // Fetch selected landlord details
  const { data: selectedLandlord } = useQuery({
    queryKey: ['landlord', selectedLandlordId],
    queryFn: () => base44.entities.Landlord.get(selectedLandlordId),
    enabled: !!selectedLandlordId,
  });

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
        .filter(l => !filterArchetype || l.landlord_archetype === filterArchetype);
    });
    return result;
  }, [stageGroups, filterAgent, filterArchetype]);

  // Calculate metrics
  const totalPipeline = landlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const mandateCount = landlords.filter(l => l.mandate_status === 'form_a_signed').length;

  const handleLandlordCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['landlords'] });
    setShowNewDialog(false);
    toast.success('Landlord added successfully');
  };

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
    <div className="flex h-full bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Landlord Pipeline</h1>
                <p className="text-xs text-muted-foreground">Agent's A-to-Z Mandate Acquisition Engine</p>
              </div>
            </div>
            <div className="flex gap-2">
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

          {/* Metrics Bar */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Active</p>
              <p className="text-lg font-semibold">{landlords.length}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Pipeline Value</p>
              <p className="text-lg font-semibold">AED {(totalPipeline / 1000000).toFixed(1)}M</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Mandates Signed</p>
              <p className="text-lg font-semibold">{mandateCount}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">SLA Breaches</p>
              <p className="text-lg font-semibold text-destructive">0</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Input
              placeholder="Filter by agent..."
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="max-w-xs text-xs"
            />
            <select
              value={filterArchetype}
              onChange={(e) => setFilterArchetype(e.target.value)}
              className="px-3 py-2 text-xs border border-input rounded-md"
            >
              <option value="">All Archetypes</option>
              <option value="professional_investor">Professional Investor</option>
              <option value="individual_end_user_relocating">Individual Relocating</option>
              <option value="first_time_seller">First Time Seller</option>
              <option value="portfolio_optimizer">Portfolio Optimizer</option>
            </select>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto p-4">
          <KanbanBoard
            stages={STAGES}
            stageLabels={STAGE_LABELS}
            stageGroups={filteredGroups}
            selectedLandlordId={selectedLandlordId}
            onSelectLandlord={setSelectedLandlordId}
          />
        </div>
      </div>

      {/* Detail Panel */}
      {selectedLandlord && (
        <LandlordDetailPanel
          landlord={selectedLandlord}
          onClose={() => setSelectedLandlordId(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['landlord', selectedLandlordId] });
            queryClient.invalidateQueries({ queryKey: ['landlords'] });
          }}
        />
      )}

      {/* Add Landlord Dialog */}
      <AddLandlordDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSuccess={handleLandlordCreated}
      />

      {/* Import Owners Dialog */}
      <ImportOwnersDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
    </div>
  );
}