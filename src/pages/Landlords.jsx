import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Plus, Upload, DollarSign, Video, UserCheck, Trash2, Users, Search, X, FileSignature, FileText, ListOrdered, KeyRound, ChevronDown, Database } from 'lucide-react';
import { PB, champagneInk } from '@/lib/pbTokens';
import AuroraPulseChips from '@/components/landlord/AuroraPulseChips';
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
import HandoverUpcomingDialog from '@/components/landlord/HandoverUpcomingDialog';
import { useCurrentUser } from '@/lib/useCurrentUser';
import LockedLeadQueue from '@/components/outreach/LockedLeadQueue';

// Lit-display-case palette tokens (presentation only — leave data / logic / enum keys untouched)
const LDC = {
  bodyBg: 'linear-gradient(165deg,#0a1020 0%,#080c16 46%,#06080f 100%)',
  gold:   '#c9a24b',
  glite:  '#e3c06a',
  gdeep:  '#a07d2e',
  blue:   '#5a93e0',
  blite:  '#87b2f0',
  green:  '#3fb98a',
  grlite: '#7fdcb4',
  ink:    '#e8ecf6',
  slate:  '#8b96b0',
  dim:    '#5f6a85',
  periwinkle: '#9cc0f0',
  accent:     '#c4b1ff',   // violet — media/video
  cardBg: 'linear-gradient(180deg,rgba(255,255,255,.032) 0%,rgba(255,255,255,.007) 100%)',
  cardBr: '1px solid rgba(255,255,255,.08)',
  cardSh: '0 16px 34px -22px rgba(0,0,0,.85)',
  cardGl: 'inset 0 1px 0 rgba(255,255,255,.11), inset 0 -18px 32px -28px rgba(0,0,0,.55)',
  rr13:   '13px',
  rr18:   '18px',
};

// ── Ghost header controls — one uniform hairline language for the Private Bank × Light bar.
// Presentation only; they forward onClick/onChange/value exactly like the controls they replace.
function GhostButton({ onClick, icon: Icon, label, active, showLabel = true }) {
  const [h, setH] = useState(false);
  const style = {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    borderRadius: 10,
    background: active ? 'rgba(198,161,91,0.08)' : 'transparent',
    border: `1px solid ${active ? 'rgba(198,161,91,0.4)' : PB.HAIR2}`,
    color: active ? PB.GOLD : h ? PB.NAME : PB.SLATE,
    fontSize: 12,
    whiteSpace: 'nowrap',
    flex: 'none',
    transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className="shrink-0"
      style={style}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} style={{ flex: 'none' }} />
      {showLabel && <span className="hidden xl:inline">{label}</span>}
    </button>
  );
}

function GhostSelect({ value, onChange, active, width = 140, children }) {
  const [h, setH] = useState(false);
  const style = {
    height: 32,
    padding: '0 26px 0 10px',
    borderRadius: 10,
    background: 'transparent',
    border: `1px solid ${active ? 'rgba(198,161,91,0.35)' : h ? 'rgba(255,255,255,0.16)' : PB.HAIR2}`,
    color: active ? PB.GOLD : h ? PB.NAME : PB.SLATE,
    fontSize: 12,
    whiteSpace: 'nowrap',
    flex: 'none',
    minWidth: width,
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer',
    transition: 'border-color 150ms ease, color 150ms ease',
  };
  return (
    <div className="relative shrink-0" style={{ minWidth: width }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        style={style}
        className="w-full"
      >
        {children}
      </select>
      {active && <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 5, height: 5, borderRadius: 999, background: PB.GOLD, flex: 'none', pointerEvents: 'none' }} />}
      <ChevronDown className="pointer-events-none" strokeWidth={1.5} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: active ? PB.GOLD : PB.SLATE }} />
    </div>
  );
}

const STAGES = [
  'initial_contact',
  'attempted_to_contact',
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
  attempted_to_contact: 'Attempted to Contact',
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
  const [showHandoverDialog, setShowHandoverDialog] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterArchetype, setFilterArchetype] = useState('');
  // Project filter persists in localStorage so the user stays "locked in" to their
  // selected project across page refreshes and navigation to/from landlord detail.
  const [filterProject, setFilterProjectState] = useState(() => {
    try { return localStorage.getItem('ldc_filter_project') || ''; } catch { return ''; }
  });
  const setFilterProject = (val) => {
    const v = val || '';
    setFilterProjectState(v);
    try {
      if (v) localStorage.setItem('ldc_filter_project', v);
      else localStorage.removeItem('ldc_filter_project');
    } catch {}
  };
  const [filterFloor, setFilterFloor] = useState('');
  const [filterLayout, setFilterLayout] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  const [filterHandover, setFilterHandover] = useState('');
  const [filterUnitLayout, setFilterUnitLayout] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // Sourced pool — untouched DLD-import rows (never analysed, never scored, no mandate) stay
  // OUT of the working pipeline by default so a 10k-row import can't drown the board.
  // The toggle (or any active search) brings them back.
  const [showSourcedPool, setShowSourcedPool] = useState(false);
  const [pulseFilter, setPulseFilter] = useState(null); // null | 'strike' | 'law14' | 'hot'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAgentEmail, setBulkAgentEmail] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const queryClient = useQueryClient();
  const { getPhotoForPhone, isLoading: photosLoading } = usePhotoByPhone();
  const rootRef = useRef(null);



  // Fetch all landlords and projects. staleTime keeps the board from refetching these (three of
  // which are whole-table loads) on every remount/refocus — mutations below still invalidate
  // explicitly, so freshness on user actions is unaffected. Values follow the codebase convention:
  // board data ~30s, slow-moving reference data ~minutes.
  const { data: landlords = [], isLoading, isError: landlordsError, error: landlordsErrorObj, refetch: refetchLandlords } = useQuery({
    queryKey: ['landlords', currentUser?.email, !!safePermissions.view_all_landlords],
    queryFn: async () => {
      // Load every landlord the caller may see via the paginated loadAllLandlords
      // backend function. The user-scoped list() silently caps results per call and
      // the platform forbids $lt/$gt cursors on built-in fields, so client-side
      // pagination truncated the board (e.g. only ~9 of 556 Peninsula 2 records).
      // The function uses asServiceRole (which honors limit + skip) to page the
      // full table and enforces the same access control server-side. It returns one
      // small page at a time (+ hasMore), so we loop and accumulate every page.
      const all = [];
      const limit = 1000;
      const MAX_PAGES = 40; // hard guard so a misbehaving hasMore can never loop forever
      const PARALLEL = 5;   // pages fetched concurrently — 10k+ rows arrive in ~3 round trips, not 11
      const fetchPage = async (skip) => {
        const res = await base44.functions.invoke('loadAllLandlords', { skip, limit });
        const data = res?.data ?? res;
        // A failing backend function must surface as an error, never as an empty board.
        if (data?.error) throw new Error(`loadAllLandlords failed: ${data.error}`);
        if (!data || !Array.isArray(data.landlords)) {
          throw new Error('loadAllLandlords returned an unexpected response (' + JSON.stringify(data).slice(0, 200) + ')');
        }
        return { page: data.landlords, hasMore: !!data.hasMore };
      };
      // Page 0 alone first (small tables finish here), then the rest in parallel rounds.
      // Pages are contiguous, so the LAST page of a round says whether more exist beyond it.
      let { page, hasMore } = await fetchPage(0);
      all.push(...page);
      let fetched = 1;
      while (hasMore && fetched < MAX_PAGES) {
        const count = Math.min(PARALLEL, MAX_PAGES - fetched);
        const round = await Promise.all(
          Array.from({ length: count }, (_, i) => fetchPage((fetched + i) * limit))
        );
        round.forEach(r => all.push(...r.page));
        hasMore = round[round.length - 1].hasMore;
        fetched += count;
      }
      return all;
    },
    enabled: !userLoading,
    staleTime: 30_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAssignableAgents', {});
      return res?.data?.agents || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: landlordProperties = [] } = useQuery({
    queryKey: ['landlord_properties'],
    queryFn: () => base44.entities.LandlordProperty.list(),
    staleTime: 60_000,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list(),
    staleTime: 60_000,
  });

  const { data: photographyTasks = [] } = useQuery({
    queryKey: ['photography_tasks'],
    queryFn: () => base44.entities.PhotographyTask.list(),
    staleTime: 60_000,
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

  // Build a map: landlord_id → { floor, layout }. Index properties by id ONCE (O(1) lookups) instead
  // of a linear properties.find() per landlordProperty — that was O(landlordProperties × properties)
  // and re-ran on every refetch of either whole table.
  const landlordPropertyMap = useMemo(() => {
    const propsById = new Map(properties.map(p => [p.id, p]));
    const map = {};
    landlordProperties.forEach(lp => {
      if (!lp.landlord_id) return;
      const prop = propsById.get(lp.property_id);
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

  // Role-based isolation — RLS already filters server-side, but this is a safety net
  // that also includes co-agent and listing manager assignments.
  const visibleLandlords = useMemo(() => {
    if (!currentUser || safePermissions.view_all_landlords) return landlords;
    const email = currentUser.email;
    return landlords.filter(l =>
      l.assigned_agent_email === email ||
      l.listing_manager_email === email ||
      l.co_agent_email === email
    );
  }, [landlords, currentUser, safePermissions.view_all_landlords]);

  // Untouched DLD import: sourced via dld_lookup, still in initial_contact, never analysed by
  // the brain and carrying no scores or mandate — i.e. nobody has worked this record yet.
  const isUntouchedImport = (l) =>
    l.source === 'dld_lookup' &&
    l.stage === 'initial_contact' &&
    !l.ai_processed_at &&
    !l.last_orchestrator_run_at &&
    !l.trust_score &&
    (!l.mandate_status || l.mandate_status === 'none');

  const workingBook = useMemo(() => visibleLandlords.filter(l => !isUntouchedImport(l)), [visibleLandlords]);
  const sourcedPoolCount = visibleLandlords.length - workingBook.length;

  // Lead counts per project (and the unassigned bucket) — shown as badges in the project
  // dropdown. Counted over the full visible book so the number stays meaningful regardless of
  // the active search/filter (which only narrows the board, not how many leads exist there).
  const projectLeadCounts = useMemo(() => {
    const counts = { __all: visibleLandlords.length, __unassigned: 0 };
    visibleLandlords.forEach((l) => {
      if (!l.project_id) counts.__unassigned += 1;
      else counts[l.project_id] = (counts[l.project_id] || 0) + 1;
    });
    return counts;
  }, [visibleLandlords]);
  // Search overrides the pool toggle — finding an imported owner by name must always work.
  const boardLandlords = (showSourcedPool || searchQuery.trim()) ? visibleLandlords : workingBook;

  // Unique unit_layout values from board landlords (for the filter dropdown)
  const unitLayoutOptions = useMemo(() => {
    const set = new Set();
    boardLandlords.forEach(l => { if (l.unit_layout) set.add(l.unit_layout); });
    return Array.from(set).sort();
  }, [boardLandlords]);

  // Group by stage
  const stageGroups = useMemo(() => {
    const grouped = {};
    STAGES.forEach(stage => {
      grouped[stage] = boardLandlords.filter(l => l.stage === stage);
    });
    return grouped;
  }, [boardLandlords]);

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
        })
        .filter(l => !filterHandover || l.handover_status === filterHandover)
        .filter(l => !filterUnitLayout || l.unit_layout === filterUnitLayout);
    });
    return result;
  }, [stageGroups, filterAgent, filterArchetype, filterProject, filterFloor, filterLayout, filterLanguage, filterAssignment, filterHandover, filterUnitLayout, searchQuery, landlordPropertyMap]);

  // Calculate metrics — over the WORKING book only: untouched imports carry no commission,
  // no mandates, and would otherwise flood the stalled-leads count.
  const totalPipeline = workingBook.reduce((sum, l) => sum + (l.estimated_commission_aed || 0), 0);
  const mandateCount = workingBook.filter(l => l.mandate_status === 'form_a_signed').length;
  const now = new Date();
  const mandatesThisMonth = workingBook.filter(l => {
    if (!l.mandate_signed_at) return false;
    const signedDate = new Date(l.mandate_signed_at);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return signedDate >= monthAgo;
  }).length;
  const avgDaysToFormA = (() => {
    const withFormA = workingBook.filter(l => l.mandate_status === 'form_a_signed' && l.created_date && l.mandate_signed_at);
    if (withFormA.length === 0) return 0;
    const totalDays = withFormA.reduce((sum, l) => {
      const created = new Date(l.created_date).getTime();
      const signed = new Date(l.mandate_signed_at).getTime();
      return sum + ((signed - created) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / withFormA.length);
  })();
  const stalledLeads = workingBook.filter(l => {
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
    // No onSettled invalidate: a blanket ['landlords'] invalidate refetched the ENTIRE
    // multi-page board after every single drag. The optimistic update already matches the
    // state the server accepted, and onError above reverts failed moves.
  });

  const handleStageChange = (payload) => updateStageMutation.mutate(payload);

  const allFilteredLandlords = useMemo(() => Object.values(filteredGroups).flat(), [filteredGroups]);

  // Aurora Pulse quick-filter — narrows the board to just the brain-flagged subset.
  // Applied AFTER the normal filters, over the already-loaded records (no new queries).
  const pulsePredicate = (l) => {
    if (pulseFilter === 'strike') return !!l.ai_strike_now;
    if (pulseFilter === 'law14') return l.days_in_stage != null && l.days_in_stage >= 14
      && l.stage !== 'listing_publication' && l.stage !== 'deal_closed';
    if (pulseFilter === 'hot') return l.mandate_win_probability != null && l.mandate_win_probability >= 0.7;
    return true;
  };
  const pulseFilteredGroups = useMemo(() => {
    if (!pulseFilter) return filteredGroups;
    const out = {};
    STAGES.forEach((s) => { out[s] = filteredGroups[s].filter(pulsePredicate); });
    return out;
  }, [filteredGroups, pulseFilter]);

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

  if (landlordsError) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ maxWidth: 620, textAlign: 'center' }}>
          <div style={{ color: '#f87171', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Landlord board failed to load</div>
          <div style={{ color: '#8b96b0', fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word' }}>
            Your leads are safe in the database — the board's data loader hit an error. Show this message to support/Claude:
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.06)', color: '#fca5a5', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-word' }}>
            {String(landlordsErrorObj?.message || landlordsErrorObj)}
          </div>
        </div>
        <button
          onClick={() => refetchLandlords()}
          style={{ padding: '9px 22px', borderRadius: 10, border: '1px solid rgba(198,161,91,0.4)', background: 'rgba(198,161,91,0.08)', color: '#c9a24b', fontSize: 13, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

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
    <div
      ref={rootRef}
      className="h-[100dvh] w-full flex flex-col overflow-hidden"
      style={{ background: LDC.bodyBg }}
      id="ldc-landlords"
    >
      {/* Header — Private Bank × Light. One hairline bar on #0E1428, tightened height. */}
      <div
        className="shrink-0 sticky top-0 z-20"
        style={{ paddingLeft: '4rem', paddingRight: '0.5rem', paddingTop: 6, paddingBottom: 6, background: PB.CARD, borderBottom: `1px solid ${PB.HAIR}` }}
      >
        {/* ── Row 1 — Command bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto" style={{ scrollbarWidth: 'none', minHeight: 32 }}>
          {/* Wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ border: `1px solid ${PB.GOLD}66`, boxShadow: '0 0 14px rgba(198,161,91,0.18)', background: `radial-gradient(130% 130% at 30% 18%, ${PB.GOLD}22, transparent 64%)` }}>
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: PB.GOLD }} />
            </div>
            <h1 className="text-base whitespace-nowrap" style={{ fontFamily: "'Cormorant',serif", fontWeight: 700, color: PB.NAME, letterSpacing: '0.01em' }}>Landlord Pipeline</h1>
          </div>

          {/* AED total — champagne ink inside a ghost gold-hairline chip */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 rounded-md" style={{ height: 32, background: 'transparent', border: `1px solid ${PB.GOLD}59` }}>
            <DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />
            <span className="text-sm font-bold" style={champagneInk}>
              {totalPipeline >= 1_000_000 ? `AED ${(totalPipeline / 1_000_000).toFixed(1)}M` : totalPipeline >= 1_000 ? `AED ${(totalPipeline / 1_000).toFixed(0)}K` : `AED ${totalPipeline}`}
            </span>
          </div>

          {/* My Lead Queue — ghost */}
          <button
            onClick={() => setShowQueuePanel(p => !p)}
            className="flex items-center gap-1.5 text-xs px-2.5 rounded-md shrink-0 whitespace-nowrap"
            style={{
              height: 32,
              background: showQueuePanel ? 'rgba(198,161,91,0.08)' : 'transparent',
              border: `1px solid ${showQueuePanel ? 'rgba(198,161,91,0.4)' : PB.HAIR2}`,
              color: showQueuePanel ? PB.GOLD : PB.SLATE,
              transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
            }}
          >
            <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden md:inline">My Lead Queue</span>
          </button>

          {/* Search — ghost hairline, 30% gold focus ring */}
          <div className="relative flex-1 min-w-[160px]" style={{ height: 32 }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" strokeWidth={1.5} style={{ color: PB.SLATE }} />
            <input
              type="text"
              placeholder="Search name, unit, phone, email, project…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 h-8 text-xs rounded-md"
              style={{ background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.NAME, outline: 'none', transition: 'border-color 150ms ease, box-shadow 150ms ease' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(198,161,91,0.3)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(198,161,91,0.14)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = PB.HAIR2; e.currentTarget.style.boxShadow = 'none'; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors" style={{ color: PB.SLATE }}>
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Select all — ghost */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none shrink-0 whitespace-nowrap" style={{ color: PB.SLATE }}>
            <input
              type="checkbox"
              checked={allFilteredLandlords.length > 0 && selectedIds.size === allFilteredLandlords.length}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 accent-amber-500 rounded"
            />
            <span className="tabular-nums">({allFilteredLandlords.length})</span>
          </label>

          {/* Agent filter (row 1) — ghost */}
          {safePermissions.view_all_landlords && users.length > 0 && (
            <GhostSelect value={filterAgent} onChange={setFilterAgent} active={!!filterAgent} width={128}>
              <option value="">All Agents</option>
              {users.map(u => (<option key={u.id} value={u.email}>{u.display_name || u.full_name || u.email}</option>))}
            </GhostSelect>
          )}

          {/* Action buttons — uniform ghost, +New is the only filled button */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <GhostButton onClick={() => setShowImportDialog(true)} icon={Upload} label="Import" />
            <GhostButton onClick={() => setShowVirtualViewing(true)} icon={Video} label="Virtual" />
            <GhostButton onClick={() => setShowFormADialog(true)} icon={FileSignature} label="Form A" />
            <GhostButton onClick={() => setShowMarketReportDialog(true)} icon={FileText} label="Report" />
            {safePermissions.view_all_landlords && (
              <GhostButton onClick={() => setShowHandoverDialog(true)} icon={KeyRound} label="Handover" />
            )}
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-1.5 text-xs px-3 rounded-md shrink-0 whitespace-nowrap font-semibold"
              style={{ height: 32, background: PB.CHAMPAGNE, color: PB.BASE, border: `1px solid ${PB.GOLD}80`, boxShadow: '0 4px 16px rgba(198,161,91,0.35)', transition: 'transform 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden xl:inline">New</span>
            </button>
          </div>
        </div>

        {/* Lead Queue panel (expands below the toolbar when toggled) */}
        {showQueuePanel && (
          <div className="mt-2 p-4 rounded-xl"               style={{ background: LDC.cardBg, border: LDC.cardBr, boxShadow: LDC.cardSh }}>
            <LockedLeadQueue onSelectLandlord={(id) => navigate(`/landlord/${id}`)} />
          </div>
        )}

        {/* ── Row 2 — Filter rail ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 w-full mt-1.5">
          {selectedIds.size > 0 ? (
            <div
              className="flex items-center gap-2 px-3 rounded-md"
              style={{ height: 32, background: PB.WELL, border: `1px solid ${PB.HAIR}` }}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} style={{ color: PB.GOLD }} />
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: PB.NAME }}>{selectedIds.size} selected</span>
              <select
                value={bulkAgentEmail}
                onChange={e => setBulkAgentEmail(e.target.value)}
                className="px-2 py-1 text-xs rounded-md"
                style={{ background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.NAME, minWidth: 130 }}
              >
                <option value="">Select agent…</option>
                {users.map(u => (
                  <option key={u.id} value={u.email}>{u.display_name || u.full_name || u.email}</option>
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
                className="text-xs px-1 transition-colors"
                style={{ color: PB.SLATE }}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              {/* Filter track — identical ghost hairline pills, scrolls on narrow viewports */}
              <div className="filter-track flex-1 min-w-0 flex items-center gap-2 overflow-x-auto">
                {safePermissions.view_all_landlords && users.length > 0 && (
                  <GhostSelect value={filterAgent} onChange={setFilterAgent} active={!!filterAgent} width={128}>
                    <option value="">All Agents</option>
                    {users.map(u => (<option key={u.id} value={u.email}>{u.display_name || u.full_name || u.email}</option>))}
                  </GhostSelect>
                )}
                <GhostSelect value={filterArchetype} onChange={setFilterArchetype} active={!!filterArchetype} width={132}>
                  <option value="">All Archetypes</option>
                  <option value="professional_investor">Professional Investor</option>
                  <option value="individual_end_user_relocating">Individual Relocating</option>
                  <option value="first_time_seller">First Time Seller</option>
                  <option value="portfolio_optimizer">Portfolio Optimizer</option>
                </GhostSelect>
                <div className="shrink-0">
                  <ProjectSelectorWithUpload
                    value={filterProject}
                    onChange={(val) => setFilterProject(val || '')}
                    projects={projects}
                    counts={projectLeadCounts}
                  />
                </div>
                <GhostSelect value={filterFloor} onChange={setFilterFloor} active={!!filterFloor} width={112}>
                  <option value="">All Floors</option>
                  <option value="1-10">Floors 1–10</option>
                  <option value="11-20">Floors 11–20</option>
                  <option value="21+">Floors 21+</option>
                </GhostSelect>
                <GhostSelect value={filterLayout} onChange={setFilterLayout} active={!!filterLayout} width={116}>
                  <option value="">All Layouts</option>
                  <option value="Studio">Studio</option>
                  <option value="1BR">1BR</option>
                  <option value="2BR">2BR</option>
                  <option value="3BR">3BR</option>
                  <option value="4BR+">4BR+</option>
                </GhostSelect>
                <GhostSelect value={filterHandover} onChange={setFilterHandover} active={!!filterHandover} width={124}>
                  <option value="">All Handover</option>
                  <option value="Handed Over">Handed Over</option>
                  <option value="Not Handed Over">Not Handed Over</option>
                </GhostSelect>
                <GhostSelect value={filterUnitLayout} onChange={setFilterUnitLayout} active={!!filterUnitLayout} width={128}>
                  <option value="">All Unit Layouts</option>
                  {unitLayoutOptions.map(layout => (<option key={layout} value={layout}>{layout}</option>))}
                </GhostSelect>
                <GhostSelect value={filterLanguage} onChange={setFilterLanguage} active={!!filterLanguage} width={116}>
                  <option value="">All Languages</option>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                  <option value="ru">Russian</option>
                  <option value="zh">Chinese</option>
                  <option value="hi">Hindi</option>
                </GhostSelect>
                <GhostSelect value={filterAssignment} onChange={setFilterAssignment} active={!!filterAssignment} width={128}>
                  <option value="">All Assignments</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned</option>
                </GhostSelect>
                {(filterFloor || filterLayout || filterLanguage || filterAssignment || filterHandover || filterUnitLayout || searchQuery) && (
                  <button
                    onClick={() => { setFilterFloor(''); setFilterLayout(''); setFilterLanguage(''); setFilterAssignment(''); setFilterHandover(''); setFilterUnitLayout(''); setSearchQuery(''); }}
                    className="text-xs px-2.5 rounded-md shrink-0 whitespace-nowrap"
                    style={{ height: 32, border: `1px solid ${PB.HAIR2}`, color: PB.SLATE, background: 'transparent', transition: 'color 150ms ease, border-color 150ms ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = PB.NAME; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = PB.SLATE; e.currentTarget.style.borderColor = PB.HAIR2; }}
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Sourced pool toggle — ghost stat chip */}
              {sourcedPoolCount > 0 && (
                <button
                  onClick={() => setShowSourcedPool(p => !p)}
                  className="flex items-center gap-1.5 px-2.5 rounded-md text-xs font-semibold shrink-0 ml-auto whitespace-nowrap"
                  style={{
                    height: 32,
                    background: showSourcedPool ? 'rgba(198,161,91,0.08)' : 'transparent',
                    border: `1px solid ${showSourcedPool ? 'rgba(198,161,91,0.4)' : PB.HAIR2}`,
                    color: showSourcedPool ? PB.GOLD : PB.SLATE,
                    transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
                  }}
                  title={showSourcedPool ? 'Hide untouched DLD imports from the board' : 'Show untouched DLD imports on the board (search always includes them)'}
                >
                  <Database className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="tabular-nums">{sourcedPoolCount.toLocaleString()}</span>
                  <span className="hidden lg:inline">{showSourcedPool ? 'Hide sourced pool' : 'Sourced pool'}</span>
                </button>
              )}

              {/* Count pill — ghost stat chip, near-white tabular count */}
              <div
                className="flex items-center gap-1.5 px-2.5 rounded-md text-xs font-semibold shrink-0"
                style={{ height: 32, background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.SLATE, marginLeft: sourcedPoolCount > 0 ? undefined : 'auto' }}
              >
                <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="tabular-nums" style={{ color: PB.NAME }}>{allFilteredLandlords.length}</span>
                landlord{allFilteredLandlords.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Project Intelligence — sits above the board, outside the sticky header so
          the header height never shifts when a project filter is selected. */}
      {filterProject && filterProject !== 'unassigned' && (
        <div className="shrink-0 px-2 pt-1" style={{ paddingLeft: '4.5rem', paddingRight: '0.5rem' }}>
          <ProjectIntelStrip
            landlords={allFilteredLandlords}
            landlordPropertyMap={landlordPropertyMap}
            properties={properties}
            landlordProperties={landlordProperties}
            projectId={filterProject}
            projectName={selectedProject?.name}
            isAdmin={!!safePermissions.view_all_landlords}
            activePulse={pulseFilter}
            onPulseFilter={setPulseFilter}
          />
        </div>
      )}

      {/* Kanban Board — unlocked 2D scrolling (horizontal + vertical).
           dnd-kit owns drag + edge auto-scroll; native overflow owns manual scroll. */}
      <style>{`
        .flex-nowrap::-webkit-scrollbar { display: none; }
        .flex-nowrap { -ms-overflow-style: none; scrollbar-width: none; }
        .filter-track { scrollbar-width: thin; scrollbar-color: hsl(38 92% 50% / 0.35) transparent; }
        .filter-track::-webkit-scrollbar { height: 6px; }
        .filter-track::-webkit-scrollbar-track { background: transparent; }
        .filter-track::-webkit-scrollbar-thumb { background: hsl(38 92% 50% / 0.3); border-radius: 99px; }
        .filter-track::-webkit-scrollbar-thumb:hover { background: hsl(38 92% 50% / 0.55); }
      `}</style>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, padding: '0 0.5rem', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <KanbanBoard
          stages={STAGES}
          stageLabels={STAGE_LABELS}
          stageGroups={pulseFilteredGroups}
          selectedLandlordId={null}
          onSelectLandlord={(id) => navigate(`/landlord/${id}`)}
          onStageChange={handleStageChange}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          users={users}
          onSingleAssign={(id, email) => singleAssignMutation.mutate({ id, agentEmail: email })}
          photographyTasks={photographyTasks}
          getPhotoForPhone={getPhotoForPhone}
          onDragActiveChange={() => {}}
          style={{ height: '100%' }}
        />
        </div>
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

      {/* Upcoming Handover — admin only */}
      <HandoverUpcomingDialog open={showHandoverDialog} onOpenChange={setShowHandoverDialog} />
    </div>
  );
}