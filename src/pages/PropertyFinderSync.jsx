import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertCircle, Users, ArrowUpCircle, PlusCircle, Clock } from 'lucide-react';
import moment from 'moment';

export default function PropertyFinderSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: pfLeads = [], isLoading } = useQuery({
    queryKey: ['pf-leads'],
    queryFn: () => base44.entities.Lead.filter({ source: 'property_finder' }, '-created_date', 100),
  });

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('propertyFinderSync', { mode: 'sync' });
      setLastResult(res.data);
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Property Finder Integration</h1>
          <p className="text-muted-foreground mt-1">Sync leads from PropertyFinder into your CRM automatically</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* Result Banner */}
      {lastResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 flex items-center gap-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex gap-6 text-sm">
              <span><strong className="text-green-700">{lastResult.total}</strong> total from PF</span>
              <span><strong className="text-blue-700">{lastResult.created}</strong> new leads created</span>
              <span><strong className="text-orange-700">{lastResult.updated}</strong> leads updated</span>
              {lastResult.errors > 0 && <span><strong className="text-red-700">{lastResult.errors}</strong> errors</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Users className="w-4 h-4 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{pfLeads.length}</p>
                <p className="text-xs text-muted-foreground">Total PF Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><PlusCircle className="w-4 h-4 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{pfLeads.filter(l => l.stage === 'new_lead').length}</p>
                <p className="text-xs text-muted-foreground">New / Untouched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><ArrowUpCircle className="w-4 h-4 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{pfLeads.filter(l => ['negotiation','offer_made'].includes(l.stage)).length}</p>
                <p className="text-xs text-muted-foreground">In Negotiation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{pfLeads.filter(l => l.stage === 'closed_won').length}</p>
                <p className="text-xs text-muted-foreground">Closed Won</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-sync note */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Auto-sync is active</p>
            <p className="text-muted-foreground">Leads are automatically pulled from PropertyFinder every hour. New leads are created in your CRM and existing ones are kept in sync.</p>
          </div>
        </CardContent>
      </Card>

      {/* Lead Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PropertyFinder Leads ({pfLeads.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : pfLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No leads synced yet. Click <strong>Sync Now</strong> to import leads from PropertyFinder.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Listing</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Stage</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Synced</th>
                  </tr>
                </thead>
                <tbody>
                  {pfLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{lead.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lead.phone || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{lead.email || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                        {(lead.source_metadata && lead.source_metadata.listing_title) ? lead.source_metadata.listing_title : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[lead.stage] || 'bg-gray-100 text-gray-600'}`}>
                          {(lead.stage || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{moment(lead.created_date).fromNow()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}