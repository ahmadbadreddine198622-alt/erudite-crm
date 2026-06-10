import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Clock, FileAudio, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Search, User, Mic
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_META = {
  completed:    { label: 'Completed',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  'in-progress':{ label: 'Active',      cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  ringing:      { label: 'Ringing',     cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  failed:       { label: 'Failed',      cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
  'no-answer':  { label: 'No Answer',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  busy:         { label: 'Busy',        cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  queued:       { label: 'Queued',      cls: 'bg-white/10 text-white/40 border-white/10' },
  cancelled:    { label: 'Cancelled',   cls: 'bg-white/10 text-white/40 border-white/10' },
};

function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function DirectionIcon({ direction, status }) {
  if (status === 'no-answer' || status === 'busy') {
    return <PhoneMissed className="w-4 h-4 text-red-400" />;
  }
  if (direction === 'inbound') return <PhoneIncoming className="w-4 h-4 text-emerald-400" />;
  return <PhoneOutgoing className="w-4 h-4 text-blue-400" />;
}

function CallItem({ call }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_META[call.status] || STATUS_META.queued;
  const duration = fmtDuration(call.duration_seconds);
  const hasDetails = call.recording_url || call.transcript || call.summary;
  const timeAgo = call.started_at
    ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true })
    : null;

  return (
    <div className="rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: expanded ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => hasDetails && setExpanded(v => !v)}
      >
        {/* Direction icon */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          call.direction === 'inbound' ? 'bg-emerald-500/15' : 'bg-blue-500/15'
        }`}>
          <DirectionIcon direction={call.direction} status={call.status} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {call.direction === 'outbound' ? call.to_number : call.from_number}
            </span>
            <Badge className={`text-[10px] px-1.5 py-0 border shrink-0 ${statusMeta.cls}`}>
              {statusMeta.label}
            </Badge>
            {call.recording_url && (
              <span className="flex items-center gap-0.5 text-[10px] text-purple-400 shrink-0">
                <Mic className="w-2.5 h-2.5" /> Recorded
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {call.agent_email && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <User className="w-2.5 h-2.5" />
                {call.agent_email.split('@')[0]}
              </span>
            )}
            {timeAgo && (
              <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
            )}
            {duration && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5" /> {duration}
              </span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {call.started_at && (
            <span className="text-[11px] text-muted-foreground hidden sm:block">
              {format(new Date(call.started_at), 'MMM d, HH:mm')}
            </span>
          )}
          {hasDetails && (
            expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {/* Recording player */}
          {call.recording_url && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1">
                <FileAudio className="w-3 h-3" /> Recording
              </p>
              <div className="flex items-center gap-2">
                <audio controls className="flex-1 h-9 rounded" preload="metadata">
                  <source src={call.recording_url} type="audio/mpeg" />
                  <source src={call.recording_url} type="audio/wav" />
                  Your browser doesn't support audio.
                </audio>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                  onClick={() => window.open(call.recording_url, '_blank')}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* AI Summary */}
          {call.summary && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-2">AI Summary</p>
              <p className="text-sm text-foreground/80 rounded-lg p-3 leading-relaxed"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {call.summary}
              </p>
            </div>
          )}

          {/* Transcript */}
          {call.transcript && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2">Transcript</p>
              <div className="text-xs text-muted-foreground rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {call.transcript}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CallLogPanel({ leadId, allLogs }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const { data: fetched = [], isLoading } = useQuery({
    queryKey: ['call-logs', leadId],
    queryFn: () => base44.entities.CallLog.filter({ lead_id: leadId }, '-started_at', 50),
    enabled: !!leadId && !allLogs,
  });

  const calls = allLogs || fetched;

  const filtered = calls.filter(c => {
    const matchSearch = !search ||
      c.to_number?.includes(search) ||
      c.from_number?.includes(search) ||
      c.agent_email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ||
      (filter === 'completed' && c.status === 'completed') ||
      (filter === 'recorded' && c.recording_url) ||
      (filter === 'missed' && ['no-answer', 'busy', 'failed'].includes(c.status));
    return matchSearch && matchFilter;
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading calls…
    </div>
  );

  if (calls.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Phone className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-sm font-medium">No calls yet</p>
      <p className="text-xs mt-1 opacity-60">Use the green phone button to place your first call</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search number or agent…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'completed', label: 'Completed' },
            { id: 'recorded', label: 'Recorded' },
            { id: 'missed', label: 'Missed' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === f.id
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} calls</span>
      </div>

      {/* Call list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No calls match your filter</p>
        ) : (
          filtered.map(call => <CallItem key={call.id} call={call} />)
        )}
      </div>
    </div>
  );
}