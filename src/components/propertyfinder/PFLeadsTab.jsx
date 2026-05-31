import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Phone, MessageCircle, Mail, Search, Play } from 'lucide-react';
import moment from 'moment';

const stageColors = {
  new_lead: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  viewing_scheduled: 'bg-purple-100 text-purple-700',
  viewing_done: 'bg-indigo-100 text-indigo-700',
  negotiation: 'bg-orange-100 text-orange-700',
  offer_made: 'bg-amber-100 text-amber-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
};

const channelIcon = {
  call: <Phone className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
};
const channelColor = {
  call: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  email: 'bg-purple-100 text-purple-700',
};

export default function PFLeadsTab({ leads, isLoading, channelConfig }) {
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');

  const channels = ['all', ...new Set(leads.map(l => (l.source_metadata && l.source_metadata.channel) ? l.source_metadata.channel : 'unknown'))];

  const filtered = leads.filter(lead => {
    const ch = (lead.source_metadata && lead.source_metadata.channel) ? lead.source_metadata.channel : 'unknown';
    if (filterChannel !== 'all' && ch !== filterChannel) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (lead.full_name || lead.name || '').toLowerCase().includes(q) ||
        (lead.phone || '').includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        ((lead.source_metadata && lead.source_metadata.listing_reference) || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading leads...</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {channels.map(ch => {
            const cfg = channelConfig && channelConfig[ch];
            return (
              <button
                key={ch}
                onClick={() => setFilterChannel(ch)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filterChannel === ch ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {ch === 'all' ? 'All Channels' : (cfg ? cfg.label : ch)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No leads match your filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Channel</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Listing</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Agent</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Stage</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => {
                    const meta = lead.source_metadata || {};
                    const ch = meta.channel || 'unknown';
                    const chColor = channelColor[ch] || 'bg-gray-100 text-gray-600';
                    const chIcon = channelIcon[ch] || null;
                    return (
                      <tr key={lead.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{lead.full_name || lead.name || '—'}</div>
                          {meta.message && (
                            <div className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">"{meta.message}"</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${chColor}`}>
                            {chIcon}{ch === 'unknown' ? 'Portal' : ch}
                          </span>
                          {meta.call_recording && (
                            <a href={meta.call_recording} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline">
                              <Play className="w-3 h-3" /> Recording
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>{lead.phone || '—'}</div>
                          <div className="text-xs">{lead.email || ''}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                          {meta.listing_reference ? (
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{meta.listing_reference}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {meta.pf_agent_name || lead.assigned_agent_name || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[lead.stage] || 'bg-gray-100 text-gray-600'}`}>
                            {(lead.stage || 'new_lead').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {meta.pf_status ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.pf_status === 'replied' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {meta.pf_status}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {meta.pf_created_at ? moment(meta.pf_created_at).fromNow() : moment(lead.created_date).fromNow()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-right">Showing {filtered.length} of {leads.length} leads</p>
    </div>
  );
}