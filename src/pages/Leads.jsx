import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus, Search, Download, Wand2, GitMerge, ChevronUp, ChevronDown,
  ChevronsUpDown, X, CalendarDays, SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { format, isPast, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import SourceBadge from '@/components/shared/SourceBadge';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';
import LeadDetailSheet from '@/components/leads/LeadDetailSheet';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import RawDataIngestion from '@/components/leads/RawDataIngestion';
import BulkActionBar from '@/components/leads/BulkActionBar';
import { primeWhatsAppCache } from '@/hooks/useHasWhatsApp';
import { STAGES } from '@/lib/pipeline';

const PAGE_SIZE = 50;

const ALL_STAGES = Object.values(STAGES);

const INTENT_LABELS = { buyer: 'Buyer', tenant: 'Tenant', unknown: 'Unknown' };
const STATUS_LABELS = { active: 'Active', lost: 'Lost', on_hold: 'On Hold' };
const STATUS_COLORS = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  lost: 'bg-red-500/15 text-red-400 border-red-500/25',
  on_hold: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
};
const INTENT_COLORS = {
  buyer: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  tenant: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  unknown: 'bg-white/5 text-white/35 border-white/10',
};

function formatDealValue(val) {
  if (!val || val <= 0) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}K`;
  return String(val);
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40 ml-0.5" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-accent ml-0.5" />
    : <ChevronDown className="w-3 h-3 text-accent ml-0.5" />;
}

function SortableHead({ label, col, sortCol, sortDir, onSort, className = '' }) {
  return (
    <TableHead
      className={`text-xs cursor-pointer select-none hover:text-foreground ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </TableHead>
  );
}

export default function Leads() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ── filters
  const [search, setSearch] = useState('');
  const [intentFilter, setIntentFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [apptFilter, setApptFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [dealMin, setDealMin] = useState('');
  const [dealMax, setDealMax] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── sort
  const [sortCol, setSortCol] = useState('created_date');
  const [sortDir, setSortDir] = useState('desc');

  // ── pagination
  const [page, setPage] = useState(1);

  // ── selected / dialogs
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showIngestion, setShowIngestion] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 2000),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
  });

  useEffect(() => {
    const phones = leads.map(l => l.phone).filter(Boolean);
    if (phones.length > 0) primeWhatsAppCache(phones);
  }, [leads]);

  // Deep-link
  useEffect(() => {
    const id = searchParams.get('selected');
    if (id && leads.length > 0) {
      const found = leads.find(l => l.id === id);
      if (found && (!selectedLead || selectedLead.id !== id)) setSelectedLead(found);
    }
  }, [searchParams, leads]);

  // Agent list for filter dropdown
  const agents = useMemo(() => {
    const set = new Set(leads.map(l => l.assigned_agent_name).filter(Boolean));
    return [...set].sort();
  }, [leads]);

  const handleSort = useCallback((col) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return col; }
      setSortDir('asc');
      return col;
    });
    setPage(1);
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, intentFilter, stageFilter, statusFilter, sourceFilter, agentFilter, apptFilter, projectFilter, dealMin, dealMax]);

  const now = new Date();
  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.full_name?.toLowerCase().includes(q) ||
        l.name?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q)
      );
    }
    if (intentFilter !== 'all') result = result.filter(l => l.intent === intentFilter);
    if (stageFilter !== 'all') result = result.filter(l => l.stage === stageFilter);
    if (statusFilter !== 'all') result = result.filter(l => l.status === statusFilter);
    if (sourceFilter !== 'all') result = result.filter(l => l.source === sourceFilter);
    if (agentFilter !== 'all') result = result.filter(l => l.assigned_agent_name === agentFilter);
    if (apptFilter === 'yes') result = result.filter(l => l.next_appointment_at && !isPast(parseISO(l.next_appointment_at)));
    if (apptFilter === 'no') result = result.filter(l => !l.next_appointment_at || isPast(parseISO(l.next_appointment_at)));
    if (projectFilter !== 'all') result = result.filter(l => l.project_id === projectFilter);
    const min = Number(dealMin) || 0;
    const max = Number(dealMax) || Infinity;
    if (min > 0 || max < Infinity) result = result.filter(l => (l.deal_value_aed || 0) >= min && (l.deal_value_aed || 0) <= max);
    return result;
  }, [leads, search, intentFilter, stageFilter, statusFilter, sourceFilter, agentFilter, apptFilter, projectFilter, dealMin, dealMax]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av, bv;
      if (sortCol === 'name') { av = (a.full_name || a.name || '').toLowerCase(); bv = (b.full_name || b.name || '').toLowerCase(); }
      else if (sortCol === 'deal_value_aed') { av = a.deal_value_aed || 0; bv = b.deal_value_aed || 0; }
      else if (sortCol === 'next_appointment_at') { av = a.next_appointment_at ? new Date(a.next_appointment_at).getTime() : 0; bv = b.next_appointment_at ? new Date(b.next_appointment_at).getTime() : 0; }
      else { av = a.created_date ? new Date(a.created_date).getTime() : 0; bv = b.created_date ? new Date(b.created_date).getTime() : 0; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page]);

  const activeFilterCount = [intentFilter, stageFilter, statusFilter, sourceFilter, agentFilter, apptFilter, projectFilter].filter(v => v !== 'all').length
    + (dealMin ? 1 : 0) + (dealMax ? 1 : 0);

  const clearFilters = () => {
    setIntentFilter('all'); setStageFilter('all'); setStatusFilter('all');
    setSourceFilter('all'); setAgentFilter('all'); setApptFilter('all');
    setProjectFilter('all'); setDealMin(''); setDealMax('');
  };

  return (
    <div
      className="p-4 md:p-6 max-w-[1700px] mx-auto min-h-screen"
      style={{
        background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
      }}
    >
      <PageHeader title="Leads" subtitle={`${sorted.length.toLocaleString()} leads${filtered.length < leads.length ? ` of ${leads.length.toLocaleString()}` : ''}`}>
        <Button size="sm" variant="outline" onClick={() => setFiltersOpen(v => !v)} className="gap-1.5 relative">
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.location.href = '/duplicates'} className="gap-1">
          <GitMerge className="w-4 h-4" /> Duplicates
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowIngestion(true)}>
          <Wand2 className="w-4 h-4 mr-1" /> Import
        </Button>
        <Button size="sm" onClick={() => setShowAddLead(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-1" /> Add Lead
        </Button>
      </PageHeader>

      {/* Search + filter bar */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
          </div>
          {/* Quick filters always visible */}
          <Select value={intentFilter} onValueChange={setIntentFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Intent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intents</SelectItem>
              <SelectItem value="buyer">Buyer</SelectItem>
              <SelectItem value="tenant">Tenant</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>

        {/* Expanded filter panel */}
        {filtersOpen && (
          <div
            className="flex flex-wrap gap-2 p-3 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderTopColor: 'rgba(255,255,255,0.14)',
            }}
          >
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {ALL_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="property_finder">Property Finder</SelectItem>
                <SelectItem value="bayut">Bayut</SelectItem>
                <SelectItem value="dubizzle">Dubizzle</SelectItem>
                <SelectItem value="whatsapp_campaign">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {agents.length > 0 && (
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={apptFilter} onValueChange={setApptFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Appointment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Appointment</SelectItem>
                <SelectItem value="yes">Has Upcoming Appt</SelectItem>
                <SelectItem value="no">No Upcoming Appt</SelectItem>
              </SelectContent>
            </Select>
            {projects.length > 0 && (
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                placeholder="Deal min AED"
                value={dealMin}
                onChange={e => setDealMin(e.target.value)}
                className="w-32 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                placeholder="Deal max AED"
                value={dealMax}
                onChange={e => setDealMax(e.target.value)}
                className="w-32 h-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: 'rgba(255,255,255,0.025)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTopColor: 'rgba(255,255,255,0.14)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ background: 'rgba(8,11,18,0.7)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={paginated.length > 0 && paginated.every(l => selectedIds.has(l.id))}
                    onChange={e => {
                      if (e.target.checked) setSelectedIds(new Set([...selectedIds, ...paginated.map(l => l.id)]));
                      else setSelectedIds(new Set([...selectedIds].filter(id => !paginated.some(l => l.id === id))));
                    }}
                  />
                </TableHead>
                <SortableHead label="Name" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                <TableHead className="text-xs">Phone</TableHead>
                <TableHead className="text-xs">Source</TableHead>
                <TableHead className="text-xs">Intent</TableHead>
                <TableHead className="text-xs min-w-[160px]">Stage</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Agent</TableHead>
                <SortableHead label="Deal (AED)" col="deal_value_aed" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHead label="Next Appt" col="next_appointment_at" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHead label="Created" col="created_date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(lead => {
                const stageMeta = STAGES[lead.stage];
                const name = lead.full_name || lead.name || 'Unknown';
                const hasUpcomingAppt = lead.next_appointment_at && !isPast(parseISO(lead.next_appointment_at));
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer transition-all duration-150"
                    style={{
                      background: selectedIds.has(lead.id) ? 'rgba(245,159,10,0.07)' : 'transparent',
                      borderLeft: selectedIds.has(lead.id) ? '2px solid rgba(245,159,10,0.5)' : '2px solid transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                    onMouseEnter={e => { if (!selectedIds.has(lead.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!selectedIds.has(lead.id)) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <TableCell onClick={e => e.stopPropagation()} className="w-8">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selectedIds.has(lead.id)}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          e.target.checked ? next.add(lead.id) : next.delete(lead.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    {/* Name */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                          {name[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-sm truncate max-w-[120px]">{name}</span>
                      </div>
                    </TableCell>
                    {/* Phone */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      {lead.phone && (
                        <WhatsAppPhone
                          phone={lead.phone}
                          name={name}
                          leadId={lead.id}
                          size="xs"
                          disabled={lead.do_not_contact}
                        />
                      )}
                    </TableCell>
                    {/* Source */}
                    <TableCell><SourceBadge source={lead.source} /></TableCell>
                    {/* Intent */}
                    <TableCell>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${INTENT_COLORS[lead.intent] || INTENT_COLORS.unknown}`}>
                        {INTENT_LABELS[lead.intent] || 'Unknown'}
                      </span>
                    </TableCell>
                    {/* Stage */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                        {stageMeta?.label || lead.stage || '—'}
                      </span>
                    </TableCell>
                    {/* Status */}
                    <TableCell>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[lead.status] || ''}`}>
                        {STATUS_LABELS[lead.status] || lead.status || '—'}
                      </span>
                    </TableCell>
                    {/* Agent */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px] block">
                        {lead.assigned_agent_name || '—'}
                      </span>
                    </TableCell>
                    {/* Deal value */}
                    <TableCell>
                      {lead.deal_value_aed > 0
                        ? <span className="text-xs font-semibold" style={{ color: 'hsl(38 92% 50%)', fontVariantNumeric: 'tabular-nums' }}>{formatDealValue(lead.deal_value_aed)}</span>
                        : <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}
                    </TableCell>
                    {/* Next appt */}
                    <TableCell>
                      {lead.next_appointment_at ? (
                        <span className={`text-xs inline-flex items-center gap-1 ${hasUpcomingAppt ? 'text-purple-600' : 'text-muted-foreground'}`}>
                          <CalendarDays className="w-3 h-3 shrink-0" />
                          {format(parseISO(lead.next_appointment_at), 'MMM d')}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    {/* Created */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {lead.created_date ? format(new Date(lead.created_date), 'MMM d, yy') : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    {isLoading ? 'Loading leads…' : 'No leads match your filters'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-xs text-muted-foreground">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPage(1)} disabled={page === 1}>«</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
              <span className="text-xs text-muted-foreground px-2">Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</Button>
            </div>
          </div>
        )}
      </div>

      {selectedLead && (
        <LeadDetailSheet lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
      )}
      <AddLeadDialog open={showAddLead} onClose={() => setShowAddLead(false)} />
      <RawDataIngestion open={showIngestion} onClose={() => setShowIngestion(false)} />
      {selectedIds.size > 0 && (
        <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} />
      )}
    </div>
  );
}