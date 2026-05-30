import React, { useState, useMemo } from 'react';
import { Brain, Target, DollarSign, MessageCircle, Phone, Mail, Calendar, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function DealRoom() {
  const [selectedDeal, setSelectedDeal] = useState(null);

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-room'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 50),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-room'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 100),
  });

  const activeDeals = useMemo(() => {
    return deals
      .filter(d => ['negotiation', 'offer_made', 'closing', 'dld_process'].includes(d.stage))
      .sort((a, b) => (b.value_aed || 0) - (a.value_aed || 0));
  }, [deals]);

  const dealMetrics = useMemo(() => {
    const totalValue = activeDeals.reduce((sum, d) => sum + (d.value_aed || 0), 0);
    const avgDealSize = activeDeals.length > 0 ? totalValue / activeDeals.length : 0;
    const closingThisMonth = deals.filter(d => 
      d.stage === 'closed_won' && 
      d.updated_date?.startsWith(new Date().toISOString().slice(0, 7))
    ).length;
    const atRisk = activeDeals.filter(d => {
      const daysSince = d.last_activity_at ? 
        Math.floor((new Date() - new Date(d.last_activity_at)) / (1000 * 60 * 60 * 24)) : 999;
      return daysSince > 7;
    }).length;

    return { totalValue, avgDealSize, closingThisMonth, atRisk };
  }, [activeDeals, deals]);

  const getStageColor = (stage) => {
    switch (stage) {
      case 'negotiation': return 'bg-amber-500/20 text-amber-500 border-amber-500/50';
      case 'offer_made': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'closing': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50';
      case 'dld_process': return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
      default: return 'bg-slate-500/20 text-slate-500 border-slate-500/50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,159,10,0.15)', border: '1px solid rgba(245,159,10,0.3)' }}
          >
            <Brain className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Deal War Room</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Active negotiations and closing pipeline</p>
          </div>
        </div>
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
          {activeDeals.length} Active Deals
        </Badge>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-2xl font-bold text-emerald-500">AED {(dealMetrics.totalValue / 1000000).toFixed(1)}M</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Pipeline Value</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="text-xl font-bold text-blue-500">AED {(dealMetrics.avgDealSize / 1000000).toFixed(1)}M</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Avg Deal Size</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{dealMetrics.closingThisMonth}</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Closed This Month</p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-2xl font-bold text-red-500">{dealMetrics.atRisk}</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>At Risk</p>
        </div>
      </div>

      {/* Active Deals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {activeDeals.slice(0, 6).map((deal) => {
          const daysSince = deal.last_activity_at ? 
            Math.floor((new Date() - new Date(deal.last_activity_at)) / (1000 * 60 * 60 * 24)) : 999;
          const lead = leads.find(l => l.id === deal.lead_id);
          
          return (
            <Card
              key={deal.id}
              className="bg-white/5 border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => setSelectedDeal(deal)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
                      {lead?.full_name || deal.lead_name || 'Unnamed Deal'}
                    </h3>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {deal.property_interest || 'Property not specified'}
                    </p>
                  </div>
                  <Badge className={getStageColor(deal.stage)}>{deal.stage.replace('_', ' ').toUpperCase()}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-white/50 mb-1">Value</p>
                    <p className="font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>
                      AED {(deal.value_aed / 1000000).toFixed(1)}M
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1">Commission</p>
                    <p className="font-semibold">
                      AED {((deal.value_aed || 0) * 0.02 / 1000000).toFixed(2)}M
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1">Last Contact</p>
                    <p className={`font-semibold ${daysSince > 5 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {daysSince}d ago
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Close Probability</span>
                    <span style={{ color: 'hsl(38 92% 50%)' }}>{deal.close_probability || 50}%</span>
                  </div>
                  <Progress value={deal.close_probability || 50} className="h-2" />
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-8 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                    <Phone className="w-3 h-3 mr-1" />
                    Call
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    Meeting
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Deal Detail Panel */}
      {selectedDeal && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(245,159,10,0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              Deal Details — {selectedDeal.lead_name || 'Unnamed'}
            </h3>
            <Button size="sm" variant="outline" onClick={() => setSelectedDeal(null)}>Close</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-white/50 mb-1">Deal Value</p>
              <p className="font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>AED {(selectedDeal.value_aed / 1000000).toFixed(2)}M</p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Stage</p>
              <p className="font-semibold">{selectedDeal.stage}</p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Expected Close</p>
              <p className="font-semibold">{selectedDeal.expected_close_date || 'TBD'}</p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Commission</p>
              <p className="font-semibold">AED {((selectedDeal.value_aed || 0) * 0.02).toLocaleString()}</p>
            </div>
          </div>

          {/* Action Plan */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>Closing Action Plan</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button className="h-12 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30">
                <Target className="w-4 h-4 mr-2 text-amber-500" />
                Send Offer
              </Button>
              <Button className="h-12 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30">
                <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                Schedule Signing
              </Button>
              <Button className="h-12 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30">
                <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                DLD Booking
              </Button>
              <Button className="h-12 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30">
                <DollarSign className="w-4 h-4 mr-2 text-purple-500" />
                Mortgage Coordination
              </Button>
              <Button className="h-12 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30">
                <AlertTriangle className="w-4 h-4 mr-2 text-pink-500" />
                Address Objections
              </Button>
              <Button className="h-12 bg-slate-600/20 hover:bg-slate-600/30 border border-slate-500/30">
                <TrendingUp className="w-4 h-4 mr-2 text-slate-400" />
                Update Probability
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}