import React, { useState } from 'react';
import { Lock, Eye, EyeOff, DollarSign, Building2, TrendingUp, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function OffMarketExchange() {
  const [showDetails, setShowDetails] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const offMarketDeals = [
    {
      id: 1,
      type: 'pocket_listing',
      property: 'Penthouse, Downtown Dubai',
      price: 12500000,
      beds: 4,
      size: 4200,
      developer: 'Emaar',
      reason: 'Seller wants privacy',
      commission: 2.5,
      daysOld: 3,
      exclusive: true,
    },
    {
      id: 2,
      type: 'pre_launch',
      property: 'Beachfront Villa, Palm Jumeirah',
      price: 28000000,
      beds: 6,
      size: 8500,
      developer: 'Nakheel',
      reason: 'Developer pre-launch allocation',
      commission: 3,
      daysOld: 1,
      exclusive: true,
    },
    {
      id: 3,
      type: 'distressed',
      property: 'Full Floor, Business Bay',
      price: 8900000,
      beds: 3,
      size: 3100,
      developer: 'Damac',
      reason: 'Motivated seller - relocation',
      commission: 2,
      daysOld: 5,
      exclusive: false,
    },
    {
      id: 4,
      type: 'bulk_deal',
      property: '12 Units, JVC',
      price: 18000000,
      beds: 24,
      size: 18000,
      developer: 'Azizi',
      reason: 'Investor exiting portfolio',
      commission: 4,
      daysOld: 2,
      exclusive: true,
    },
  ];

  const filteredDeals = filterType === 'all' 
    ? offMarketDeals 
    : offMarketDeals.filter(d => d.type === filterType);

  const getTypeBadge = (type) => {
    switch (type) {
      case 'pocket_listing': return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">Pocket Listing</Badge>;
      case 'pre_launch': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">Pre-Launch</Badge>;
      case 'distressed': return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Distressed</Badge>;
      case 'bulk_deal': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Bulk Deal</Badge>;
      default: return <Badge>Off-Market</Badge>;
    }
  };

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
            <Lock className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Off-Market Exchange</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Exclusive pocket listings and pre-launch deals</p>
          </div>
        </div>
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
          {offMarketDeals.length} Exclusive Deals
        </Badge>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#080b12] border border-white/10">
            <SelectItem value="all" className="text-white hover:bg-white/10">All Deals</SelectItem>
            <SelectItem value="pocket_listing" className="text-white hover:bg-white/10">Pocket Listings</SelectItem>
            <SelectItem value="pre_launch" className="text-white hover:bg-white/10">Pre-Launch</SelectItem>
            <SelectItem value="distressed" className="text-white hover:bg-white/10">Distressed</SelectItem>
            <SelectItem value="bulk_deal" className="text-white hover:bg-white/10">Bulk Deals</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredDeals.map((deal) => (
          <div
            key={deal.id}
            className="rounded-xl p-5 border transition-all hover:scale-[1.01]"
            style={{
              background: deal.exclusive ? 'rgba(245,159,10,0.08)' : 'rgba(255,255,255,0.05)',
              border: deal.exclusive ? 'rgba(245,159,10,0.3)' : 'rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getTypeBadge(deal.type)}
                {deal.exclusive && (
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
                    <Lock className="w-3 h-3 mr-1" />
                    Exclusive
                  </Badge>
                )}
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{deal.daysOld}d old</p>
            </div>

            <h3 className="text-lg font-bold mb-2" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {deal.property}
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <p className="text-xs text-white/50 mb-1">Price</p>
                <p className="font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>AED {(deal.price / 1000000).toFixed(1)}M</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Beds</p>
                <p className="font-semibold">{deal.beds} BR</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Size</p>
                <p className="font-semibold">{deal.size.toLocaleString()} sqft</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{deal.developer}</span>
            </div>

            {/* Blurred Details */}
            {!showDetails ? (
              <div className="relative">
                <div className="blur-sm select-none">
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Reason: {deal.reason}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Commission: {deal.commission}%</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    onClick={() => setShowDetails(true)}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Reveal Details
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Reason: <span className="font-medium">{deal.reason}</span></p>
                  <Button size="sm" variant="ghost" onClick={() => setShowDetails(false)}>
                    <EyeOff className="w-3 h-3 mr-1" />
                    Hide
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>Commission: {deal.commission}%</span>
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    AED {(deal.price * deal.commission / 100).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Request Access
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Match Buyers
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Deal Button */}
      <div className="flex justify-center">
        <Button className="bg-amber-600 hover:bg-amber-700 h-12 px-8">
          <Lock className="w-5 h-5 mr-2" />
          Add Off-Market Deal
        </Button>
      </div>
    </div>
  );
}