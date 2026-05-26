import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Phone, MoreVertical, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatHeader({ lead, conversation, onAnalyze, onToggleInsights, analyzing, showingInsights }) {
  const displayPhone = conversation?.wa_phone_e164 || conversation?.phone_number || '';
  const name = lead?.full_name || conversation?.wa_display_name || displayPhone;

  const stageColor = {
    new_lead: 'bg-blue-500/10 text-blue-600',
    contacted: 'bg-yellow-500/10 text-yellow-600',
    viewing_scheduled: 'bg-purple-500/10 text-purple-600',
    viewing_done: 'bg-indigo-500/10 text-indigo-600',
    negotiation: 'bg-orange-500/10 text-orange-600',
    offer_made: 'bg-cyan-500/10 text-cyan-600',
    closed_won: 'bg-green-500/10 text-green-600',
    closed_lost: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className="h-16 px-4 border-b flex items-center justify-between shrink-0 bg-card">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-sm truncate">{name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{displayPhone}</p>
          {(conversation?.ai_priority || conversation?.ai_urgency) && (
            <Badge 
              variant="outline"
              className={cn(
                'text-[10px] h-5',
                (conversation.ai_priority === 'urgent' || conversation.ai_urgency === 'urgent') && 'border-red-300 bg-red-50 text-red-700',
                (conversation.ai_priority === 'high' || conversation.ai_urgency === 'high') && 'border-orange-300 bg-orange-50 text-orange-700',
              )}
            >
              {(conversation.ai_priority || conversation.ai_urgency).toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onAnalyze}
          disabled={analyzing}
          className="h-8 gap-1.5"
          title="Re-analyze conversation"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-500" />
          )}
          <span className="text-xs">Analyze</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="Call"
        >
          <Phone className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}