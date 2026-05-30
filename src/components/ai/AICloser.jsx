import React, { useState, useMemo } from 'react';
import { Brain, TrendingUp, Target, AlertTriangle, CheckCircle, MessageCircle, DollarSign, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function AICloser() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-ai-closer'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 50),
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-ai-closer'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 50),
  });

  const aiInsights = useMemo(() => {
    // Hot leads ready to close
    const hotLeads = leads
      .filter(l => 
        (l.ai_lead_score || 0) >= 80 && 
        ['negotiation_deal_lock', 'closing_dld', 'contract_cheques'].includes(l.stage)
      )
      .map(lead => ({
        type: 'hot_lead',
        lead,
        priority: 'high',
        action: `Contact ${lead.full_name} NOW - Score: ${lead.ai_lead_score}`,
        reasoning: lead.ai_rolling_summary?.substring(0, 150) || 'High score + advanced stage',
        script: `Hi ${lead.first_name || lead.full_name.split(' ')[0]}, I wanted to personally follow up on your interest. Based on our conversation, I believe we've found the perfect match. Are you ready to move forward?`,
      }));

    // At-risk deals
    const atRiskDeals = deals
      .filter(d => {
        const daysSinceContact = d.last_activity_at ? 
          Math.floor((new Date() - new Date(d.last_activity_at)) / (1000 * 60 * 60 * 24)) : 999;
        return daysSinceContact > 5 && d.status !== 'closed_won';
      })
      .map(deal => ({
        type: 'at_risk',
        deal,
        priority: 'urgent',
        action: `Re-engage ${deal.lead_name || 'lead'} - ${deal.days_since_contact || 7} days no contact`,
        reasoning: 'Deal going cold - immediate follow-up required',
        script: `Hi, I wanted to check in and see if you had any additional questions. The market is moving quickly, and I'd hate for you to miss this opportunity.`,
      }));

    // Negotiation opportunities
    const negotiationDeals = deals
      .filter(d => d.stage === 'negotiation' || d.stage === 'offer_made')
      .map(deal => ({
        type: 'negotiation',
        deal,
        priority: 'high',
        action: `Close ${deal.lead_name || 'deal'} - In negotiation`,
        reasoning: 'Active negotiation - push for commitment',
        script: `I understand you're considering the offer. Given the current market conditions and interest level, I'd recommend we move forward today to secure this property.`,
      }));

    // Upsell opportunities
    const upsellLeads = leads
      .filter(l => l.budget_max && l.budget_max > 3000000 && l.stage === 'unit_matching')
      .map(lead => ({
        type: 'upsell',
        lead,
        priority: 'medium',
        action: `Premium properties for ${lead.full_name} (Budget: AED ${(lead.budget_max / 1000000).toFixed(1)}M)`,
        reasoning: 'High-budget lead viewing mid-tier properties',
        script: `Based on your requirements and investment capacity, I'd like to show you some exclusive off-market opportunities that match your profile perfectly.`,
      }));

    return {
      hotLeads,
      atRiskDeals,
      negotiationDeals,
      upsellLeads,
      total: hotLeads.length + atRiskDeals.length + negotiationDeals.length + upsellLeads.length,
    };
  }, [leads, deals]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-500 border-red-500/50';
      case 'high': return 'bg-amber-500/20 text-amber-500 border-amber-500/50';
      case 'medium': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      default: return 'bg-slate-500/20 text-slate-500 border-slate-500/50';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'hot_lead': return <Target className="w-4 h-4" />;
      case 'at_risk': return <AlertTriangle className="w-4 h-4" />;
      case 'negotiation': return <Brain className="w-4 h-4" />;
      case 'upsell': return <DollarSign className="w-4 h-4" />;
      default: return <TrendingUp className="w-4 h-4" />;
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
            <Brain className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>AI Deal Closer</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Real-time closing intelligence</p>
          </div>
        </div>
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
          {aiInsights.total} Actions
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-2xl font-bold text-emerald-500">{aiInsights.hotLeads.length}</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Hot Leads</p>
        </div>
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-2xl font-bold text-red-500">{aiInsights.atRiskDeals.length}</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>At Risk</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{aiInsights.negotiationDeals.length}</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Negotiating</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="text-2xl font-bold text-blue-500">{aiInsights.upsellLeads.length}</p>
          <p className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Upsell</p>
        </div>
      </div>

      {/* Action Items */}
      <div className="space-y-3">
        {[...aiInsights.hotLeads, ...aiInsights.atRiskDeals, ...aiInsights.negotiationDeals, ...aiInsights.upsellLeads]
          .sort((a, b) => (b.priority === 'urgent' ? 1 : 0) - (a.priority === 'urgent' ? 1 : 0))
          .slice(0, 8)
          .map((item, i) => (
            <Card key={i} className="bg-white/5 border-white/10 hover:bg-white/10 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPriorityColor(item.priority)}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>{item.action}</p>
                        <Badge className={`text-[10px] ${getPriorityColor(item.priority)}`}>{item.priority.toUpperCase()}</Badge>
                      </div>
                      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.reasoning}</p>
                      
                      {/* AI Script */}
                      <div className="bg-black/30 rounded-lg p-3 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageCircle className="w-3 h-3" style={{ color: 'hsl(38 92% 50%)' }} />
                          <p className="text-[10px] font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>AI Suggested Script</p>
                        </div>
                        <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.75)' }}>"{item.script}"</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
                          <MessageCircle className="w-3 h-3 mr-1" />
                          WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Remind Me
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {aiInsights.total === 0 && (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>No actions right now - you're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}