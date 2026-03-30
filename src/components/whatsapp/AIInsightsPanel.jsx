import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Brain, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const sentimentConfig = {
  positive: { label: 'Positive', color: 'text-green-600 bg-green-50 border-green-200' },
  neutral:  { label: 'Neutral',  color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  negative: { label: 'Negative', color: 'text-red-600 bg-red-50 border-red-200' },
  unknown:  { label: 'Unknown',  color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

const urgencyConfig = {
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 font-bold' },
};

export default function AIInsightsPanel({ conv, lead }) {
  if (!conv) return null;

  const hasInsights = conv.ai_summary || conv.ai_intent;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" />
        <h3 className="font-semibold text-sm">AI Insights</h3>
      </div>

      {!hasInsights ? (
        <p className="text-xs text-muted-foreground italic">
          No analysis yet. Click "Re-analyse" to generate insights.
        </p>
      ) : (
        <>
          {/* Sentiment + Urgency row */}
          <div className="flex gap-2 flex-wrap">
            {conv.ai_sentiment && (
              <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', sentimentConfig[conv.ai_sentiment]?.color)}>
                {sentimentConfig[conv.ai_sentiment]?.label}
              </span>
            )}
            {conv.ai_urgency && (
              <span className={cn('text-xs px-2 py-0.5 rounded font-medium', urgencyConfig[conv.ai_urgency]?.color)}>
                {urgencyConfig[conv.ai_urgency]?.label} Priority
              </span>
            )}
          </div>

          {/* Summary */}
          {conv.ai_summary && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Brain className="w-3 h-3" /> Summary
              </div>
              <p className="text-xs leading-relaxed text-foreground">{conv.ai_summary}</p>
            </div>
          )}

          {/* Intent */}
          {conv.ai_intent && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <TrendingUp className="w-3 h-3" /> Intent
              </div>
              <p className="text-xs leading-relaxed text-foreground">{conv.ai_intent}</p>
            </div>
          )}

          {/* Next action */}
          {conv.ai_next_action && (
            <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 space-y-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-accent uppercase tracking-wide">
                <Zap className="w-3 h-3" /> Recommended Action
              </div>
              <p className="text-xs text-foreground font-medium">{conv.ai_next_action}</p>
            </div>
          )}

          {/* AI Tags */}
          {conv.ai_tags?.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Tags</div>
              <div className="flex flex-wrap gap-1">
                {conv.ai_tags.map(t => (
                  <Badge key={t} className="text-[10px] bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lead info */}
      {lead && (
        <div className="border-t pt-4 space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead Info</div>
          <p className="text-xs font-medium">{lead.name}</p>
          <p className="text-xs text-muted-foreground">{lead.phone}</p>
          {lead.stage && <Badge variant="secondary" className="text-[10px]">{lead.stage}</Badge>}
        </div>
      )}
    </div>
  );
}