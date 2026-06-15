import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EruditePage from '@/components/erudite/EruditePage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Users, UserCheck, Clock, Search, ArrowUpDown, CheckSquare, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import PFLeadCard, { NON_SALES_EMAILS } from '@/components/propertyfinder/PFLeadCard';

const ALL_STAGES = [
  { value: 'intake_clarify',          label: 'Intake / Clarify' },
  { value: 'contact_identity',        label: 'Contact Identity' },
  { value: 'financial_qualification', label: 'Financial Qualification' },
  { value: 'intent_lock',             label: 'Intent Lock' },
  { value: 'unit_matching',           label: 'Unit Matching' },
  { value: 'viewing',                 label: 'Viewing' },
  { value: 'objection_offer',         label: 'Objection / Offer' },
  { value: 'negotiation_deal_lock',   label: 'Negotiation / Deal Lock' },
  { value: 'closing_dld',             label: 'Closing / DLD' },
  { value: 'closed',                  label: 'Closed' },
  { value: 'new_tenant_lead',         label: 'New Tenant Lead' },
  { value: 'qualified_tenant',        label: 'Qualified Tenant' },
  { value: 'viewing_decision',        label: 'Viewing / Decision' },
  { value: 'contract_cheques',        label: 'Contract / Cheques' },
  { value: 'ejari_movein',            label: 'Ejari / Move-in' },
];

const AGENT_NAMES = {
  'ahmad@erudite-estate.com': 'Ahmad',
  'dari@erudite-estate.com':  'Dari',
  'tuiara@erudite-estate.com':'Tuiara',
  'malik@erudite-estate.com': 'Malik',
};
function agentLabel(email) { return AGENT_NAMES[email] || email?.split('@')[0] || 'Unassigned'; }

export default function PropertyFinderLeads() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [listingRefFilter, setListingRefFilter] = useState('all'); // 'all' | 'has' | 'none'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState('created_date');
  const [sortDir, setSortDir] = useState('desc');
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkAgent, setBulkAgent] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['pf-leads'],
    queryFn: () => base44.entities.Lead.filter({ source: 'property_finder' }, '-created_date', 300),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa-conversations-pf'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 500),
  });

  // Build a phone→conversation_id map (normalized to last 9 digits for matching)
  const waConvMap = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      const digits = (c.wa_phone_e164 || '').replace(/\D/g, '');
      if (digits.length >= 9) map.set(digits.slice(-9), c.id);
    }
    return map;
  }, [conversations]);

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords-for-link'],
    queryFn: () => base44.entities.Landlord.list('-created_date', 500),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => base44.entities.User.list(),
  });

  const salesAgents = useMemo(() =>
    allUsers.filter(u => u.role === 'agent' && !NON_SALES_EMAILS.has(u.email)),
    [allUsers]
  );

  const agentEmails = useMemo(() => (
    [...new Set(leads.map(l => l.assigned_agent_email).filter(Boolean))]
  ), [leads]);

  const filtered = useMemo(() => {
    let result = leads.filter(lead => {
      if (agentFilter !== 'all' && lead.assigned_agent_email !== agentFilter) return false;
      if (stageFilter !== 'all' && lead.stage !== stageFilter) return false;
      if (listingRefFilter === 'has' && !lead.closing_property_ref) return false;
      if (listingRefFilter === 'none' && lead.closing_property_ref) return false;
      if (dateFrom && new Date(lead.created_date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(lead.created_date) > new Date(dateTo + 'T23:59:59')) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(
          lead.full_name?.toLowerCase().includes(q) ||
          lead.phone?.includes(q) ||
          lead.notes?.toLowerCase().includes(q) ||
          lead.closing_property_ref?.toLowerCase().includes(q)
        )) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      let va, vb;
      if (sortField === 'created_date') {
        va = new Date(a.created_date).getTime();
        vb = new Date(b.created_date).getTime();
      } else if (sortField === 'stage') {
        va = a.stage || '';
        vb = b.stage || '';
      } else if (sortField === 'assigned_agent_email') {
        va = agentLabel(a.assigned_agent_email);
        vb = agentLabel(b.assigned_agent_email);
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, agentFilter, stageFilter, listingRefFilter, dateFrom, dateTo, search, sortField, sortDir]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pf-leads'] }),
    onError: () => toast.error('Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pf-leads'] }); toast.success('Lead deleted'); },
    onError: () => toast.error('Failed to delete lead'),
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncPropertyFinderLeads', {});
      const d = res.data;
      toast.success(`Sync complete — ${d.created_count} new, ${d.updated_count} updated`);
      queryClient.invalidateQueries({ queryKey: ['pf-leads'] });
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdate = (id, data) => updateMutation.mutate({ id, data });

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(l => next.delete(l.id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(l => next.add(l.id)); return next; });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAgent || selected.size === 0) return;
    await Promise.all([...selected].map(id => base44.entities.Lead.update(id, { assigned_agent_email: bulkAgent })));
    queryClient.invalidateQueries({ queryKey: ['pf-leads'] });
    setSelected(new Set());
    setBulkAgent('');
    toast.success(`Assigned ${selected.size} lead(s) to ${agentLabel(bulkAgent)}`);
  };

  const handleLandlordLink = (leadId, landlordId, unitRef) => {
    const data = { landlord_id: landlordId || null };
    if (unitRef) data.closing_property_ref = unitRef;
    updateMutation.mutate({ id: leadId, data });
    toast.success(landlordId ? 'Landlord linked' : 'Link removed');
  };

  const isAnonymous = (l) => l.full_name === 'Ahmad Erudite Property';

  return (
    <EruditePage>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-semibold" style={{ color:'rgba(255,255,255,0.95)' }}>
              Property Finder Leads
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {leads.length} leads synced from Property Finder
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Total',     value:leads.length,                                                                                    icon:Users,    color:'text-white' },
            { label:'Today',     value:leads.filter(l=>new Date(l.created_date).toDateString()===new Date().toDateString()).length,      icon:Clock,    color:'text-sky-400' },
            { label:'Assigned',  value:leads.filter(l=>l.assigned_agent_email).length,                                                  icon:UserCheck,color:'text-emerald-400' },
            { label:'Anonymous', value:leads.filter(isAnonymous).length,                                                                icon:Users,    color:'text-rose-400' },
          ].map(stat => (
            <div key={stat.label} className="glass-card p-3 flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + Sort */}
        <div className="space-y-2">
          {/* Row 1: search + agent */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, listing ref…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.9)' }}
              />
            </div>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agentEmails.map(email => (
                  <SelectItem key={email} value={email}>{agentLabel(email)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: stage + listing ref + dates + sort */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Stage */}
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-44 h-8 text-xs bg-white/5 border-white/10">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {ALL_STAGES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Listing ref toggle */}
            <Select value={listingRefFilter} onValueChange={setListingRefFilter}>
              <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10">
                <SelectValue placeholder="Listing ref" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any listing ref</SelectItem>
                <SelectItem value="has">Has listing ref</SelectItem>
                <SelectItem value="none">No listing ref</SelectItem>
              </SelectContent>
            </Select>

            {/* Date from */}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="From date"
              className="h-8 px-2 rounded-md text-xs"
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.75)', colorScheme:'dark' }}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="To date"
              className="h-8 px-2 rounded-md text-xs"
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.75)', colorScheme:'dark' }}
            />

            {/* Sort */}
            <div className="flex items-center gap-1 ml-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={sortField} onValueChange={setSortField}>
                <SelectTrigger className="w-36 h-8 text-xs bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">Date</SelectItem>
                  <SelectItem value="stage">Stage</SelectItem>
                  <SelectItem value="assigned_agent_email">Agent</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="h-8 px-2 rounded-md text-xs transition-colors"
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)' }}
                title="Toggle sort direction"
              >
                {sortDir === 'desc' ? '↓ Newest' : '↑ Oldest'}
              </button>
            </div>

            {/* Clear filters */}
            {(stageFilter !== 'all' || listingRefFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setStageFilter('all'); setListingRefFilter('all'); setDateFrom(''); setDateTo(''); }}
                className="h-8 px-2 rounded-md text-xs text-rose-400 hover:text-rose-300 transition-colors"
                style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Active filter summary + select all */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {leads.length} leads
              {selected.size > 0 && <span className="ml-2 text-amber-400">· {selected.size} selected</span>}
            </p>
            {filtered.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
              >
                {allVisibleSelected
                  ? <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                  : <Square className="w-3.5 h-3.5" />}
                {allVisibleSelected ? 'Deselect all' : 'Select all visible'}
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky top-2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ background:'rgba(20,28,48,0.95)', border:'1px solid rgba(245,158,11,0.3)', backdropFilter:'blur(12px)' }}>
            <span className="text-sm font-medium text-amber-400">{selected.size} lead{selected.size > 1 ? 's' : ''} selected</span>
            <Select value={bulkAgent} onValueChange={setBulkAgent}>
              <SelectTrigger className="w-40 h-8 text-xs bg-white/5 border-white/10">
                <SelectValue placeholder="Choose agent…" />
              </SelectTrigger>
              <SelectContent>
                {salesAgents.map(u => (
                  <SelectItem key={u.email} value={u.email}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkAssign} disabled={!bulkAgent} className="h-8 text-xs">
              Assign
            </Button>
            <button
              onClick={() => { setSelected(new Set()); setBulkAgent(''); }}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear selection
            </button>
          </div>
        )}

        {/* Lead Cards */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No leads found</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(lead => (
              <div key={lead.id} className="relative">
                <button
                  onClick={() => toggleSelect(lead.id)}
                  className="absolute top-2 left-2 z-10 w-5 h-5 flex items-center justify-center rounded transition-colors"
                  style={{ background: selected.has(lead.id) ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.4)', border: selected.has(lead.id) ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.2)' }}
                  title={selected.has(lead.id) ? 'Deselect' : 'Select'}
                >
                  {selected.has(lead.id)
                    ? <CheckSquare className="w-3 h-3 text-amber-400" />
                    : <Square className="w-3 h-3 text-white/40" />}
                </button>
                <PFLeadCard
                  lead={lead}
                  landlords={landlords}
                  agents={salesAgents}
                  waConversationId={waConvMap.get((lead.phone || '').replace(/\D/g, '').slice(-9)) || null}
                  onUpdate={handleUpdate}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onLandlordLink={handleLandlordLink}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </EruditePage>
  );
}