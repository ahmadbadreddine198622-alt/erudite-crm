import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { base44 as b44 } from '@/api/base44Client';
import EruditePage from '@/components/erudite/EruditePage';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, ExternalLink, Users, UserCheck, Clock, Search, Phone, Mail, MessageCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const AGENT_NAMES = {
  'ahmad@erudite-estate.com': 'Ahmad',
  'dari@erudite-estate.com': 'Dari',
  'tuiara@erudite-estate.com': 'Tuiara',
  'malik@erudite-estate.com': 'Malik',
};

// Low-opacity tint per agent — layered over the dark card base (~7% opacity)
const AGENT_TINT = {
  'ahmad@erudite-estate.com': 'rgba(59, 130, 246, 0.07)',
  'dari@erudite-estate.com':  'rgba(16, 185, 129, 0.07)',
  'tuiara@erudite-estate.com':'rgba(139, 92, 246, 0.07)',
  'malik@erudite-estate.com': 'rgba(245, 158, 11, 0.07)',
};

// Deterministic badge color per agent (hash-based for unknown emails)
const AGENT_BADGE_COLORS = {
  'ahmad@erudite-estate.com': { bg: 'rgba(59,130,246,0.18)', color: '#93c5fd', border: 'rgba(59,130,246,0.35)' },
  'dari@erudite-estate.com':  { bg: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: 'rgba(16,185,129,0.35)' },
  'tuiara@erudite-estate.com':{ bg: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: 'rgba(139,92,246,0.35)' },
  'malik@erudite-estate.com': { bg: 'rgba(244,63,94,0.18)',  color: '#fda4af', border: 'rgba(244,63,94,0.35)' },
};

const HASH_PALETTES = [
  { bg: 'rgba(6,182,212,0.18)',   color: '#67e8f9', border: 'rgba(6,182,212,0.35)' },
  { bg: 'rgba(234,179,8,0.18)',   color: '#fde68a', border: 'rgba(234,179,8,0.35)' },
  { bg: 'rgba(249,115,22,0.18)',  color: '#fdba74', border: 'rgba(249,115,22,0.35)' },
  { bg: 'rgba(168,85,247,0.18)',  color: '#d8b4fe', border: 'rgba(168,85,247,0.35)' },
  { bg: 'rgba(236,72,153,0.18)',  color: '#f9a8d4', border: 'rgba(236,72,153,0.35)' },
];

function hashEmail(email) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return h;
}

function agentBadgeStyle(email) {
  if (!email) return { bg: 'rgba(148,163,184,0.12)', color: 'rgba(255,255,255,0.4)', border: 'rgba(148,163,184,0.2)' };
  return AGENT_BADGE_COLORS[email] || HASH_PALETTES[hashEmail(email) % HASH_PALETTES.length];
}

function cardStyle(email, anonymous) {
  const tint = AGENT_TINT[email];
  const base = 'rgba(255,255,255,0.06)';
  const bg = tint || base;
  const border = anonymous
    ? '1px solid rgba(245,158,11,0.35)'
    : '1px solid rgba(255,255,255,0.1)';
  return { background: bg, border };
}

function agentLabel(email) {
  return AGENT_NAMES[email] || email?.split('@')[0] || 'Unknown';
}

export default function PropertyFinderLeads() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['pf-leads'],
    queryFn: () => base44.entities.Lead.filter({ source: 'property_finder' }, '-created_date', 300),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const agentEmails = useMemo(() => {
    const emails = [...new Set(leads.map(l => l.assigned_agent_email).filter(Boolean))];
    return emails;
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter(lead => {
      if (agentFilter !== 'all' && lead.assigned_agent_email !== agentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          lead.full_name?.toLowerCase().includes(q) ||
          lead.phone?.includes(q) ||
          lead.notes?.toLowerCase().includes(q) ||
          lead.closing_property_ref?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, agentFilter, search]);

  const assignMutation = useMutation({
    mutationFn: ({ id, email }) => base44.entities.Lead.update(id, { assigned_agent_email: email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pf-leads'] }),
    onError: () => toast.error('Failed to reassign lead'),
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

  const isAnonymous = (lead) => lead.full_name === 'Ahmad Erudite Property';

  const getListingRef = (lead) => lead.closing_property_ref || '';

  const getRespondLink = (lead) => {
    const match = lead.notes?.match(/respond:(\S+)/);
    return match ? match[1] : null;
  };

  return (
    <EruditePage>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
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

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: leads.length, icon: Users, color: 'text-white' },
            { label: 'Today', value: leads.filter(l => new Date(l.created_date).toDateString() === new Date().toDateString()).length, icon: Clock, color: 'text-amber-400' },
            { label: 'Assigned', value: leads.filter(l => l.assigned_agent_email).length, icon: UserCheck, color: 'text-emerald-400' },
            { label: 'Anonymous', value: leads.filter(isAnonymous).length, icon: Users, color: 'text-rose-400' },
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, listing ref…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-44">
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

        {/* Lead Cards */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No leads found</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(lead => {
              const anonymous = isAnonymous(lead);
              const listingRef = getListingRef(lead);
              const respondLink = getRespondLink(lead);
              return (
                <Card key={lead.id} className="glass-card p-4 space-y-3" style={cardStyle(lead.assigned_agent_email, anonymous)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white/90">
                        {anonymous ? (
                          <span className="text-rose-400 italic">Anonymous buyer</span>
                        ) : lead.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(lead.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    {/* Agent badge — deterministic color per agent */}
                    {(() => {
                      const s = agentBadgeStyle(lead.assigned_agent_email);
                      return (
                        <span
                          className="whitespace-nowrap text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                        >
                          {agentLabel(lead.assigned_agent_email)}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Contact */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {lead.phone && <span>{lead.phone}</span>}
                    {listingRef && (
                      <span className="text-amber-400/80">📋 {listingRef}</span>
                    )}
                  </div>

                  {/* Notes preview */}
                  {lead.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{lead.notes}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* WhatsApp */}
                    {lead.phone && (
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{ background: 'rgba(37,211,102,0.18)', border: '1px solid rgba(37,211,102,0.35)' }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D166' }} />
                      </a>
                    )}
                    {/* Call */}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        title="Call"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{ background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)' }}
                      >
                        <Phone className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} />
                      </a>
                    )}
                    {/* Email */}
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        title="Email"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                        style={{ background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.35)' }}
                      >
                        <Mail className="w-3.5 h-3.5" style={{ color: '#c084fc' }} />
                      </a>
                    ) : (
                      <span
                        title="No email"
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-30 cursor-not-allowed"
                        style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' }}
                      >
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    )}

                    {/* Assign dropdown */}
                    <Select
                      value={lead.assigned_agent_email || ''}
                      onValueChange={email => assignMutation.mutate({ id: lead.id, email })}
                    >
                      <SelectTrigger className="h-7 text-xs w-28 bg-white/5 border-white/10">
                        <SelectValue placeholder="Assign…" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AGENT_NAMES).map(([email, name]) => (
                          <SelectItem key={email} value={email}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Respond on PF */}
                    {anonymous && respondLink && (
                      <a href={respondLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          Respond on PF
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => { if (confirm('Delete this lead?')) deleteMutation.mutate(lead.id); }}
                      title="Delete lead"
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 ml-auto"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#f87171' }} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </EruditePage>
  );
}