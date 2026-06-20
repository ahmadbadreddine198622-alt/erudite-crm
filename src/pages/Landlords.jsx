import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Plus, Filter, Upload, Clock, TrendingUp, DollarSign, FileCheck, Video, UserCheck, Trash2, Users, Search, X, FileSignature, FileText, ListOrdered } from 'lucide-react';
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
import AddLandlordDialog from '@/components/landlord/AddLandlordDialog';
import ImportOwnersDialog from '@/components/landlord/ImportOwnersDialog';
import ScheduleVirtualViewingDialog from '@/components/shared/ScheduleVirtualViewingDialog';
import FormAUploadDialog from '@/components/landlord/FormAUploadDialog';
import MarketReportUploadDialog from '@/components/landlord/MarketReportUploadDialog';
import { useCurrentUser } from '@/lib/useCurrentUser';
import LockedLeadQueue from '@/components/outreach/LockedLeadQueue';

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
  const { user: currentUser, permissions, loading: userLoading } = useCurrentUser();
  const safePermissions = permissions || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showVirtualViewing, setShowVirtualViewing] = useState(false);
  const [showFormADialog, setShowFormADialog] = useState(false);
  const [showMarketReportDialog, setShowMarketReportDialog] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
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
  const deriveFloor = (unit_no) => {
    if (!unit_no) return null;
    const s = String(unit_no).trim();
    const part = s.includes('-') ? s.split('-').pop() : s;
    const n = parseInt(part, 10);
    if (isNaN(n)) return null;
    const digits = String(n).length;
    if (digits <= 2) return n;
    if (digits === 3) return Math.floor(n / 100);
    if (digits >= 4) return Math.floor(n / 100);
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
      if (!map[lp.landlord_id]) {
        map[lp.landlord_id] = { floor, layout };
      }
    });
    return map;
  }, [landlordProperties, properties]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === filterProject) || null,
    [projects, filterProject],
  );

  // Role-based isolation
  const visibleLandlords = useMemo(() => {
    if (!currentUser || safePermissions.view_all_landlords) return landlords;
    return landlords.filter(l => l.assigned_agent_email && l.assigned_agent_email === currentUser.email);
  }, [landlords, currentUser, safePermissions.view_all_landlords]);

  // Group by stage
  const stageGroups = useMemo(() => {
    const grouped = {};
    STAGES.forEach(stage => {
      grouped[stage] = visibleLandlords.filter(l => l.stage === stage);
    });
    return grouped;
  }, [visibleLandlords]);

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
  const totalPipeline = visibleLandlords.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const mandateCount = visibleLandlords.filter(l => l.mandate_status === 'form_a_signed').length;
  const now = new Date();
  const mandatesThisMonth = visibleLandlords.filter(l => {
    if (!l.mandate_signed_at) return false;
    const signedDate = new Date(l.mandate_signed_at);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return signedDate >= monthAgo;
  }).length;
  const avgDaysToFormA = (() => {
    const withFormA = visibleLandlords.filter(l => l.mandate_status === 'form_a_signed' && l.created_date && l.mandate_signed_at);
    if (withFormA.length === 0) return 0;
    const totalDays = withFormA.reduce((sum, l) => {
      const created = new Date(l.created_date).getTime();
      const signed = new Date(l.mandate_signed_at).getTime();
      return sum + ((signed - created) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / withFormA.length);
  })();
  const stalledLeads = visibleLandlords.filter(l => {
    if (!l.created_date) return false;
    const daysSinceCreation = (now - new Date(l.created_date).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation > 21 && l.stage !== 'listing_publication';
  }).length;

  const handleLandlordCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['landlords'] });
    setShowNewDialog(false);
    toast.success('Landlord added successfully');
  };

  const handleSelectLandlord = (id) => {
    navigate(`/landlord/${id}`);
  };

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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (idsToDelete) => {
      const allLandlordProperties = await base44.entities.LandlordProperty.list();
      const propsToDelete = allLandlordProperties.filter(lp => idsToDelete.includes(lp.landlord_id));
      if (propsToDelete.length > 0) {
        await Promise.all(propsToDelete.map(lp => base44.entities.LandlordProperty.delete(lp.id)));
      }
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

  if (userLoading || !currentUser || isLoading) {
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
    <div className="page-root">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Building2 className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold page-title">Landlord Pipeline</h1>
              <p className="page-subtitle mt-0.5">Agent's A-to-Z Mandate Acquisition Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2 h-9">
              <Upload className="w-4 h-4" />
              <span className="hidden lg:inline">Import Owners</span>
            </Button>
            <Button variant="outline" onClick={() => setShowVirtualViewing(true)} className="gap-2 h-9">
              <Video className="w-4 h-4" />
              <span className="hidden lg:inline">Virtual Viewing</span>
            </Button>
            <Button variant="outline" onClick={() => setShowFormADialog(true)} className="gap-2 h-9">
              <FileSignature className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline">Upload Form A</span>
            </Button>
            <Button variant="outline" onClick={() => setShowMarketReportDialog(true)} className="gap-2 h-9">
              <FileText className="w-4 h-4 text-purple-400" />
              <span className="hidden lg:inline">Market Report</span>
            </Button>
            <Button onClick={() => setShowNewDialog(true)} className="gap-2 h-9"
              style={{ background: 'linear-gradient(135deg, hsl(38 92% 50%), hsl(38 92% 45%))', color: 'hsl(222 47% 11%)' }}>
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">New Landlord</span>
            </Button>
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

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Commission Pipeline</span>
            </div>
            <p className="text-2xl font-bold truncate" style={{ color: 'hsl(38 92% 50%)' }}>
              {totalPipeline >= 1_000_000 ? `AED ${(totalPipeline / 1_000_000).toFixed(1)}M` : totalPipeline >= 1_000 ? `AED ${(totalPipeline / 1_000).toFixed(0)}K` : `AED ${totalPipeline}`}
            </p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <FileCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Form A Signed</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{mandateCount}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Avg Days to Form A</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{avgDaysToFormA}d</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Stalled &gt;21d</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{stalledLeads}</p>
          </div>
        </div>

        {/* Lead Queue */}
        <div className="mb-4">
          <button
            onClick={() => setShowQueuePanel(p => !p)}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: showQueuePanel ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: showQueuePanel ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.55)' }}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            My Lead Queue
          </button>
          {showQueuePanel && (
            <div className="mt-2 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <LockedLeadQueue onSelectLandlord={(id) => navigate(`/landlord/${id}`)} />
            </div>
          )}
        </div>

        {/* Project Intelligence */}
        {filterProject && filterProject !== 'unassigned' && (
          <ProjectIntelStrip
            landlords={allFilteredLandlords}
            landlordPropertyMap={landlordPropertyMap}
            properties={properties}
            landlordProperties={landlordProperties}
          />
        )}

        {/* Search */}
        <div className="relative mb-3 max-w-md">
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

        {/* Filters + Bulk Actions */}
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
            <>
              {safePermissions.view_all_landlords && users.length > 0 && (
                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="px-3 py-2 text-xs rounded-md"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', minWidth: 140 }}
                >
                  <option value="">All Agents</option>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.full_name || u.email}</option>
                  ))}
                </select>
              )}
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
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'hsl(38 92% 50%)' }}
              >
                <Users className="w-3.5 h-3.5" />
                {allFilteredLandlords.length} landlord{allFilteredLandlords.length !== 1 ? 's' : ''}
              </div>
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

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4" style={{ minHeight: '420px' }}>
        <KanbanBoard
          stages={STAGES}
          stageLabels={STAGE_LABELS}
          stageGroups={filteredGroups}
          selectedLandlordId={null}
          onSelectLandlord={(id) => navigate(`/landlord/${id}`)}
          onStageChange={handleStageChange}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          users={users}
          onSingleAssign={(id, email) => singleAssignMutation.mutate({ id, agentEmail: email })}
          photographyTasks={photographyTasks}
          getPhotoForPhone={getPhotoForPhone}
        />
      </div>

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
        prefill={{}}
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

      {/* Bulk Delete Dialog */}
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