import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Phone, MoreVertical, Loader2, Building2, User, ExternalLink, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatHeader({ lead, conversation, onAnalyze, onToggleInsights, analyzing, showingInsights }) {
  const displayPhone = conversation?.wa_phone_e164 || conversation?.phone_number || '';
  const name = lead?.full_name || conversation?.wa_display_name || displayPhone;

  // If conversation is routed to a Landlord, fetch them so we can show name + stage
  const { data: landlord } = useQuery({
    queryKey: ['landlord', conversation?.landlord_id],
    queryFn: () => base44.entities.Landlord.get(conversation.landlord_id),
    enabled: !!conversation?.landlord_id
  });

  return (
    <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 bg-card">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-sm truncate">{landlord?.full_name_en || landlord?.full_name || name}</h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-xs text-muted-foreground">{displayPhone}</p>

          {/* AI Priority badge */}
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

          {/* Pipeline link badge */}
          <PipelineLinkBadge conversation={conversation} lead={lead} landlord={landlord} />

          {/* Intent badge */}
          {conversation?.ai_intent && (
            <Badge variant="outline" className="text-[10px] h-5 capitalize">
              {conversation.ai_intent.replace(/_/g, ' ')}
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

function PipelineLinkBadge({ conversation, lead, landlord }) {
  // Landlord routing has highest priority
  if (conversation?.landlord_id) {
    return (
      <Link
        to={`/landlords?selected=${conversation.landlord_id}`}
        className="inline-flex items-center gap-1 text-[10px] h-5 px-1.5 rounded border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
        title="View in Landlord Pipeline"
      >
        <Building2 className="w-2.5 h-2.5" />
        <span className="font-medium">Landlord</span>
        {landlord?.stage && <span className="opacity-70">· {landlord.stage.replace(/_/g, ' ')}</span>}
        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
      </Link>
    );
  }

  if (conversation?.lead_id) {
    return (
      <Link
        to={`/leads?selected=${conversation.lead_id}`}
        className="inline-flex items-center gap-1 text-[10px] h-5 px-1.5 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
        title="View in Lead Pipeline"
      >
        <User className="w-2.5 h-2.5" />
        <span className="font-medium">Lead</span>
        {lead?.stage && <span className="opacity-70">· {lead.stage.replace(/_/g, ' ')}</span>}
        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
      </Link>
    );
  }

  // Unrouted — show convert button
  return (
    <Badge
      variant="outline"
      className="text-[10px] h-5 border-amber-300 bg-amber-50 text-amber-700"
      title="No pipeline entity linked yet"
    >
      <AlertCircle className="w-2.5 h-2.5 mr-1" />
      Unrouted
    </Badge>
  );
}
