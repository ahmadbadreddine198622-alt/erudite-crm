import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, ChevronRight, Phone, MessageCircle, Mail, Users, Building2 } from 'lucide-react';
import moment from 'moment';

const channelIcon = {
  call: <Phone className="w-3 h-3" />,
  whatsapp: <MessageCircle className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
};
const channelColor = {
  call: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  email: 'bg-purple-100 text-purple-700',
  unknown: 'bg-gray-100 text-gray-600',
};
const stageColors = {
  new_lead: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  viewing_scheduled: 'bg-purple-100 text-purple-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
};

export default function PFByListingTab({ leads, channelConfig }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  // Group leads by listing reference
  const groups = leads.reduce((acc, lead) => {
    const meta = lead.source_metadata || {};
    const ref = meta.listing_reference || meta.listing_id || 'No Listing';
    if (!acc[ref]) acc[ref] = { ref, leads: [] };
    acc[ref].leads.push(lead);
    return acc;
  }, {});

  // Sort groups by lead count desc
  const sorted = Object.values(groups).sort((a, b) => b.leads.length - a.leads.length);

  const filtered = sorted.filter(g => {
    if (!search) return true;
    return g.ref.toLowerCase().includes(search.toLowerCase());
  });

  function toggle(ref) {
    setExpanded(prev => ({ ...prev, [ref]: !prev[ref] }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search listing reference..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground">{filtered.length} listings · {leads.length} total leads</p>
      </div>

      <div className="space-y-3">
        {filtered.map(group => {
          const isOpen = expanded[group.ref];
          const channelBreakdown = group.leads.reduce((acc, l) => {
            const ch = (l.source_metadata && l.source_metadata.channel) ? l.source_metadata.channel : 'unknown';
            acc[ch] = (acc[ch] || 0) + 1;
            return acc;
          }, {});

          return (
            <Card key={group.ref} className="overflow-hidden">
              <button
                className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                onClick={() => toggle(group.ref)}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold font-mono text-sm">{group.ref}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.entries(channelBreakdown).map(([ch, cnt]) => (
                      <span key={ch} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channelColor[ch] || channelColor.unknown}`}>
                        {channelIcon[ch] || <Users className="w-3 h-3" />}{cnt}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold">{group.leads.length} <span className="font-normal text-muted-foreground">lead{group.leads.length !== 1 ? 's' : ''}</span></span>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <CardContent className="p-0 border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Name</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Channel</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Contact</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Stage</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.leads.map(lead => {
                        const meta = lead.source_metadata || {};
                        const ch = meta.channel || 'unknown';
                        return (
                          <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className="font-medium">{lead.name}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${channelColor[ch] || channelColor.unknown}`}>
                                {channelIcon[ch] || <Users className="w-3 h-3" />}{ch}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{lead.phone || lead.email || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[lead.stage] || 'bg-gray-100 text-gray-600'}`}>
                                {(lead.stage || 'new_lead').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {meta.pf_created_at ? moment(meta.pf_created_at).fromNow() : moment(lead.created_date).fromNow()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}