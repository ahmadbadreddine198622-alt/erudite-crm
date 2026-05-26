import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, Users, Phone, MessageCircle, Mail, Clock, TrendingUp, UserCheck, Home, List } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import PFByListingTab from '@/components/propertyfinder/PFByListingTab';
import InsightsDashboard from '@/components/propertyfinder/InsightsDashboard';
import PFLeadsTab from '@/components/propertyfinder/PFLeadsTab';
import PFListingsTab from '@/components/propertyfinder/PFListingsTab';

const channelConfig = {
  call: { icon: Phone, color: 'bg-blue-100 text-blue-700', label: 'Calls' },
  whatsapp: { icon: MessageCircle, color: 'bg-green-100 text-green-700', label: 'WhatsApp' },
  email: { icon: Mail, color: 'bg-purple-100 text-purple-700', label: 'Email' },
  sms: { icon: Phone, color: 'bg-yellow-100 text-yellow-700', label: 'SMS' },
  form: { icon: Mail, color: 'bg-orange-100 text-orange-700', label: 'Form' },
  unknown: { icon: Users, color: 'bg-gray-100 text-gray-600', label: 'Other' },
};

export default function PropertyFinderSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const { data: pfLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['pf-leads'],
    queryFn: () => base44.entities.Lead.filter({ source: 'property_finder' }, '-created_date', 2000),
  });

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('propertyFinderSync', { mode: 'sync' });
      setLastResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['pf-leads'] });
      queryClient.invalidateQueries({ queryKey: ['pf-listings'] });
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const channelCounts = pfLeads.reduce((acc, lead) => {
    const ch = (lead.source_metadata && lead.source_metadata.channel) ? lead.source_metadata.channel : 'unknown';
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});

  const agentCounts = pfLeads.reduce((acc, lead) => {
    const agent = (lead.source_metadata && lead.source_metadata.pf_agent_name) ? lead.source_metadata.pf_agent_name : (lead.assigned_agent_name || 'Unassigned');
    acc[agent] = (acc[agent] || 0) + 1;
    return acc;
  }, {});

  const topChannels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Property Finder</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Live sync of leads and listings from your PropertyFinder account</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {lastResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-3 px-4 flex items-center gap-4 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-sm text-green-800 font-medium">Sync complete:</span>
            <span className="text-sm text-green-700"><strong>{lastResult.total}</strong> total</span>
            <span className="text-sm text-blue-700"><strong>{lastResult.created}</strong> new</span>
            <span className="text-sm text-orange-700"><strong>{lastResult.updated}</strong> updated</span>
            {lastResult.errors > 0 && <span className="text-sm text-red-700"><strong>{lastResult.errors}</strong> errors</span>}
          </CardContent>
        </Card>
      )}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Users className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{pfLeads.length}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {topChannels.map(([ch, count]) => {
          const cfg = channelConfig[ch] || channelConfig.unknown;
          const Icon = cfg.icon;
          const bgColor = cfg.color.split(' ')[0];
          const textColor = cfg.color.split(' ')[1];
          return (
            <Card key={ch}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bgColor}`}>
                    <Icon className={`w-4 h-4 ${textColor}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="w-4 h-4" /> Leads ({pfLeads.length})
          </TabsTrigger>
          <TabsTrigger value="listings" className="gap-2">
            <Home className="w-4 h-4" /> My Listings
          </TabsTrigger>
          <TabsTrigger value="by-listing" className="gap-2">
            <List className="w-4 h-4" /> By Listing
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <TrendingUp className="w-4 h-4" /> Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <PFLeadsTab leads={pfLeads} isLoading={leadsLoading} channelConfig={channelConfig} />
        </TabsContent>

        <TabsContent value="listings" className="mt-4">
          <PFListingsTab />
        </TabsContent>

        <TabsContent value="by-listing" className="mt-4">
          <PFByListingTab leads={pfLeads} channelConfig={channelConfig} />
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <InsightsDashboard pfLeads={pfLeads} channelCounts={channelCounts} agentCounts={agentCounts} channelConfig={channelConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}