import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAllRecords } from '@/api/fetchAll';
import { Search, X, Plus, RefreshCw, Building2, DollarSign, ChevronDown } from 'lucide-react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { toast } from 'sonner';
import PipelineBoard from '@/components/pipeline/PipelineBoard';
import PipelineSummaryCard from '@/components/pipeline/PipelineSummaryCard';
import MobilePipeline from '@/components/mobile/MobilePipeline';
import { useIsMobile } from '@/hooks/use-mobile';
import { STAGES, getStagesForIntent } from '@/lib/pipeline';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';
import { PB, champagneInk, isAtRisk, isHot, hasSignals, formatAEDCompact } from '@/lib/buyerPipelineTokens';

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

// V3 Phase 1 (SEE-ACROSS) for Leads — mirrors landlordPriority / dealPriority.
function leadPriority(l) {
  if (!l) return -1;
  const n = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
  const score = n(l.ai_lead_score) ?? n(l.lead_score) ?? 0;
  const conv = n(l.ai_conversion_probability) ?? 0;
  const churn = n(l.ai_churn_prediction) ?? 0;
  const signals = Array.isArray(l.ai_buying_signals) ? l.ai_buying_signals.length : 0;
  return signals * 25 + conv * 40 + churn * 35 + score;
}

// ── Ghost header controls — one uniform hairline language for the Private Bank × Light bar.
function GhostButton({ onClick, icon: Icon, label, active, showLabel = true }) {
  const [h, setH] = useState(false);
  const style = {
    height: 32, display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '0 10px', borderRadius: 10,
    background: active ? 'rgba(198,161,91,0.08)' : 'transparent',
    border: `1px solid ${active ? 'rgba(198,161,91,0.4)' : h ? 'rgba(255,255,255,0.16)' : PB.HAIR2}`,
    color: active ? PB.GOLD : h ? PB.NAME : PB.SLATE,
    fontSize: 12, whiteSpace: 'nowrap', flex: 'none',
    transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
    cursor: 'pointer',
  };
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} className="shrink-0" style={style}>
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} style={{ flex: 'none' }} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

function GhostSelect({ value, onChange, active, width = 140, children }) {
  const [h, setH] = useState(false);
  const style = {
    height: 32, padding: '0 26px 0 10px', borderRadius: 10,
    background: 'transparent',
    border: `1px solid ${active ? 'rgba(198,161,91,0.35)' : h ? 'rgba(255,255,255,0.16)' : PB.HAIR2}`,
    color: active ? PB.GOLD : h ? PB.NAME : PB.SLATE,
    fontSize: 12, whiteSpace: 'nowrap', flex: 'none', minWidth: width,
    appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
    transition: 'border-color 150ms ease, color 150ms ease',
  };
  return (
    <div className="relative shrink-0" style={{ minWidth: width }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={style} className="w-full">
        {children}
      </select>
      {active && <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 5, height: 5, borderRadius: 999, background: PB.GOLD, flex: 'none', pointerEvents: 'none' }} />}
      <ChevronDown className="pointer-events-none" strokeWidth={1.5} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: active ? PB.GOLD : PB.SLATE }} />
    </div>
  );
}

const TAB_CONFIG = [
  { key: 'sale', label: 'Sale', intent: 'buyer' },
  { key: 'rent', label: 'Rent', intent: 'tenant' },
  { key: 'intake', label: 'Intake', intent: 'unknown' },
  { key: 'whatsapp', label: 'WhatsApp', intent: 'unknown' },
];

export default function Pipeline() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sale');
  const [projectFilter, setProjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [financeFilter, setFinanceFilter] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);
  const [pulseFilter, setPulseFilter] = useState(null);

  const { user: currentUser, permissions } = useCurrentUser();
  const { getPhotoForPhone } = usePhotoByPhone();

  useEffect(() => {
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('pointer-events');
    document.documentElement.style.removeProperty('overflow');
    document.body.removeAttribute('data-scroll-locked');
  }, []);

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: () => fetchAllRecords(base44.entities.Lead, '-stage_entered_at'),
    staleTime: 120_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
    staleTime: 5 * 60_000,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['pipeline-listings'],
    queryFn: () => base44.entities.PFListing.list('-updated_date', 5000),
    staleTime: 60_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['pipeline-users'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    staleTime: 120_000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, email }) => base44.entities.Lead.update(id, { assigned_agent_email: email }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] }); toast.success('Agent assigned'); },
    onError: () => toast.error('Failed to assign agent'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] }); toast.success('Lead deleted'); },
    onError: () => toast.error('Failed to delete lead'),
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['pipeline-commissions'],
    queryFn: () => base44.entities.Commission.filter({ status: 'pending' }),
    staleTime: 30_000,
  });
  const commissionPipelineTotal = commissions.reduce((s, c) => s + (c.commission_amount_aed || 0), 0);

  const { data: credRows = [] } = useQuery({
    queryKey: ['pf-credential'],
    queryFn: () => base44.entities.PFCredential.list(),
  });
  const credRow = credRows[0];
  const lastSyncedAt = mostRecentSync(credRow);

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

  const activeLeads = useMemo(() => {
    let result = leads.filter((l) => l.status !== 'lost' && l.status !== 'on_hold');
    if (currentUser && !permissions.view_all_pipeline) {
      result = result.filter((l) => l.assigned_agent_email && l.assigned_agent_email === currentUser.email);
    }
    if (projectFilter !== 'all') result = result.filter((l) => l.project_id === projectFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((l) =>
        (l.full_name || l.name || '').toLowerCase().includes(q) ||
        (l.first_name || '').toLowerCase().includes(q) ||
        (l.last_name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.whatsapp || '').toLowerCase().includes(q)
      );
    }
    if (agentFilter) result = result.filter((l) => l.assigned_agent_email === agentFilter);
    if (languageFilter) result = result.filter((l) => l.preferred_language === languageFilter);
    if (assignmentFilter === 'assigned') result = result.filter((l) => !!l.assigned_agent_email);
    if (assignmentFilter === 'unassigned') result = result.filter((l) => !l.assigned_agent_email);
    if (financeFilter) result = result.filter((l) => l.financing_type === financeFilter);
    result.sort((a, b) => leadPriority(b) - leadPriority(a));
    return result;
  }, [leads, projectFilter, searchQuery, agentFilter, languageFilter, assignmentFilter, financeFilter, currentUser, permissions]);

  const buckets = useMemo(() => {
    const sale = [], rent = [], intake = [];
    for (const lead of activeLeads) {
      const stageMeta = STAGES[lead.stage];
      const stageIntent = stageMeta && stageMeta.intent;
      if (lead.intent === 'buyer' && stageIntent === 'buyer') sale.push(lead);
      else if (lead.intent === 'tenant' && stageIntent === 'tenant') rent.push(lead);
      else intake.push(lead);
    }
    const whatsapp = activeLeads.filter((l) => l.source === 'whatsapp_campaign');
    return { sale, rent, intake, whatsapp };
  }, [activeLeads]);

  const totalPipelineValue = activeLeads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0);

  // BUYER PULSE quick-filter — applied AFTER normal filters, over the already-loaded leads.
  const pulsePredicate = (l) => {
    if (pulseFilter === 'risk') return isAtRisk(l);
    if (pulseFilter === 'hot') return isHot(l);
    if (pulseFilter === 'signals') return hasSignals(l);
    return true;
  };
  const applyPulse = (arr) => pulseFilter ? arr.filter(pulsePredicate) : arr;

  const updateStageMutation = useMutation({
    mutationFn: ({ id, newStage }) =>
      base44.entities.Lead.update(id, { stage: newStage, stage_entered_at: new Date().toISOString() }),
    onMutate: async ({ id, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline-leads'] });
      const previous = queryClient.getQueryData(['pipeline-leads']);
      queryClient.setQueryData(['pipeline-leads'], (old) =>
        (old || []).map((l) => (l.id === id ? { ...l, stage: newStage, stage_entered_at: new Date().toISOString() } : l)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context && context.previous) queryClient.setQueryData(['pipeline-leads'], context.previous);
      toast.error('Failed to move lead — reverting.');
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] }); },
  });

  const handleStageChange = (payload) => updateStageMutation.mutate(payload);

  if (isMobile) {
    return (
      <div className="p-4" style={{ background: PB.BASE, minHeight: '100dvh' }}>
        <MobilePipeline />
      </div>
    );
  }

  const tabBuckets = {
    sale: buckets.sale,
    rent: buckets.rent,
    intake: buckets.intake,
    whatsapp: buckets.whatsapp,
  };
  const tabIntents = { sale: 'buyer', rent: 'tenant', intake: 'unknown', whatsapp: 'unknown' };
  const activeStages = getStagesForIntent(tabIntents[activeTab]);
  const activeTrackLeads = tabBuckets[activeTab];
  const boardLeads = applyPulse(activeTrackLeads);

  const hasActiveFilters = !!(searchQuery || agentFilter || languageFilter || assignmentFilter || financeFilter || projectFilter !== 'all');

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden" style={{ background: PB.BASE }}>
      {/* ── Header — Private Bank × Light ghost bar ─────────────────────────── */}
      <div
        className="shrink-0 sticky top-0 z-20"
        style={{ paddingLeft: '1rem', paddingRight: '0.5rem', paddingTop: 8, paddingBottom: 8, background: PB.CARD, borderBottom: `1px solid ${PB.HAIR}` }}
      >
        {/* Command row */}
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto" style={{ scrollbarWidth: 'none', minHeight: 32 }}>
          {/* Wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ border: `1px solid ${PB.GOLD}66`, boxShadow: '0 0 14px rgba(198,161,91,0.18)', background: `radial-gradient(130% 130% at 30% 18%, ${PB.GOLD}22, transparent 64%)` }}>
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: PB.GOLD }} />
            </div>
            <h1 className="text-base whitespace-nowrap" style={{ fontFamily: "'Cormorant',serif", fontWeight: 700, color: PB.NAME, letterSpacing: '0.01em' }}>Buyer Pipeline</h1>
          </div>

          {/* AED total — champagne ink inside a ghost gold-hairline chip */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 rounded-md" style={{ height: 32, background: 'transparent', border: `1px solid ${PB.GOLD}59` }}>
            <DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />
            <span className="text-sm font-bold" style={champagneInk}>
              {formatAEDCompact(totalPipelineValue)}
            </span>
          </div>

          {/* Search — ghost hairline, gold focus ring */}
          <div className="relative flex-1 min-w-[160px]" style={{ height: 32 }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" strokeWidth={1.5} style={{ color: PB.SLATE }} />
            <input
              type="text"
              placeholder="Search name, email, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Filters */}
          {projects.length > 0 && (
            <GhostSelect value={projectFilter} onChange={setProjectFilter} active={projectFilter !== 'all'} width={132}>
              <option value="all">All Projects</option>
              {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </GhostSelect>
          )}
          {permissions.view_all_pipeline && (
            <GhostSelect value={agentFilter} onChange={setAgentFilter} active={!!agentFilter} width={128}>
              <option value="">All Agents</option>
              {users.map((u) => (<option key={u.id} value={u.email}>{u.full_name || u.email}</option>))}
            </GhostSelect>
          )}
          <GhostSelect value={languageFilter} onChange={setLanguageFilter} active={!!languageFilter} width={120}>
            <option value="">All Languages</option>
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="fr">French</option>
            <option value="ru">Russian</option>
            <option value="zh">Chinese</option>
            <option value="hi">Hindi</option>
            <option value="ur">Urdu</option>
            <option value="fa">Farsi</option>
          </GhostSelect>
          <GhostSelect value={assignmentFilter} onChange={setAssignmentFilter} active={!!assignmentFilter} width={128}>
            <option value="">All Assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </GhostSelect>
          <GhostSelect value={financeFilter} onChange={setFinanceFilter} active={!!financeFilter} width={128}>
            <option value="">All Finance Types</option>
            <option value="cash">Cash</option>
            <option value="mortgage">Mortgage</option>
            <option value="pre_approved">Pre-approved</option>
            <option value="mixed">Mixed</option>
          </GhostSelect>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(''); setAgentFilter(''); setLanguageFilter(''); setAssignmentFilter(''); setFinanceFilter(''); setProjectFilter('all'); }}
              className="text-xs px-2.5 rounded-md shrink-0 whitespace-nowrap"
              style={{ height: 32, border: `1px solid ${PB.HAIR2}`, color: PB.SLATE, background: 'transparent', transition: 'color 150ms ease, border-color 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = PB.NAME; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = PB.SLATE; e.currentTarget.style.borderColor = PB.HAIR2; }}
            >
              Clear filters
            </button>
          )}

          {lastSyncedAt && (
            <div className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: PB.SLATE }}>
              <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
              <span className="hidden lg:inline">Synced {formatRelativeShort(lastSyncedAt) || 'never'}</span>
            </div>
          )}

          {/* + Add Lead — the ONLY champagne-filled button */}
          <button
            onClick={() => setShowAddLead(true)}
            className="flex items-center gap-1.5 text-xs px-3 rounded-md shrink-0 whitespace-nowrap font-semibold"
            style={{ height: 32, background: PB.CHAMPAGNE, color: PB.BASE, border: `1px solid ${PB.GOLD}80`, boxShadow: '0 4px 16px rgba(198,161,91,0.35)', transition: 'transform 150ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden xl:inline">Add Lead</span>
          </button>
        </div>

        {/* Ghost tab segments — Sale / Rent / Intake / WhatsApp */}
        <div className="flex items-center gap-1 mt-2">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabBuckets[tab.key].length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-3 rounded-md text-xs font-semibold shrink-0 whitespace-nowrap"
                style={{
                  height: 30,
                  background: isActive ? 'rgba(198,161,91,0.08)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(198,161,91,0.35)' : PB.HAIR2}`,
                  color: isActive ? PB.GOLD : PB.SLATE,
                  transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
                }}
              >
                {tab.label}
                <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isActive ? PB.GOLD : PB.SLATE }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — summary (shrink-0) + board (flex-1, fills remaining height) */}
      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: '0.5rem 1rem 0.5rem 1rem' }}>
        {leadsLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: PB.SLATE }}>Loading pipeline…</div>
        ) : (
          <>
            <div className="shrink-0">
              <PipelineSummaryCard
                leads={activeTrackLeads}
                stages={activeStages}
                activePulse={pulseFilter}
                onPulseFilter={setPulseFilter}
              />
            </div>
            <div className="flex-1 min-h-0">
              <PipelineBoard
                track={tabIntents[activeTab]}
                leads={boardLeads}
                getListing={getListing}
                getPhotoForPhone={getPhotoForPhone}
                onLeadClick={(l) => navigate(`/lead/${l.id}`)}
                onStageChange={handleStageChange}
                users={users}
                onAssign={(id, email) => assignMutation.mutate({ id, email })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            </div>
          </>
        )}
      </div>

      <AddLeadDialog open={showAddLead} onClose={() => setShowAddLead(false)} />
    </div>
  );
}