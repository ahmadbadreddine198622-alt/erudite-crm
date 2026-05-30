import React, { useState, useMemo } from 'react';
import { Brain, Target, TrendingUp, AlertTriangle, CheckCircle, DollarSign, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function AIDealPredictor() {
  const [selectedDeal, setSelectedDeal] = useState(null);

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-predictor'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 200),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-predictor'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 200),
  });

  const predictions = useMemo(() => {
    const now = new Date();

    return deals
      .filter(d => ['negotiation', 'offer_made', 'closing', 'dld_process'].includes(d.stage))
      .map(deal => {
        const lead = leads.find(l => l.id === deal.lead_id);
        
        const daysSinceActivity = deal.last_activity_at ? 
          Math.floor((now - new Date(deal.last_activity_at)) / (1000 * 60 * 60 * 24)) : 999;

        const dealAge = deal.created_date ? 
          Math.floor((now - new Date(deal.created_date)) / (1000 * 60 * 60 * 24)) : 0;

        let score = 50;

        const stageBonus = {
          negotiation: 10,
          offer_made: 25,
          closing: 40,
          dld_process: 60,
        };
        score += stageBonus[deal.stage] || 0;

        if (daysSinceActivity > 14) score -= 30;
        else if (daysSinceActivity > 7) score -= 15;
        else if (daysSinceActivity < 2) score += 10;

        if (lead?.ai_lead_score) {
          score += (lead.ai_lead_score - 50) * 0.3;
        }

        if (deal.value_aed && deal.value_aed > 10000000) score -= 5;

        if (deal.expected_close_date) {
          const daysToClose = Math.floor((new Date(deal.expected_close_date) - now) / (1000 * 60 * 60 * 24));
          if (daysToClose < 7) score += 15;
          else if (daysToClose > 60) score -= 10;
        }

        score = Math.max(0, Math.min(100, score));

        const riskFactors = [];
        if (daysSinceActivity > 7) riskFactors.push('No recent activity');
        if (dealAge > 60 && deal.stage === 'negotiation') riskFactors.push('Stuck in negotiation');
        if (!deal.expected_close_date) riskFactors.push('No close date set');
        if (lead?.status === 'on_hold') riskFactors.push('Lead on hold');

        const recommendations = [];
        if (daysSinceActivity > 5) recommendations.push('Schedule follow-up call');
        if (!deal.expected_close_date) recommendations.push('Set expected close date');
        if (deal.stage === 'offer_made' && daysSinceActivity > 3) recommendations.push('Follow up on offer');
        if (riskFactors.length > 2) recommendations.push('Escalate to manager');

        return {
          ...deal,
          lead_name: lead?.full_name || 'Unnamed',
          ai_score: Math.round(score),
          daysSinceActivity,
          dealAge,
          riskFactors,
          recommendations,
          probability: score,
        };
      })
      .sort((a, b) => b.ai_score - a.ai_score);
  }, [deals, leads]);

  const highProbability = predictions.filter(p => p.ai_score >= 70);
  const mediumProbability = predictions.filter(p => p.ai_score >= 40 && p.ai_score < 70);
  const lowProbability = predictions.filter(p => p.ai_score < 40);

  const totalPipelineValue = predictions.reduce((sum, p) => sum + (p.value_aed || 0), 0);
  const weightedValue = predictions.reduce((sum, p) => sum + ((p.value_aed || 0) * (p.ai_score / 100)), 0);

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score) => {
    if (score >= 70) return 'bg-emerald-500/20 border-emerald-500/50';
    if (score >= 40) return 'bg-amber-500/20 border-amber-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,159,10,0.15)', border: '1px solid rgba(245,159,10,0.3)' }}
          >
            <Brain className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>AI Deal Predictor</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Close probability and risk analysis</p>
          </div>
        </div>
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
          {predictions.length} Active Deals
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-2xl font-bold text-emerald-500">{highProbability.length}</p>
          <p className="text-xs text-emerald-500/60">High Probability (70%+)</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{mediumProbability.length}</p>
          <p className="text-xs" style={{ color: 'hsl(38 92% 50% / 60%)' }}>Medium (40-70%)</p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-2xl font-bold text-red-500">{lowProbability.length}</p>
          <p className="text-xs text-red-500/60">Low (under 40%)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Total Pipeline</p>
            <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              AED {(totalPipelineValue / 1000000).toFixed(1)}M
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <p className="text-xs mb-1" style={{ color: 'hsl(38 92% 50% / 60%)' }}>Weighted Value</p>
            <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
              AED {(weightedValue / 1000000).toFixed(1)}M
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {highProbability.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-emerald-500">High Probability Deals</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {highProbability.map((deal) => (
                <Card
                  key={deal.id}
                  className="bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
                          {deal.lead_name}
                        </p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          AED {(deal.value_aed / 1000000).toFixed(1)}M - {deal.stage}
                        </p>
                      </div>
                      <Badge className={`${getScoreBg(deal.ai_score)} ${getScoreColor(deal.ai_score)}`}>
                        {deal.ai_score}%
                      </Badge>
                    </div>
                    <Progress value={deal.ai_score} className="h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {mediumProbability.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>Medium Probability</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mediumProbability.slice(0, 4).map((deal) => (
                <Card
                  key={deal.id}
                  className="bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
                          {deal.lead_name}
                        </p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          AED {(deal.value_aed / 1000000).toFixed(1)}M
                        </p>
                      </div>
                      <Badge className={`${getScoreBg(deal.ai_score)} ${getScoreColor(deal.ai_score)}`}>
                        {deal.ai_score}%
                      </Badge>
                    </div>
                    <Progress value={deal.ai_score} className="h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {lowProbability.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-500">At Risk Deals</h3>
            </div>
            <div className="space-y-2">
              {lowProbability.map((deal) => (
                <Card
                  key={deal.id}
                  className="bg-red-500/5 border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                          {deal.lead_name}
                        </p>
                        <p className="text-xs text-red-500/70">
                          {deal.riskFactors.slice(0, 2).join(' - ')}
                        </p>
                      </div>
                      <Badge className="bg-red-500/20 text-red-500 border-red-500/50">
                        {deal.ai_score}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedDeal && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                Deal Analysis - {selectedDeal.lead_name}
              </h3>
              <Button size="sm" variant="outline" onClick={() => setSelectedDeal(null)}>Close</Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-xs text-white/50 mb-1">Value</p>
                <p className="font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>
                  AED {(selectedDeal.value_aed / 1000000).toFixed(2)}M
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Stage</p>
                <p className="font-semibold">{selectedDeal.stage}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Last Contact</p>
                <p className={`font-semibold ${selectedDeal.daysSinceActivity > 7 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {selectedDeal.daysSinceActivity} days ago
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">AI Score</p>
                <p className={`font-bold ${getScoreColor(selectedDeal.ai_score)}`}>
                  {selectedDeal.ai_score}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Risk Factors
                </h4>
                <div className="space-y-2">
                  {selectedDeal.riskFactors.length > 0 ? (
                    selectedDeal.riskFactors.map((risk, i) => (
                      <div key={i} className="text-sm p-2 rounded bg-red-500/10 text-red-500">
                        - {risk}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-emerald-500">No significant risks identified</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <Target className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
                  Recommended Actions
                </h4>
                <div className="space-y-2">
                  {selectedDeal.recommendations.map((rec, i) => (
                    <div key={i} className="text-sm p-2 rounded bg-amber-500/10" style={{ color: 'hsl(38 92% 50%)' }}>
                      - {rec}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}