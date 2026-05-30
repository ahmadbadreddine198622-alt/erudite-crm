import React, { useState, useMemo } from 'react';
import { Building2, MapPin, TrendingUp, DollarSign, Home, Layers, ArrowUpRight, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function MarketIntelligence() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState(null);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-market'],
    queryFn: () => base44.entities.Property.list('-updated_date', 500),
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-market'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 500),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-market'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 500),
  });

  const marketData = useMemo(() => {
    const communityStats = {};

    properties.forEach(prop => {
      const community = prop.location || 'Unknown';
      
      if (!communityStats[community]) {
        communityStats[community] = {
          community,
          listings: 0,
          avgPrice: 0,
          avgPricePerSqft: 0,
          totalValue: 0,
          propertyTypes: {},
          prices: [],
        };
      }

      communityStats[community].listings++;
      communityStats[community].totalValue += prop.price_aed || 0;
      communityStats[community].prices.push(prop.price_aed || 0);

      const type = prop.property_type || 'other';
      communityStats[community].propertyTypes[type] = (communityStats[community].propertyTypes[type] || 0) + 1;
    });

    Object.values(communityStats).forEach(stat => {
      if (stat.listings > 0) {
        stat.avgPrice = stat.totalValue / stat.listings;
        stat.avgPricePerSqft = stat.avgPrice / 1500;
      }
    });

    const communities = Object.values(communityStats)
      .filter(c => c.listings > 0)
      .sort((a, b) => b.totalValue - a.totalValue);

    const priceRanges = {
      'Under 1M': 0,
      '1M - 2M': 0,
      '2M - 5M': 0,
      '5M - 10M': 0,
      '10M+': 0,
    };

    properties.forEach(prop => {
      const price = prop.price_aed || 0;
      if (price < 1000000) priceRanges['Under 1M']++;
      else if (price < 2000000) priceRanges['1M - 2M']++;
      else if (price < 5000000) priceRanges['2M - 5M']++;
      else if (price < 10000000) priceRanges['5M - 10M']++;
      else priceRanges['10M+']++;
    });

    const typeDistribution = {};
    properties.forEach(prop => {
      const type = prop.property_type || 'other';
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });

    const closedDeals = deals.filter(d => d.stage === 'closed_won').length;
    const activeListings = properties.filter(p => p.status === 'available').length;
    const absorptionRate = activeListings > 0 ? (closedDeals / activeListings) * 100 : 0;

    return {
      communities,
      priceRanges,
      typeDistribution,
      totalListings: properties.length,
      totalValue: properties.reduce((sum, p) => sum + (p.price_aed || 0), 0),
      closedDeals,
      activeListings,
      absorptionRate,
    };
  }, [properties, deals]);

  const filteredCommunities = marketData.communities.filter(c =>
    c.community.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const chartData = Object.entries(marketData.priceRanges).map(([range, count]) => ({
    range,
    count,
  }));

  const typeData = Object.entries(marketData.typeDistribution).map(([type, count]) => ({
    type: type.replace('_', ' ').toUpperCase(),
    count,
  }));

  const COLORS = ['hsl(38 92% 50%)', 'hsl(173 58% 39%)', 'hsl(197 37% 50%)', 'hsl(12 76% 61%)', 'hsl(280 65% 60%)'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,159,10,0.15)', border: '1px solid rgba(245,159,10,0.3)' }}
          >
            <TrendingUp className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Dubai Market Intelligence</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Live property trends and analytics</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search communities..."
            className="pl-10 bg-white/5 border-white/10 text-white"
          />
        </div>
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
          {marketData.totalListings} Listings
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-500">
              AED {(marketData.totalValue / 1000000000).toFixed(2)}B
            </p>
            <p className="text-xs text-emerald-500/60">Total Inventory Value</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-500">{marketData.activeListings}</p>
            <p className="text-xs text-blue-500/60">Active Listings</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{marketData.closedDeals}</p>
            <p className="text-xs" style={{ color: 'hsl(38 92% 50% / 60%)' }}>Deals Closed</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-500">{marketData.absorptionRate.toFixed(1)}%</p>
            <p className="text-xs text-purple-500/60">Absorption Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6">
            <h3 className="font-bold mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>Price Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="range" stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900/95 border border-white/10 rounded-lg p-3 shadow-xl">
                          <p className="text-xs text-white/70">{payload[0].payload.range}</p>
                          <p className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>
                            {payload[0].value} properties
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6">
            <h3 className="font-bold mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>Property Types</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="type" stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <h3 className="font-bold mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>Top Communities by Value</h3>
          <div className="space-y-3">
            {filteredCommunities.slice(0, 8).map((community, i) => (
              <div
                key={community.community}
                onClick={() => setSelectedCommunity(community)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                    <span className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>#{i + 1}</span>
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                      {community.community}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {community.listings} listings • AED {(community.avgPrice / 1000000).toFixed(2)}M avg
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
                    AED {(community.totalValue / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Total Value</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}