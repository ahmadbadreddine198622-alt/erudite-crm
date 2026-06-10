import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Phone, PhoneOff, Mic, MicOff, Clock, X, Loader2, Delete } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Floating browser dialer — always accessible.
 * Click the green phone button → type/use dialpad → Call.
 * Uses Twilio Voice SDK: computer mic + speakers, direct to customer.
 */
export default function FloatingDialer() {
  const [open, setOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | initializing | ringing | active | ended
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const callLogIdRef = useRef('');

  // Load caller number on mount
  useEffect(() => {
    base44.functions.invoke('getTwilioNumbers', {})
      .then(res => {
        const nums = res.data?.numbers || [];
        if (nums.length > 0) setCallerNumber(nums[0].phone_number);
      })
      .catch(() => {});
  }, []);

  // Timer
  useEffect(() => {
    if (phase === 'active') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const destroyDevice = useCallback(() => {
    if (callRef.current) { try { callRef.current.disconnect(); } catch (_) {} callRef.current = null; }
    if (deviceRef.current) { try { deviceRef.current.destroy(); } catch (_) {} deviceRef.current = null; }
  }, []);

  const fullReset = useCallback(() => {
    destroyDevice();
    clearInterval(timerRef.current);
    setPhase('idle');
    setElapsed(0);
    setErrorMsg('');
    setMuted(false);
    callLogIdRef.current = '';
  }, [destroyDevice]);

  const handleClose = () => {
    if (['ringing', 'active'].includes(phase)) return;
    fullReset();
    setDialNumber('');
    setOpen(false);
  };

  const pressKey = (key) => setDialNumber(prev => prev + key);
  const backspace = () => setDialNumber(prev => prev.slice(0, -1));

  const handleCall = async () => {
    const toPhone = dialNumber.trim();
    if (!toPhone) return toast.error('Enter a phone number');
    setPhase('initializing');
    setErrorMsg('');
    try {
      const tokenRes = await base44.functions.invoke('twilioVoiceToken', {});
      const { token, browser_calling_unavailable, error: tokenError } = tokenRes.data || {};
      if (browser_calling_unavailable || !token) {
        setErrorMsg(tokenError || 'Browser calling not configured. Go to Twilio Hub → Settings.');
        setPhase('idle');
        return;
      }
      const logRes = await base44.functions.invoke('twilioMakeCall', {
        to_phone: toPhone,
        from_phone: callerNumber,
        browser_mode: true,
      });
      callLogIdRef.current = logRes.data?.call_log_id || '';
      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(token, { logLevel: 1, codecPreferences: ['opus', 'pcmu'] });
      deviceRef.current = device;
      await device.register();
      const call = await device.connect({ params: { To: toPhone, CallerId: callerNumber, call_log_id: callLogIdRef.current } });
      callRef.current = call;
      setPhase('ringing');
      call.on('ringing', () => setPhase('ringing'));
      call.on('accept', () => setPhase('active'));
      call.on('disconnect', () => { setPhase('ended'); destroyDevice(); });
      call.on('cancel', () => { setPhase('ended'); destroyDevice(); });
      call.on('reject', () => { setPhase('ended'); destroyDevice(); });
      call.on('error', (err) => { setErrorMsg(err?.message || 'Call error'); setPhase('ended'); destroyDevice(); });
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to start call');
      setPhase('idle');
      destroyDevice();
    }
  };

  const handleHangup = () => {
    if (callRef.current) { try { callRef.current.disconnect(); } catch (_) {} }
    setPhase('ended');
    destroyDevice();
  };

  const toggleMute = () => {
    if (!callRef.current) return;
    const next = !muted;
    callRef.current.mute(next);
    setMuted(next);
  };

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const DIALPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['*','0','#']];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open Dialer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.5)' }}
      >
        <Phone className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 rounded-3xl overflow-hidden shadow-2xl"
      style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.12)', width: 300, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-white">Dialer</span>
          {callerNumber && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              {callerNumber}
            </span>
          )}
        </div>
        <button onClick={handleClose} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition">
          <X className="w-3.5 h-3.5 text-white/50" />
        </button>
      </div>

      {/* IDLE / Input */}
      {phase === 'idle' && (
        <div className="p-4 space-y-3">
          {/* Number display */}
          <div className="relative">
            <input
              type="tel"
              value={dialNumber}
              onChange={e => setDialNumber(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCall()}
              placeholder="+971XXXXXXXXX"
              className="w-full px-3 pr-9 py-3 rounded-xl text-xl font-mono text-center outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', letterSpacing: '0.05em' }}
            />
            {dialNumber && (
              <button onClick={backspace} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 transition">
                <Delete className="w-4 h-4 text-white/40" />
              </button>
            )}
          </div>

          {/* Dialpad */}
          <div className="grid grid-cols-3 gap-2">
            {DIALPAD.flat().map(k => (
              <button
                key={k}
                onClick={() => pressKey(k)}
                className="h-11 rounded-xl text-lg font-semibold transition-all hover:bg-white/10 active:scale-95 active:bg-white/15"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)' }}
              >
                {k}
              </button>
            ))}
          </div>

          {errorMsg && (
            <p className="text-xs text-red-300 text-center px-2">{errorMsg}</p>
          )}

          {/* Call button */}
          <button
            disabled={!dialNumber.trim()}
            onClick={handleCall}
            className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base disabled:opacity-40 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}
          >
            <Phone className="w-5 h-5" /> Call
          </button>
        </div>
      )}

      {/* INITIALIZING */}
      {phase === 'initializing' && (
        <div className="py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-400" />
          <p className="text-white font-semibold text-sm">Connecting…</p>
        </div>
      )}

      {/* RINGING */}
      {phase === 'ringing' && (
        <div className="py-8 flex flex-col items-center gap-5 px-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{ background: 'rgba(251,191,36,0.12)', border: '2px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}>
              {dialNumber.charAt(0)}
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-amber-400 text-[11px] font-bold uppercase tracking-widest">Ringing…</p>
            <p className="text-white font-mono text-lg mt-0.5">{dialNumber}</p>
          </div>
          <button onClick={handleHangup}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 16px rgba(239,68,68,0.5)' }}>
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* ACTIVE */}
      {phase === 'active' && (
        <div className="py-6 px-4 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[11px] font-bold uppercase tracking-widest">Connected</span>
          </div>
          <p className="text-white font-mono text-lg">{dialNumber}</p>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-white/30" />
            <span className="text-2xl font-mono font-bold text-white">{fmt(elapsed)}</span>
          </div>
          <div className="flex items-center gap-6 mt-1">
            <div className="flex flex-col items-center gap-1">
              <button onClick={toggleMute}
                className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                }}>
                {muted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-white/60" />}
              </button>
              <span className="text-[10px] text-white/30">{muted ? 'Unmute' : 'Mute'}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button onClick={handleHangup}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
              <span className="text-[10px] text-white/30">Hang Up</span>
            </div>
          </div>
        </div>
      )}

      {/* ENDED */}
      {phase === 'ended' && (
        <div className="py-8 px-4 flex flex-col items-center gap-4">
          <PhoneOff className="w-10 h-10 text-slate-400" />
          <div className="text-center">
            <p className="text-white font-semibold">{dialNumber}</p>
            {elapsed > 0 && <p className="text-sm font-mono text-white/40">Duration: {fmt(elapsed)}</p>}
            <p className="text-sm text-slate-500 mt-0.5">Call ended</p>
            {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={fullReset}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
              Call Again
            </button>
            <button onClick={handleClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}