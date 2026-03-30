import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

export default function LeadScoreCard({ score, conversation }) {
  if (!score) return null;

  const { overall_score, breakdown, trend, risk_factors } = score;

  const getScoreColor = (score) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score) => {
    if (score >= 85) return 'Hot Lead';
    if (score >= 60) return 'Warm Lead';
    if (score >= 30) return 'Cold Lead';
    return 'Dormant';
  };

  const getTrendIcon = () => {
    if (trend === 'increasing') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'decreasing') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">LEAD SCORE</span>
        {getTrendIcon()}
      </div>

      <div className="flex items-center gap-3">
        <div className={`${getScoreColor(overall_score)} rounded-full h-12 w-12 flex items-center justify-center text-white font-bold`}>
          {overall_score}
        </div>
        <div>
          <p className="font-semibold text-sm">{getScoreLabel(overall_score)}</p>
          <p className="text-xs text-muted-foreground capitalize">{trend} trend</p>
        </div>
      </div>

      <div className="space-y-1 text-xs pt-2 border-t">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Engagement</span>
          <span className="font-medium">{breakdown?.engagement_score || 0}/25</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Intent</span>
          <span className="font-medium">{breakdown?.intent_score || 0}/25</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sentiment</span>
          <span className="font-medium">{breakdown?.sentiment_score || 0}/20</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Budget Fit</span>
          <span className="font-medium">{breakdown?.budget_alignment_score || 0}/15</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Property Fit</span>
          <span className="font-medium">{breakdown?.property_fit_score || 0}/15</span>
        </div>
      </div>

      {risk_factors?.length > 0 && (
        <div className="pt-2 border-t space-y-1">
          <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <AlertCircle className="w-3 h-3" /> Risk Factors
          </div>
          <div className="space-y-1">
            {risk_factors.map((factor) => (
              <Badge key={factor} variant="outline" className="text-[10px] bg-amber-500/5">
                {factor.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}