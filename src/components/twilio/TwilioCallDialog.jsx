import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Phone, Loader2, PhoneOff, Clock, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Browser-based calling via Twilio Voice SDK.
 * Direct call: browser mic + speakers → customer phone. No bridge. No personal phone needed.
 */
export default function TwilioCallDialog({ lead, landlord, contact, phoneOverride, iconOnly = false, children }) {
  const [open, setOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [callerNumber, setCallerNumber] = useState('');

  // phase: idle | initializing | ringing | active | ended
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [muted, setMuted] = useState(false);

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const callLogIdRef = useRef('');

  const entity = lead || landlord || contact;
  const defaultPhone = phoneOverride || entity?.phone || entity?.whatsapp || entity?.wa_phone_e164 || '';
  const targetName =
    lead?.full_name || lead?.full_name_en || lead?.name ||
    landlord?.full_name_en || landlord?.first_name ||
    contact?.full_name || contact?.name || defaultPhone;
  const leadId = lead?.id || null;
  const landlordId = landlord?.id || null;

  // When dialog opens: populate number and load caller ID
  useEffect(() => {
    if (!open) return;
    setDialNumber(defaultPhone);
    setErrorMsg('');
    base44.functions.invoke('getTwilioNumbers', {})
      .then(res => {
        const nums = res.data?.numbers || [];
        if (nums.length > 0) setCallerNumber(nums[0].phone_number);
      })
      .catch(() => {});
  }, [open]);

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

  useEffect(() => { if (!open) fullReset(); }, [open, fullReset]);

  const handleCall = async () => {
    const toPhone = dialNumber.trim();
    if (!toPhone) return toast.error('Enter a phone number');

    setPhase('initializing');
    setErrorMsg('');

    // Request microphone permission explicitly before SDK init
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (micErr) {
      setErrorMsg('Microphone access denied. Please allow microphone access in your browser settings (click the 🔒 icon in the address bar) and try again.');
      setPhase('idle');
      return;
    }

    try {
      // 1. Get access token
      const tokenRes = await base44.functions.invoke('twilioVoiceToken', {});
      const { token, browser_calling_unavailable, error: tokenError } = tokenRes.data || {};

      if (browser_calling_unavailable || !token) {
        setErrorMsg(tokenError || 'Browser calling not configured. Go to Twilio Hub → Settings and add API Key SID, API Key Secret & TwiML App SID.');
        setPhase('idle');
        return;
      }

      // 2. Load Twilio Voice SDK and init device
      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(token, { logLevel: 1, codecPreferences: ['opus', 'pcmu'] });
      deviceRef.current = device;

      device.on('error', (err) => {
        console.error('[TwilioCallDialog] Device error:', err?.message, err?.code);
        const code = err?.code;
        let msg = err?.message || 'Call error';
        if (code === 31005) {
          msg = 'Gateway rejected the call. Check that your TwiML App Voice URL is set correctly in Twilio Hub → Settings.';
        } else if (code === 31000 || code === 31003) {
          msg = 'Connection error. Check your internet connection and try again.';
        } else if (code === 31204 || code === 31205) {
          msg = 'Authentication failed. Your call token may have expired — close and try again.';
        } else if (code === 31002) {
          msg = 'Account suspended or insufficient funds in your Twilio account.';
        }
        setErrorMsg(msg);
        setPhase('ended');
        destroyDevice();
      });

      // 3. Connect directly — NO register(), NO CallerId param (comes from TwiML App config)
      const call = await device.connect({ params: { To: toPhone } });
      callRef.current = call;
      setPhase('ringing');

      // 4. Create call log after connect (fire-and-forget)
      base44.functions.invoke('twilioMakeCall', {
        lead_id: leadId,
        landlord_id: landlordId,
        to_phone: toPhone,
        from_phone: callerNumber,
        lead_name: targetName,
        browser_mode: true,
      }).then(res => { callLogIdRef.current = res.data?.call_log_id || ''; }).catch(() => {});

      call.on('ringing', () => setPhase('ringing'));
      call.on('accept', () => setPhase('active'));
      call.on('disconnect', () => { setPhase('ended'); destroyDevice(); });
      call.on('cancel', () => { setPhase('ended'); destroyDevice(); });
      call.on('reject', () => { setPhase('ended'); destroyDevice(); });
      call.on('error', (err) => {
        const code = err?.code;
        let msg = err?.message || 'Call error';
        if (code === 31005) msg = 'Gateway rejected the call. Check that your TwiML App Voice URL is set correctly in Twilio Hub → Settings.';
        setErrorMsg(msg);
        setPhase('ended');
        destroyDevice();
      });

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
  const isInCall = ['ringing', 'active'].includes(phase);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && isInCall) return; setOpen(v); }}>
      {/* Trigger */}
      {children ? (
        <div onClick={() => setOpen(true)} className="cursor-pointer">{children}</div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title={`Call ${targetName || 'number'}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
        >
          <Phone className="w-3 h-3" />
          {!iconOnly && 'Call'}
        </button>
      )}

      <DialogContent
        className="p-0 overflow-hidden"
        style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 340, borderRadius: 24 }}
      >
        <DialogTitle className="sr-only">Call {targetName}</DialogTitle>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="p-6 space-y-4">
            {/* Contact info */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold"
                style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                {(targetName || '?').charAt(0).toUpperCase()}
              </div>
              <p className="font-semibold text-white text-base">{targetName || 'New Call'}</p>
              {callerNumber && (
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Calling from {callerNumber}
                </p>
              )}
            </div>

            {/* Number input */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Customer Number
              </label>
              <input
                type="tel"
                placeholder="+971XXXXXXXXX"
                value={dialNumber}
                onChange={e => setDialNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCall()}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl text-base font-mono outline-none text-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.95)' }}
              />
            </div>

            {errorMsg && (
              <div className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                {errorMsg}
              </div>
            )}

            {/* Call button */}
            <button
              disabled={!dialNumber.trim()}
              onClick={handleCall}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base disabled:opacity-40 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }}
            >
              <Phone className="w-5 h-5" /> Call Now
            </button>
          </div>
        )}

        {/* ── INITIALIZING ── */}
        {phase === 'initializing' && (
          <div className="px-6 py-14 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-green-400" />
            <p className="text-white font-semibold">Connecting…</p>
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>Setting up browser audio</p>
          </div>
        )}

        {/* ── RINGING ── */}
        {phase === 'ringing' && (
          <div className="px-6 py-10 flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold"
                style={{ background: 'rgba(250,180,40,0.12)', border: '2px solid rgba(250,180,40,0.4)', color: '#fbbf24' }}>
                {(targetName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/25 animate-ping" />
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-amber-400 font-bold text-[11px] uppercase tracking-widest">Ringing…</p>
              <p className="text-white text-xl font-bold">{targetName || dialNumber}</p>
              <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{dialNumber}</p>
            </div>
            <button onClick={handleHangup}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* ── ACTIVE ── */}
        {phase === 'active' && (
          <div className="px-6 pt-8 pb-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.45)', color: '#4ade80' }}>
                {(targetName || '?').charAt(0).toUpperCase()}
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-400 border-2 animate-pulse"
                style={{ borderColor: '#0d1b2a' }} />
            </div>

            <div className="text-center space-y-0.5">
              <p className="text-green-400 font-bold text-[11px] uppercase tracking-widest">Connected</p>
              <p className="text-white text-xl font-bold">{targetName || dialNumber}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 text-white/30" />
                <span className="text-2xl font-mono font-bold text-white">{fmt(elapsed)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-8 mt-2">
              <div className="flex flex-col items-center gap-1">
                <button onClick={toggleMute}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  }}>
                  {muted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-white/60" />}
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{muted ? 'Unmute' : 'Mute'}</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button onClick={handleHangup}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}>
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>End Call</span>
              </div>
            </div>
          </div>
        )}

        {/* ── ENDED ── */}
        {phase === 'ended' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' }}>
              <PhoneOff className="w-9 h-9 text-slate-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-semibold text-white">{targetName || dialNumber}</p>
              {elapsed > 0 && <p className="text-sm font-mono text-white/40">Duration: {fmt(elapsed)}</p>}
              <p className="text-sm text-slate-400">Call ended</p>
              {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={fullReset}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                Call Again
              </button>
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                Close
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}