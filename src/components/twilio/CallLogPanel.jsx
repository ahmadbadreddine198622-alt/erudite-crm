import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Clock, FileAudio, ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'in-progress': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  failed: 'bg-red-500/15 text-red-400 border-red-500/25',
  'no-answer': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  busy: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  queued: 'bg-white/10 text-white/50 border-white/15',
  ringing: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
};

function CallItem({ call }) {
  const [expanded, setExpanded] = useState(false);
  const duration = call.duration_seconds
    ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
    : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Direction icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          call.direction === 'inbound' ? 'bg-emerald-500/20' : 'bg-blue-500/20'
        }`}>
          <Phone className={`w-3.5 h-3.5 ${call.direction === 'inbound' ? 'text-emerald-400' : 'text-blue-400'} ${
            call.direction === 'inbound' ? 'rotate-0' : 'rotate-135'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {call.direction === 'outbound' ? `To: ${call.to_number}` : `From: ${call.from_number}`}
            </span>
            <Badge className={`text-[10px] px-1.5 py-0 border ${STATUS_COLORS[call.status] || STATUS_COLORS.queued}`}>
              {call.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            {call.started_at && (
              <span>{format(new Date(call.started_at), 'MMM d, HH:mm')}</span>
            )}
            {duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {duration}
              </span>
            )}
            {call.recording_url && (
              <span className="flex items-center gap-1 text-purple-400">
                <FileAudio className="w-3 h-3" /> Recording
              </span>
            )}
          </div>
        </div>

        {(call.recording_url || call.transcript || call.summary) && (
          expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
          {/* Recording */}
          {call.recording_url && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Recording
              </p>
              <div className="flex items-center gap-2">
                <audio controls className="flex-1 h-9" preload="metadata">
                  <source src={call.recording_url} type="audio/mpeg" />
                  <source src={call.recording_url} type="audio/wav" />
                </audio>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                  onClick={() => window.open(call.recording_url, '_blank')}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Summary */}
          {call.summary && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                AI Summary
              </p>
              <p className="text-sm text-foreground/80 bg-black/20 rounded-lg p-2.5">{call.summary}</p>
            </div>
          )}

          {/* Transcript */}
          {call.transcript && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Transcript
              </p>
              <div className="text-xs text-muted-foreground bg-black/20 rounded-lg p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {call.transcript}
              </div>
            </div>
          )}

          {!call.recording_url && !call.transcript && !call.summary && (
            <p className="text-xs text-muted-foreground">No additional details available.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CallLogPanel({ leadId, allLogs }) {
  const { data: fetched = [], isLoading } = useQuery({
    queryKey: ['call-logs', leadId],
    queryFn: () => base44.entities.CallLog.filter({ lead_id: leadId }, '-started_at', 50),
    enabled: !!leadId && !allLogs,
  });

  const calls = allLogs || fetched;

  if (isLoading) return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading calls…
    </div>
  );

  if (calls.length === 0) return (
    <div className="text-center py-8 text-muted-foreground">
      <Phone className="w-10 h-10 mx-auto mb-2 opacity-20" />
      <p className="text-sm">No Twilio calls yet</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {calls.map(call => <CallItem key={call.id} call={call} />)}
    </div>
  );
}