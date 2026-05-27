import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, AlertTriangle, AlertCircle, Info, X, Pause, Play } from 'lucide-react';

const TIER_STYLES = {
  info:     { bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-900',    icon: Info },
  warn:     { bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-900',   icon: AlertTriangle },
  critical: { bg: 'bg-red-50 border-red-300',       text: 'text-red-900',     icon: AlertCircle }
};

/**
 * Whisper Mode — real-time AI suggestions during a live conversation.
 *
 * Props:
 *   - landlord: Landlord record
 *   - recentMessages: array of { direction, text, timestamp } — last 20 messages
 *   - pollIntervalMs: default 8000
 *   - onClose: callback
 */
export default function WhisperPanel({ landlord, recentMessages = [], pollIntervalMs = 8000, onClose }) {
  const [whispers, setWhispers] = useState([]);
  const [signals, setSignals] = useState([]);
  const [paused, setPaused] = useState(false);
  const [lastPoll, setLastPoll] = useState(null);
  const lastSigRef = useRef('');

  // Re-poll when messages change or every pollIntervalMs
  useEffect(() => {
    if (paused) return;

    let cancelled = false;

    const poll = async () => {
      // Dedupe — only poll if message set changed
      const sig = JSON.stringify(recentMessages.map(m => m.timestamp || m.text?.slice(0, 30)));
      if (sig === lastSigRef.current) return;
      lastSigRef.current = sig;

      try {
        const res = await base44.functions.landlordWhisper({
          landlord_id: landlord.id,
          recent_messages: recentMessages
        });
        const data = res?.data || res;
        if (cancelled) return;
        setWhispers(data?.whispers || []);
        setSignals(data?.detected_signals || []);
        setLastPoll(new Date());
      } catch (err) {
        console.warn('whisper poll failed', err);
      }
    };

    poll();
    const id = setInterval(poll, pollIntervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [landlord.id, recentMessages.length, paused, pollIntervalMs]);

  return (
    <div className="bg-white rounded-xl border-2 border-violet-200 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-semibold">Whisper Mode</span>
          {lastPoll && (
            <span className="text-[10px] opacity-70">
              {timeAgo(lastPoll)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPaused(!paused)}
            className="p-1 hover:bg-white/10 rounded"
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {whispers.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-3">
            {paused ? '⏸ Whispers paused' : 'Listening… speak with the landlord and tactical suggestions will appear here.'}
          </p>
        ) : whispers.map((w, i) => {
          const style = TIER_STYLES[w.tier] || TIER_STYLES.info;
          const Icon = style.icon;
          return (
            <div key={i} className={`p-2.5 rounded-lg border ${style.bg} flex items-start gap-2`}>
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.text}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${style.text}`}>{w.text}</p>
                {w.action && (
                  <button className={`mt-1 text-[10px] underline ${style.text} hover:no-underline`}>
                    {w.action}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {signals.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Signals detected</p>
            <div className="flex flex-wrap gap-1">
              {signals.map((s, i) => (
                <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}
