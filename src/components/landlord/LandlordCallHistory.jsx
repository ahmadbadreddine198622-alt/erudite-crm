import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Phone, Mic, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Play, FileText, Loader2, PhoneOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DirectionIcon({ direction, status }) {
  if (status === 'missed' || status === 'no-answer' || status === 'busy') {
    return <PhoneMissed className="w-3.5 h-3.5 text-red-400" />;
  }
  return direction === 'inbound'
    ? <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400" />
    : <PhoneOutgoing className="w-3.5 h-3.5 text-blue-400" />;
}

function SourceBadge({ source }) {
  const map = {
    twilio: { label: 'Twilio', bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.3)' },
    aircall: { label: 'Aircall', bg: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
    vapi: { label: 'VAPI AI', bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
  };
  const s = map[source] || map.twilio;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {source === 'vapi' && <Mic className="w-2.5 h-2.5" />}
      {s.label}
    </span>
  );
}

function CallCard({ call }) {
  const [showTranscript, setShowTranscript] = React.useState(false);
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <DirectionIcon direction={call.direction} status={call.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <SourceBadge source={call._source} />
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {call.direction === 'inbound' ? call.from_number : call.to_number}
              </span>
              {call.agent_name && (
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  via {call.agent_name}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {formatDate(call.started_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs tabular-nums flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Clock className="w-3 h-3" />
            {formatDuration(call.duration_seconds || call.duration)}
          </span>
          <StatusPill status={call.status} />
        </div>
      </div>

      {/* Summary */}
      {call.summary && (
        <p className="text-xs leading-relaxed px-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
          📋 {call.summary}
        </p>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {call.recording_url && (
          <a
            href={call.recording_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <Play className="w-3 h-3" /> Listen to Recording
          </a>
        )}
        {call.voicemail_url && (
          <a
            href={call.voicemail_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{ background: 'rgba(245,158,11,0.12)', color: 'hsl(38 92% 60%)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <Phone className="w-3 h-3" /> Voicemail
          </a>
        )}
        {call.transcript && (
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <FileText className="w-3 h-3" />
            {showTranscript ? 'Hide' : 'View'} Transcript
          </button>
        )}
      </div>

      {/* Transcript */}
      {showTranscript && call.transcript && (
        <div className="rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
          {call.transcript}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    completed: { label: 'Completed', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    done: { label: 'Done', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    missed: { label: 'Missed', bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
    'no-answer': { label: 'No Answer', bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
    busy: { label: 'Busy', bg: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 60%)' },
    voicemail: { label: 'Voicemail', bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc' },
    failed: { label: 'Failed', bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  };
  const s = map[status] || { label: status || '—', bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' };
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function LandlordCallHistory({ landlord }) {
  const phone = landlord.phone;
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

  // Fetch Twilio CallLogs for this landlord
  const { data: callLogs = [], isLoading: loadingCallLogs } = useQuery({
    queryKey: ['call-logs-landlord', landlord.id],
    queryFn: () => base44.entities.CallLog.filter({ landlord_id: landlord.id }),
    enabled: !!landlord.id,
  });

  // Fetch Aircall calls — match by phone number
  const { data: aircallCalls = [], isLoading: loadingAircall } = useQuery({
    queryKey: ['aircall-calls-all'],
    queryFn: () => base44.entities.AircallCall.list('-started_at', 500),
    enabled: !!normalizedPhone,
  });

  // Fetch VAPI calls from CallLog where source is vapi OR from AircallCall tagged as vapi
  // Vapi calls are stored in CallLog with twilio_call_sid starting with 'vapi_' or have a vapi note
  const { data: vapiCalls = [], isLoading: loadingVapi } = useQuery({
    queryKey: ['vapi-calls-landlord', landlord.id],
    queryFn: async () => {
      // CallLogs without landlord_id but matching phone — catch VAPI calls by phone
      if (!normalizedPhone) return [];
      const all = await base44.entities.CallLog.list('-started_at', 200);
      return all.filter(c => {
        const toNorm = c.to_number ? normalizePhoneNumber(c.to_number) : '';
        const fromNorm = c.from_number ? normalizePhoneNumber(c.from_number) : '';
        return (toNorm === normalizedPhone || fromNorm === normalizedPhone) && !c.landlord_id;
      });
    },
    enabled: !!normalizedPhone,
  });

  const isLoading = loadingCallLogs || loadingAircall || loadingVapi;

  // Match Aircall calls by phone
  const matchedAircall = aircallCalls.filter(c => {
    if (!normalizedPhone) return false;
    const toNorm = c.to_number ? normalizePhoneNumber(c.to_number) : '';
    const fromNorm = c.from_number ? normalizePhoneNumber(c.from_number) : '';
    return toNorm === normalizedPhone || fromNorm === normalizedPhone;
  });

  // Merge all calls with source tag, sorted by date desc
  const allCalls = [
    ...callLogs.map(c => ({ ...c, _source: 'twilio', started_at: c.started_at, duration_seconds: c.duration_seconds })),
    ...matchedAircall.map(c => ({ ...c, _source: 'aircall', duration_seconds: c.duration })),
    ...vapiCalls.map(c => ({ ...c, _source: 'vapi', duration_seconds: c.duration_seconds })),
  ].sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
    return tb - ta;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allCalls.length === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <PhoneOff className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">No call history found</p>
        <p className="text-xs text-muted-foreground opacity-60">
          Calls via Twilio, Aircall and VAPI AI will appear here
        </p>
      </div>
    );
  }

  // Stats
  const totalCalls = allCalls.length;
  const answered = allCalls.filter(c => ['completed', 'done'].includes(c.status)).length;
  const totalDuration = allCalls.reduce((sum, c) => sum + (c.duration_seconds || c.duration || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Calls', value: totalCalls },
          { label: 'Answered', value: answered },
          { label: 'Total Duration', value: formatDuration(totalDuration) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Call list */}
      <div className="space-y-2">
        {allCalls.map((call, idx) => (
          <CallCard key={call.id || call.aircall_id || idx} call={call} />
        ))}
      </div>
    </div>
  );
}