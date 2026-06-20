import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Phone, Mic, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Play, Pause, FileText, Loader2, PhoneOff, RefreshCw } from 'lucide-react';
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

function StatusPill({ status }) {
  const map = {
    completed: { label: 'Completed', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    done: { label: 'Done', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    ended: { label: 'Ended', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
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

function InlineAudioPlayer({ url, label }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {
        window.open(url, '_blank');
      });
    }
  };

  return (
    <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-all active:scale-90"
          style={{ background: 'rgba(16,185,129,0.25)', color: '#34d399' }}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <p className="text-[11px] font-semibold flex-1" style={{ color: '#34d399' }}>{label}</p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] px-2 py-1 rounded border shrink-0"
          style={{ borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' }}
        >
          Open ↗
        </a>
      </div>
      <audio
        ref={audioRef}
        src={url}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        className="w-full"
        controls
        style={{ height: 28, accentColor: '#34d399' }}
      />
    </div>
  );
}

function CallCard({ call }) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <DirectionIcon direction={call.direction} status={call.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <SourceBadge source={call._source} />
              <span className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {call.direction === 'inbound' ? call.from_number : call.to_number}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{formatDate(call.started_at)}</p>
              {call.agent_name && (
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>· {call.agent_name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusPill status={call.status} />
          <span className="text-[10px] tabular-nums flex items-center gap-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(call.duration_seconds || call.duration)}
          </span>
        </div>
      </div>

      {call.summary && (
        <p className="text-xs leading-relaxed px-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
          📋 {call.summary}
        </p>
      )}

      {call.recording_url && (
        <InlineAudioPlayer url={call.recording_url} label="📼 Call Recording" />
      )}
      {call.voicemail_url && (
        <InlineAudioPlayer url={call.voicemail_url} label="📨 Voicemail" />
      )}

      {call.transcript && (
        <div>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <FileText className="w-3 h-3" />
            {showTranscript ? 'Hide' : 'View'} Transcript
          </button>
          {showTranscript && (
            <div className="mt-2 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
              {call.transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LandlordCallHistory({ landlord }) {
  const phone = landlord.phone;
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

  // ── Twilio CallLog by landlord_id ──
  const { data: callLogsByLandlord = [], isLoading: l1, refetch: refetchAll } = useQuery({
    queryKey: ['call-logs-landlord-id', landlord.id],
    queryFn: () => base44.entities.CallLog.filter({ landlord_id: landlord.id }, '-started_at', 200),
    enabled: !!landlord.id,
  });

  // ── Twilio CallLog by phone variants ──
  const { data: callLogsByPhone = [], isLoading: l2 } = useQuery({
    queryKey: ['call-logs-landlord-phone', phone],
    queryFn: async () => {
      if (!phone) return [];
      const variants = [phone];
      if (phone.startsWith('+')) variants.push(phone.slice(1));
      else variants.push('+' + phone);
      const results = await Promise.all(variants.flatMap(p => [
        base44.entities.CallLog.filter({ to_number: p }, '-started_at', 200).catch(() => []),
        base44.entities.CallLog.filter({ from_number: p }, '-started_at', 200).catch(() => []),
      ]));
      return results.flat();
    },
    enabled: !!phone,
  });

  const callLogMap = new Map();
  [...callLogsByLandlord, ...callLogsByPhone].forEach(c => callLogMap.set(c.id, c));
  const callLogs = Array.from(callLogMap.values());

  // ── Twilio recordings fetch for CallLogs missing recording_url ──
  const callSidsWithoutRecording = callLogs
    .filter(c => c.twilio_call_sid && !c.recording_url && ['completed', 'in-progress'].includes(c.status))
    .map(c => c.twilio_call_sid);

  const { data: twilioRecordings = {} } = useQuery({
    queryKey: ['twilio-recordings', callSidsWithoutRecording.join(',')],
    queryFn: async () => {
      if (!callSidsWithoutRecording.length) return {};
      try {
        const res = await base44.functions.invoke('getTwilioNumbers', {});
        const cred = res?.data?.credential;
        if (!cred?.account_sid || !cred?.auth_token) return {};
        const recordingMap = {};
        await Promise.all(callSidsWithoutRecording.map(async (sid) => {
          try {
            const r = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${cred.account_sid}/Calls/${sid}/Recordings.json`,
              { headers: { Authorization: `Basic ${btoa(`${cred.account_sid}:${cred.auth_token}`)}` } }
            );
            if (r.ok) {
              const d = await r.json();
              const rec = d.recordings?.[0];
              if (rec) {
                recordingMap[sid] = `https://api.twilio.com${rec.uri.replace('.json', '.mp3')}`;
              }
            }
          } catch (_) {}
        }));
        return recordingMap;
      } catch (_) { return {}; }
    },
    enabled: callSidsWithoutRecording.length > 0,
    staleTime: 60000,
  });

  // ── Aircall calls (only real Aircall, not VAPI) ──
  const { data: aircallRaw = [], isLoading: l3 } = useQuery({
    queryKey: ['aircall-calls-all'],
    queryFn: () => base44.entities.AircallCall.list('-started_at', 2000),
  });

  // Distinguish by source field (new) or legacy notes fallback
  const aircallCalls = aircallRaw.filter(c => c.source !== 'vapi' && !c.notes?.startsWith('Vapi AI'));
  const vapiStoredCalls = aircallRaw.filter(c => c.source === 'vapi' || c.notes?.startsWith('Vapi AI'));

  // ── VAPI calls fetched live from VAPI API (for fresh recordings) ──
  const { data: vapiLiveCalls = [], isLoading: l4 } = useQuery({
    queryKey: ['vapi-live-calls', phone],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('syncVapiCalls', {});
        // After syncing, return the updated stored vapi calls
        return [];
      } catch (_) { return []; }
    },
    staleTime: 120000,
  });

  // ── Match Aircall by phone ──
  const matchedAircall = aircallCalls.filter(c => {
    if (!normalizedPhone) return false;
    const toNorm = c.to_number ? normalizePhoneNumber(c.to_number) : '';
    const fromNorm = c.from_number ? normalizePhoneNumber(c.from_number) : '';
    const suffix = normalizedPhone.slice(-9);
    return toNorm === normalizedPhone || fromNorm === normalizedPhone ||
      (suffix.length >= 9 && (toNorm.endsWith(suffix) || fromNorm.endsWith(suffix)));
  });

  // ── Match VAPI stored calls by landlord_id OR phone ──
  const matchedVapi = vapiStoredCalls.filter(c => {
    if (c.landlord_id && c.landlord_id === landlord.id) return true;
    if (!normalizedPhone) return false;
    const toNorm = c.to_number ? normalizePhoneNumber(c.to_number) : '';
    const suffix = normalizedPhone.slice(-9);
    return toNorm === normalizedPhone || (suffix.length >= 9 && toNorm.endsWith(suffix));
  });

  // ── Merge everything ──
  const seenIds = new Set();
  const allCalls = [
    ...callLogs.map(c => ({
      ...c,
      _source: 'twilio',
      recording_url: c.recording_url || (c.twilio_call_sid ? twilioRecordings[c.twilio_call_sid] : null),
    })),
    ...matchedAircall.map(c => ({
      ...c,
      _source: 'aircall',
      duration_seconds: c.duration,
      recording_url: c.recording_url || c.recording,
    })),
    ...matchedVapi.map(c => ({
      ...c,
      _source: 'vapi',
      duration_seconds: c.duration,
      recording_url: c.recording_url || c.recording,
    })),
  ].filter(c => {
    const uid = c.id || c.aircall_id;
    if (seenIds.has(uid)) return false;
    seenIds.add(uid);
    return true;
  }).sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
    return tb - ta;
  });

  const totalCalls = allCalls.length;
  const answered = allCalls.filter(c => ['completed', 'done', 'ended'].includes(c.status)).length;
  const withRecording = allCalls.filter(c => c.recording_url).length;
  const totalDuration = allCalls.reduce((sum, c) => sum + (c.duration_seconds || c.duration || 0), 0);

  const isLoading = l1 || l2 || l3 || l4;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">All calls across Twilio, Aircall & VAPI AI</p>
        <button
          onClick={() => refetchAll()}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Calls', value: totalCalls },
          { label: 'Answered', value: answered },
          { label: 'Recordings', value: withRecording },
          { label: 'Total Duration', value: formatDuration(totalDuration) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{value}</p>
          </div>
        ))}
      </div>

      {allCalls.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <PhoneOff className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No call history found</p>
          <p className="text-xs text-muted-foreground opacity-60">
            Calls via Twilio, Aircall and VAPI AI will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {allCalls.map((call, idx) => (
            <CallCard key={call.id || call.aircall_id || idx} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}