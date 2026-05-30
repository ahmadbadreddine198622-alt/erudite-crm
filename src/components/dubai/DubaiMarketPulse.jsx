import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, TrendingUp, DollarSign, Home } from 'lucide-react';
import { format } from 'date-fns';

const COMMUNITY_COLORS = {
  'Downtown Dubai': 'text-amber-500',
  'Dubai Marina': 'text-blue-500',
  'Palm Jumeirah': 'text-purple-500',
  'Business Bay': 'text-emerald-500',
  'JBR': 'text-sky-500',
  'Dubai Hills Estate': 'text-green-500',
  'Arabian Ranches': 'text-orange-500',
  'JVC': 'text-rose-500',
};

export default function DubaiMarketPulse() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-market-pulse'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-market-pulse'],
    queryFn: () => base44.entities.Property.list('-created_date', 100),
  });

  const marketStats = React.useMemo(() => {
    const communityData = {};
    
    leads.forEach(lead => {
      lead.preferred_locations?.forEach(location => {
        if (!communityData[location]) {
          communityData[location] = { demand: 0, budget: 0, count: 0 };
        }
        communityData[location].demand++;
        communityData[location].budget += (lead.budget_max || 0);
        communityData[location].count++;
      });
    });

    // Calculate averages
    Object.keys(communityData).forEach(key => {
      communityData[key].avgBudget = Math.round(communityData[key].budget / communityData[key].count);
    });

    // Sort by demand
    const topCommunities = Object.entries(communityData)
      .sort(([,a], [,b]) => b.demand - a.demand)
      .slice(0, 5)
      .map(([community, data]) => ({ community, ...data }));

    // Property stats
    const totalListings = properties.length;
    const avgPrice = properties.length > 0 
      ? Math.round(properties.reduce((sum, p) => sum + (p.price_aed || 0), 0) / properties.length)
      : 0;
    const underOffer = properties.filter(p => p.status === 'under_offer').length;
    const sold = properties.filter(p => p.status === 'sold' || p.status === 'rented').length;

    // Lead intent breakdown
    const buyers = leads.filter(l => l.intent === 'buyer').length;
    const tenants = leads.filter(l => l.intent === 'tenant').length;
    const investors = leads.filter(l => l.transaction_type === 'investment').length;

    return {
      topCommunities,
      totalListings,
      avgPrice,
      underOffer,
      sold,
      buyers,
      tenants,
      investors,
      totalLeads: leads.length,
    };
  }, [leads, properties]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(245,159,10,0.15)',
              border: '1px solid rgba(245,159,10,0.3)',
            }}
          >
            <TrendingUp className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Dubai Market Pulse</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Real-time market intelligence</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Home className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Active Listings</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{marketStats.totalListings}</p>
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Avg Price</span>
          </div>
          <p className="text-lg font-bold text-blue-500">AED {(marketStats.avgPrice / 1000000).toFixed(1)}M</p>
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'rgba(245,159,10,0.1)', border: '1px solid rgba(245,159,10,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Under Offer</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{marketStats.underOffer}</p>
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Leads</span>
          </div>
          <p className="text-2xl font-bold text-purple-500">{marketStats.totalLeads}</p>
        </div>
      </div>

      {/* Top Communities */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.8)' }}>🔥 Hottest Communities (By Demand)</h3>
        <div className="space-y-3">
          {marketStats.topCommunities.map((item, i) => (
            <div key={item.community} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                  <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.95)' }}>{item.community}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.demand} buyers • Avg AED {(item.avgBudget / 1000000).toFixed(1)}M</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{item.count} leads</p>
              </div>
            </div>
          ))}
          {marketStats.topCommunities.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>No community data yet</p>
          )}
        </div>
      </div>

      {/* Lead Intent Breakdown */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,2555,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.8)' }}>📊 Lead Intent Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <p className="text-2xl font-bold text-emerald-500">{marketStats.buyers}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Buyers</p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
            <p className="text-2xl font-bold text-blue-500">{marketStats.tenants}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Tenants</p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(245,159,10,0.1)' }}>
            <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{marketStats.investors}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Investors</p>
          </div>
        </div>
      </div>
    </div>
  );
}