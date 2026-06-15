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
import { RefreshCw, ExternalLink, Users, UserCheck, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';

const AGENT_NAMES = {
  'ahmad@erudite-estate.com': 'Ahmad',
  'dari@erudite-estate.com': 'Dari',
  'tuiara@erudite-estate.com': 'Tuiara',
  'malik@erudite-estate.com': 'Malik',
};

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
                <Card key={lead.id} className="glass-card p-4 space-y-3">
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
                    {/* Agent badge */}
                    <span className="jewel-pill jewel-gold whitespace-nowrap">
                      {agentLabel(lead.assigned_agent_email)}
                    </span>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Inline agent reassign */}
                    <Select
                      value={lead.assigned_agent_email || ''}
                      onValueChange={email => assignMutation.mutate({ id: lead.id, email })}
                    >
                      <SelectTrigger className="h-7 text-xs w-32 bg-white/5 border-white/10">
                        <SelectValue placeholder="Assign…" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AGENT_NAMES).map(([email, name]) => (
                          <SelectItem key={email} value={email}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {anonymous && respondLink && (
                      <a href={respondLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          Respond on PF
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                    )}
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