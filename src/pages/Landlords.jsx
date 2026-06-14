import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Plus, Filter, Upload, Clock, TrendingUp, DollarSign, FileCheck, Video, UserCheck, Trash2, Users, Search, X, FileSignature, FileText } from 'lucide-react';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';
import ProjectIntelStrip from '@/components/landlord/ProjectIntelStrip';
import ProjectSelectorWithUpload from '@/components/landlord/ProjectSelectorWithUpload';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import KanbanBoard from '@/components/landlord/KanbanBoard';
import LandlordDetailPanel from '@/components/landlord/LandlordDetailPanel';
import AddLandlordDialog from '@/components/landlord/AddLandlordDialog';
import ImportOwnersDialog from '@/components/landlord/ImportOwnersDialog';
import ScheduleVirtualViewingDialog from '@/components/shared/ScheduleVirtualViewingDialog';
import FormAUploadDialog from '@/components/landlord/FormAUploadDialog';
import MarketReportUploadDialog from '@/components/landlord/MarketReportUploadDialog';

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
  'marketing_agents',
  'marketing_network',
  'open_house',
  'client_blast',
  'deal_closed',
];

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery & Negotiation',
  listing_commitment: 'Listing Commitment Validation',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing — Critical Gate',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Documentation / verification by admin',
  listing_creation: 'Listing Creation — Backend',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Landlord Confirmation',
  marketing_agents: 'Marketing — Agents',
  marketing_network: 'Marketing — Network',
  open_house: 'Open House',
  client_blast: 'Client Blast',
  deal_closed: 'Deal Closed',
};

export default function Landlords() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLandlordId, setSelectedLandlordId] = useState(searchParams.get('selected'));
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showVirtualViewing, setShowVirtualViewing] = useState(false);
  const [showFormADialog, setShowFormADialog] = useState(false);
  const [showMarketReportDialog, setShowMarketReportDialog] = useState(false);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterArchetype, setFilterArchetype] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [filterLayout, setFilterLayout] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAgentEmail, setBulkAgentEmail] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const queryClient = useQueryClient();
  const { getPhotoForPhone, isLoading: photosLoading } = usePhotoByPhone();

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
    queryFn: () => base44.entities.Landlord.list('-updated_date', 1000),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: landlordProperties = [] } = useQuery({
    queryKey: ['landlord_properties'],
    queryFn: () => base44.entities.LandlordProperty.list(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: photographyTasks = [] } = useQuery({
    queryKey: ['photography_tasks'],
    queryFn: () => base44.entities.PhotographyTask.list(),
  });

  // Derive floor number from a unit_no string
  // e.g. "710" → 7, "2006" → 20, "1410" → 14, "P2-1001" → 10
  const deriveFloor = (unit_no) => {
    if (!unit_no) return null;
    const s = String(unit_no).trim();
    // Handle prefix like "P2-1001" → take part after last dash
    const part = s.includes('-') ? s.split('-').pop() : s;
    const n = parseInt(part, 10);
    if (isNaN(n)) return null;
    const digits = String(n).length;
    if (digits <= 2) return n; // bare floor number
    if (digits === 3) return Math.floor(n / 100); // 710 → 7
    if (digits >= 4) return Math.floor(n / 100); // 2006 → 20, 1410 → 14
    return null;
  };

  const floorBucket = (floor) => {
    if (floor === null) return null;
    if (floor <= 10) return '1-10';
    if (floor <= 20) return '11-20';
    return '21+';
  };

  // Build a map: landlord_id → { floor, layout }
  const landlordPropertyMap = useMemo(() => {
    const map = {};
    landlordProperties.forEach(lp => {
      if (!lp.landlord_id) return;
      const prop = properties.find(p => p.id === lp.property_id);
      if (!prop) return;
      const floor = deriveFloor(prop.unit_no);
      // Derive layout from bedrooms + property_type
      let layout = null;
      if (prop.property_type === 'studio') {
        layout = 'Studio';
      } else if (prop.bedrooms === 1) {
        layout = '1BR';
      } else if (prop.bedrooms === 2) {
        layout = '2BR';
      } else if (prop.bedrooms === 3) {
        layout = '3BR';
      } else if (prop.bedrooms >= 4) {
        layout = '4BR+';
      }
      // If multiple properties, keep the first one found
      if (!map[lp.landlord_id]) {
        map[lp.landlord_id] = { floor, layout };
      }
    });
    return map;
  }, [landlordProperties, properties]);

  // Find the selected project from the already-loaded projects list
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === filterProject) || null,
    [projects, filterProject],
  );

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
    const q = searchQuery.trim().toLowerCase();
    const result = {};
    STAGES.forEach(stage => {
      result[stage] = stageGroups[stage]
        .filter(l => !filterAgent || l.assigned_agent_email === filterAgent)
        .filter(l => !filterArchetype || l.landlord_archetype === filterArchetype)
        .filter(l => !filterProject || l.project_id === filterProject || (filterProject === 'unassigned' && !l.project_id))
        .filter(l => !filterLanguage || l.preferred_language === filterLanguage)
        .filter(l => {
          if (!filterAssignment) return true;
          if (filterAssignment === 'unassigned') return !l.assigned_agent_email;
          if (filterAssignment === 'assigned') return !!l.assigned_agent_email;
          return true;
        })
        .filter(l => {
          if (!q) return true;
          const name = (l.full_name_en || l.full_name || '').toLowerCase();
          const unit = (l.unit_reference || '').toLowerCase();
          const phone = (l.phone || '').toLowerCase();
          const email = (l.email || '').toLowerCase();
          const project = (l.project_name || '').toLowerCase();
          const notes = (l.ai_rolling_summary || '').toLowerCase();
          return name.includes(q) || unit.includes(q) || phone.includes(q) || email.includes(q) || project.includes(q) || notes.includes(q);
        })
        .filter(l => {
          if (!filterFloor) return true;
          const info = landlordPropertyMap[l.id];
          const bucket = info ? floorBucket(info.floor) : null;
          return bucket === filterFloor;
        })
        .filter(l => {
          if (!filterLayout) return true;
          const info = landlordPropertyMap[l.id];
          return info?.layout === filterLayout;
        });
    });
    return result;
  }, [stageGroups, filterAgent, filterArchetype, filterProject, filterFloor, filterLayout, filterLanguage, filterAssignment, searchQuery, landlordPropertyMap]);

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

  // Flatten all filtered landlords for select-all
  const allFilteredLandlords = useMemo(() => Object.values(filteredGroups).flat(), [filteredGroups]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allFilteredLandlords.length && allFilteredLandlords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredLandlords.map(l => l.id)));
    }
  };

  const bulkAssignMutation = useMutation({
    mutationFn: async (agentEmail) => {
      await Promise.all([...selectedIds].map(id => base44.entities.Landlord.update(id, { assigned_agent_email: agentEmail })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      toast.success(`Assigned ${selectedIds.size} landlord(s)`);
      setSelectedIds(new Set());
      setBulkAgentEmail('');
    },
    onError: (e) => toast.error('Bulk assign failed: ' + e.message),
  });

  // Bulk delete mutation - deletes landlords AND their linked LandlordProperty records
  const bulkDeleteMutation = useMutation({
    mutationFn: async (idsToDelete) => {
      // First, find and delete all linked LandlordProperty records
      const allLandlordProperties = await base44.entities.LandlordProperty.list();
      const propsToDelete = allLandlordProperties.filter(lp => idsToDelete.includes(lp.landlord_id));
      if (propsToDelete.length > 0) {
        await Promise.all(propsToDelete.map(lp => base44.entities.LandlordProperty.delete(lp.id)));
      }
      // Then delete the landlords
      await Promise.all(idsToDelete.map(id => base44.entities.Landlord.delete(id)));
      return idsToDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      toast.success(`Deleted ${count} landlord(s)`);
      setSelectedIds(new Set());
      setDeleteConfirmText('');
      setShowDeleteDialog(false);
    },
    onError: (e) => toast.error('Bulk delete failed: ' + e.message),
  });

  const singleAssignMutation = useMutation({
    mutationFn: ({ id, agentEmail }) => base44.entities.Landlord.update(id, { assigned_agent_email: agentEmail }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['landlords'] }),
    onError: (e) => toast.error('Assign failed: ' + e.message),
  });

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
              {/* Project label - derived from visible landlords */}
              {(() => {
                const projectNames = allFilteredLandlords
                  .map(l => l.project_name)
                  .filter(name => name && name.trim() !== '');
                const uniqueProjects = [...new Set(projectNames)];
                const projectLabel = uniqueProjects.length === 1
                  ? uniqueProjects[0]
                  : uniqueProjects.length > 1
                    ? `${uniqueProjects.length} Projects`
                    : 'No Project';
                return (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Project:</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md"
                      style={{
                        background: 'hsl(38 92% 50%)',
                        color: 'hsl(222 47% 11%)',
                      }}
                    >
                      {projectLabel}
                    </span>
                  </div>
                );
              })()}
            </div>
            {/* Action buttons next to title - always visible */}
            <div className="flex gap-2 ml-6">
              <Button variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import Owners
              </Button>
              <Button variant="outline" onClick={() => setShowVirtualViewing(true)} className="gap-2">
                <Video className="w-4 h-4" />
                Virtual Viewing
              </Button>
              <Button variant="outline" onClick={() => setShowFormADialog(true)} className="gap-2">
                <FileSignature className="w-4 h-4 text-amber-400" />
                Upload Form A
              </Button>
              <Button variant="outline" onClick={() => setShowMarketReportDialog(true)} className="gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Market Report
              </Button>
              <Button onClick={() => setShowNewDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Landlord
              </Button>
              {/* Project thumbnail — shown when a single project with image is selected */}
              {selectedProject?.image_url && (
                <img
                  src={selectedProject.image_url}
                  alt={selectedProject.name}
                  className="w-[70px] h-[70px] rounded-lg object-cover border border-white/20 ml-auto"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
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
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Form A Signed</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{mandateCount}</p>
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

        {/* Project Intelligence Strip — shown when project filter active */}
        {filterProject && filterProject !== 'unassigned' && (
          <ProjectIntelStrip
            landlords={allFilteredLandlords}
            landlordPropertyMap={landlordPropertyMap}
            properties={properties}
            landlordProperties={landlordProperties}
          />
        )}

        {/* Search bar */}
        <div className="relative mb-2 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, unit number, phone, email, project…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-xs rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.9)', outline: 'none' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters row + inline bulk toolbar */}
        <div className="flex gap-2 flex-wrap items-center">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allFilteredLandlords.length > 0 && selectedIds.size === allFilteredLandlords.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            Select all ({allFilteredLandlords.length})
          </label>

          {selectedIds.size > 0 ? (
            /* Bulk assign toolbar — appears inline when cards are selected */
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}
            >
              <UserCheck className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs font-semibold text-accent whitespace-nowrap">{selectedIds.size} selected</span>
              <select
                value={bulkAgentEmail}
                onChange={e => setBulkAgentEmail(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)', minWidth: 130 }}
              >
                <option value="">Select agent…</option>
                {users.map(u => (
                  <option key={u.id} value={u.email}>{u.full_name || u.email}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!bulkAgentEmail || bulkAssignMutation.isPending}
                onClick={() => bulkAssignMutation.mutate(bulkAgentEmail)}
                className="h-7 px-3 text-xs gap-1 whitespace-nowrap"
              >
                {bulkAssignMutation.isPending ? 'Assigning…' : 'Assign'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => setShowDeleteDialog(true)}
                className="h-7 px-3 text-xs gap-1 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs opacity-60 hover:opacity-100 transition-opacity px-1"
              >
                ✕
              </button>
            </div>
          ) : (
            /* Normal filters — only shown when nothing selected */
            <>
              <Input
                placeholder="Filter by agent..."
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="max-w-xs text-xs"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
              <select
                value={filterArchetype}
                onChange={(e) => setFilterArchetype(e.target.value)}
                className="px-3 py-2 text-xs rounded-md"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                <option value="">All Archetypes</option>
                <option value="professional_investor">Professional Investor</option>
                <option value="individual_end_user_relocating">Individual Relocating</option>
                <option value="first_time_seller">First Time Seller</option>
                <option value="portfolio_optimizer">Portfolio Optimizer</option>
              </select>
              <ProjectSelectorWithUpload
                value={filterProject}
                onChange={(val) => setFilterProject(val || '')}
                projects={projects}
              />

              {/* Floor filter */}
              <select
                value={filterFloor}
                onChange={(e) => setFilterFloor(e.target.value)}
                className="px-3 py-2 text-xs rounded-md"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                <option value="">All Floors</option>
                <option value="1-10">Floors 1–10</option>
                <option value="11-20">Floors 11–20</option>
                <option value="21+">Floors 21+</option>
              </select>

              {/* Layout filter */}
              <select
                value={filterLayout}
                onChange={(e) => setFilterLayout(e.target.value)}
                className="px-3 py-2 text-xs rounded-md"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                <option value="">All Layouts</option>
                <option value="Studio">Studio</option>
                <option value="1BR">1BR</option>
                <option value="2BR">2BR</option>
                <option value="3BR">3BR</option>
                <option value="4BR+">4BR+</option>
              </select>

              {/* Language filter */}
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                className="px-3 py-2 text-xs rounded-md"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                <option value="">All Languages</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="ru">Russian</option>
                <option value="zh">Chinese</option>
                <option value="hi">Hindi</option>
              </select>

              {/* Assignment status filter */}
              <select
                value={filterAssignment}
                onChange={(e) => setFilterAssignment(e.target.value)}
                className="px-3 py-2 text-xs rounded-md"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
              >
                <option value="">All Assignments</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
              </select>

              {/* Result count badge */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'hsl(38 92% 50%)' }}
              >
                <Users className="w-3.5 h-3.5" />
                {allFilteredLandlords.length} landlord{allFilteredLandlords.length !== 1 ? 's' : ''}
              </div>

              {/* Clear filters button — only shown when any filter is active */}
              {(filterFloor || filterLayout || filterLanguage || filterAssignment || searchQuery) && (
                <button
                  onClick={() => { setFilterFloor(''); setFilterLayout(''); setFilterLanguage(''); setFilterAssignment(''); setSearchQuery(''); }}
                  className="text-xs px-2.5 py-1.5 rounded-lg transition-opacity opacity-70 hover:opacity-100"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
                >
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>

      </div>

      {/* Kanban Board - scrolls horizontally within bounded container */}
      <div className="flex-1 overflow-x-auto px-8 pb-4" style={{ minHeight: '420px' }}>
        <KanbanBoard
          stages={STAGES}
          stageLabels={STAGE_LABELS}
          stageGroups={filteredGroups}
          selectedLandlordId={selectedLandlordId}
          onSelectLandlord={setSelectedLandlordId}
          onStageChange={handleStageChange}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          users={users}
          onSingleAssign={(id, email) => singleAssignMutation.mutate({ id, agentEmail: email })}
          photographyTasks={photographyTasks}
          getPhotoForPhone={getPhotoForPhone}
        />
      </div>

      {/* Detail Panel */}
      {selectedLandlord && (
        <LandlordDetailPanel fullScreenOnMobile={true}
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
      <ScheduleVirtualViewingDialog
        open={showVirtualViewing}
        onClose={() => setShowVirtualViewing(false)}
        prefill={selectedLandlord ? {
          landlord_name:  selectedLandlord.full_name_en,
          landlord_email: selectedLandlord.email,
          landlord_phone: selectedLandlord.phone,
        } : {}}
      />
      <FormAUploadDialog
        open={showFormADialog}
        onClose={() => setShowFormADialog(false)}
        onSuccess={() => {
          setShowFormADialog(false);
          queryClient.invalidateQueries({ queryKey: ['landlords'] });
        }}
      />
      <MarketReportUploadDialog
        open={showMarketReportDialog}
        onClose={() => setShowMarketReportDialog(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['landlords'] });
          queryClient.invalidateQueries({ queryKey: ['landlord_properties'] });
        }}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {selectedIds.size} Landlord(s)?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>This action cannot be undone. This will permanently delete {selectedIds.size} selected landlord record(s) and all linked property associations.</p>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="confirm-delete"
                  checked={deleteConfirmText === 'DELETE'}
                  onChange={(e) => setDeleteConfirmText(e.target.checked ? 'DELETE' : '')}
                  className="w-4 h-4 accent-destructive rounded"
                />
                <label htmlFor="confirm-delete" className="text-sm font-medium cursor-pointer select-none">
                  I confirm that I want to delete these {selectedIds.size} landlord(s)
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirmText !== 'DELETE' || bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate([...selectedIds])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {bulkDeleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}