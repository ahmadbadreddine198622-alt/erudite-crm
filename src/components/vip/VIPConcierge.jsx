import React, { useState, useMemo } from 'react';
import { Crown, Star, Heart, Phone, MessageCircle, Calendar, DollarSign, Gift } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function VIPConcierge() {
  const [selectedVIP, setSelectedVIP] = useState(null);
  const [note, setNote] = useState('');

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-vip'],
    queryFn: () => base44.entities.Lead.list('-created_date', 100),
  });

  const vipClients = React.useMemo(() => {
    return leads
      .filter(l => {
        const budget = l.budget_max || 0;
        const score = l.ai_lead_score || 0;
        return budget >= 5000000 || score >= 85 || l.tags?.includes('vip');
      })
      .sort((a, b) => (b.budget_max || 0) - (a.budget_max || 0))
      .slice(0, 10);
  }, [leads]);

  const getVIPLevel = (client) => {
    const budget = client.budget_max || 0;
    const score = client.ai_lead_score || 0;
    if (budget >= 10000000 || score >= 95) return { level: 'PLATINUM', color: 'text-amber-400', bg: 'bg-amber-500/20' };
    if (budget >= 5000000 || score >= 85) return { level: 'GOLD', color: 'text-yellow-500', bg: 'bg-yellow-500/20' };
    return { level: 'SILVER', color: 'text-slate-400', bg: 'bg-slate-500/20' };
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
            <Crown className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>VIP Concierge</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Ultra-luxury client management</p>
          </div>
        </div>
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
          {vipClients.length} VIP Clients
        </Badge>
      </div>

      {/* VIP Clients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {vipClients.map((client) => {
          const vipLevel = getVIPLevel(client);
          const daysSinceContact = client.last_activity_at ?
            Math.floor((new Date() - new Date(client.last_activity_at)) / (1000 * 60 * 60 * 24)) : 999;

          return (
            <div
              key={client.id}
              className="rounded-xl p-4 border transition-all hover:scale-[1.01] cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: selectedVIP?.id === client.id ? 'rgba(245,159,10,0.5)' : 'rgba(255,255,255,0.1)',
              }}
              onClick={() => setSelectedVIP(client)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${vipLevel.bg}`}>
                    <Crown className={`w-6 h-6 ${vipLevel.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{client.full_name}</h3>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Budget: AED {(client.budget_max / 1000000).toFixed(1)}M • {client.preferred_property_types?.[0] || 'Investor'}
                    </p>
                  </div>
                </div>
                <Badge className={`${vipLevel.bg} ${vipLevel.color} border-${vipLevel.color.split('-')[1]}-500/50`}>
                  {vipLevel.level}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-xs">
                  <p className="text-white/50 mb-1">Last Contact</p>
                  <p className={`font-semibold ${daysSinceContact > 7 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {daysSinceContact} days ago
                  </p>
                </div>
                <div className="text-xs">
                  <p className="text-white/50 mb-1">Lead Score</p>
                  <p className="font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>{client.ai_lead_score || 'N/A'}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                  <Phone className="w-3 h-3 mr-1" />
                  Call
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1">
                  <Gift className="w-3 h-3 mr-1" />
                  Gift
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* VIP Detail Panel */}
      {selectedVIP && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(245,159,10,0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {selectedVIP.full_name} — VIP Profile
            </h3>
            <Button size="sm" variant="outline" onClick={() => setSelectedVIP(null)}>Close</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-white/50 mb-1">Budget Range</p>
              <p className="font-semibold">AED {(selectedVIP.budget_min / 1000000).toFixed(1)}M - {(selectedVIP.budget_max / 1000000).toFixed(1)}M</p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Locations</p>
              <p className="font-semibold">{selectedVIP.preferred_locations?.slice(0, 2).join(', ') || 'Any'}</p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Timeline</p>
              <p className="font-semibold">{selectedVIP.move_in_timeline || 'Flexible'}</p>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Nationality</p>
              <p className="font-semibold">{selectedVIP.nationality || 'Not specified'}</p>
            </div>
          </div>

          {/* Concierge Actions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>VIP Concierge Actions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button className="h-12 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30">
                <Star className="w-4 h-4 mr-2 text-amber-500" />
                Schedule Private Viewing
              </Button>
              <Button className="h-12 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30">
                <DollarSign className="w-4 h-4 mr-2 text-emerald-500" />
                Arrange Mortgage
              </Button>
              <Button className="h-12 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30">
                <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                DLD Appointment
              </Button>
              <Button className="h-12 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30">
                <Heart className="w-4 h-4 mr-2 text-purple-500" />
                Send Property Shortlist
              </Button>
              <Button className="h-12 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30">
                <Gift className="w-4 h-4 mr-2 text-pink-500" />
                Corporate Gift
              </Button>
              <Button className="h-12 bg-slate-600/20 hover:bg-slate-600/30 border border-slate-500/30">
                <MessageCircle className="w-4 h-4 mr-2 text-slate-400" />
                Personal Note
              </Button>
            </div>
          </div>

          {/* Add Note */}
          <div className="mt-6 space-y-2">
            <Label className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>VIP Interaction Note</Label>
            <div className="flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a personal note about this VIP client..."
                className="bg-white/5 border-white/10 text-white flex-1"
              />
              <Button className="bg-amber-600 hover:bg-amber-700">Save Note</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}