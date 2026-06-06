import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Phone, Loader2, PhoneCall, PhoneOff, Mic, MicOff,
  Volume2, VolumeX, Clock, ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';

// Lazy-load the Twilio Voice SDK (heavy, browser-only)
let DeviceClass = null;
async function getTwilioDevice() {
  if (!DeviceClass) {
    const mod = await import('@twilio/voice-sdk');
    DeviceClass = mod.Device;
  }
  return DeviceClass;
}

export default function TwilioCallDialog({ lead, contact, size = 'sm', iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [manualNumber, setManualNumber] = useState('');

  // Call states
  const [phase, setPhase] = useState('dial'); // dial | initializing | ringing | active | ended
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);

  const targetPhone = lead?.phone || contact?.phone || '';
  const targetName = lead?.full_name || lead?.full_name_en || lead?.name || contact?.full_name || contact?.name || targetPhone;
  const leadId = lead?.id || contact?.id;

  // ── Load Twilio numbers ──────────────────────────────────────────────────
  useEffect(() => {
    if (open && numbers.length === 0) {
      setLoadingNumbers(true);
      base44.functions.invoke('getTwilioNumbers', {})
        .then(res => {
          const nums = res.data?.numbers || [];
          setNumbers(nums);
          if (nums.length > 0) setSelectedNumber(nums[0].phone_number);
        })
        .catch(() => toast.error('Could not load Twilio numbers'))
        .finally(() => setLoadingNumbers(false));
    }
  }, [open]);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'active') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Cleanup on close ─────────────────────────────────────────────────────
  const fullReset = useCallback(() => {
    clearInterval(timerRef.current);
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch (_) {}
      callRef.current = null;
    }
    if (deviceRef.current) {
      try { deviceRef.current.destroy(); } catch (_) {}
      deviceRef.current = null;
    }
    setPhase('dial');
    setMuted(false);
    setSpeakerOn(true);
    setElapsed(0);
    setErrorMsg('');
    setShowTransfer(false);
    setTransferNumber('');
  }, []);

  useEffect(() => {
    if (!open) fullReset();
  }, [open, fullReset]);

  // ── Place call ───────────────────────────────────────────────────────────
  const handleCall = async () => {
    const dialTo = manualNumber.trim() || targetPhone;
    if (!dialTo) return toast.error('No phone number');
    if (!selectedNumber) return toast.error('Select a Twilio number first');

    setPhase('initializing');
    setErrorMsg('');

    try {
      // 1. Get access token
      const tokenRes = await base44.functions.invoke('twilioVoiceToken', {});
      const token = tokenRes.data?.token;
      if (!token) throw new Error(tokenRes.data?.error || 'Could not get voice token');

      // 2. Create the Twilio Device
      const Device = await getTwilioDevice();
      const device = new Device(token, { logLevel: 'warn', codecPreferences: ['opus', 'pcmu'] });
      deviceRef.current = device;

      // 3. Register & wait for ready
      await new Promise((resolve, reject) => {
        device.on('registered', resolve);
        device.on('error', (err) => reject(new Error(err.message)));
        device.register();
        setTimeout(() => reject(new Error('Device registration timed out')), 10000);
      });

      setPhase('ringing');

      // 4. Pre-create CallLog
      let callLogId = null;
      try {
        const logRes = await base44.functions.invoke('twilioMakeCall', {
          lead_id: leadId,
          to_phone: dialTo,
          from_phone: selectedNumber,
          lead_name: targetName,
          browser_mode: true, // flag so the function only creates the log, doesn't REST-dial
        });
        callLogId = logRes.data?.call_log_id;
      } catch (_) {}

      // 5. Connect the call via browser SDK
      // The TwiML app (twiml_app_sid) must point to /functions/twilioVoiceWebhook
      const call = await device.connect({
        params: {
          To: dialTo,
          CallerId: selectedNumber,
          call_log_id: callLogId || '',
        }
      });
      callRef.current = call;

      call.on('ringing', () => setPhase('ringing'));
      call.on('accept', () => setPhase('active'));
      call.on('disconnect', () => {
        setPhase('ended');
        callRef.current = null;
      });
      call.on('error', (err) => {
        setErrorMsg(err.message || 'Call error');
        setPhase('ended');
        callRef.current = null;
      });
      call.on('cancel', () => setPhase('ended'));

      // If no accept event in 30s, still show active
      setTimeout(() => {
        if (callRef.current && phase === 'ringing') setPhase('active');
      }, 30000);

    } catch (err) {
      console.error('TwilioCallDialog error:', err);
      setErrorMsg(err.message || 'Failed to start call');
      setPhase('dial');
    }
  };

  // ── Hang up ──────────────────────────────────────────────────────────────
  const handleHangup = () => {
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch (_) {}
      callRef.current = null;
    }
    setPhase('ended');
  };

  // ── Mute ─────────────────────────────────────────────────────────────────
  const toggleMute = () => {
    if (callRef.current) {
      const next = !muted;
      callRef.current.mute(next);
      setMuted(next);
    }
  };

  // ── Speaker (output volume) ───────────────────────────────────────────────
  const toggleSpeaker = () => {
    if (callRef.current) {
      const next = !speakerOn;
      // Volume 0 = mute output, 1 = full
      callRef.current.volume(next ? 1 : 0);
      setSpeakerOn(next);
    }
  };

  // ── Transfer ─────────────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!transferNumber.trim()) return;
    // Hang up current call and dial transfer number
    handleHangup();
    setTimeout(() => {
      setManualNumber(transferNumber);
      setTransferNumber('');
      setShowTransfer(false);
      setPhase('dial');
      // Auto-dial after tiny delay
      setTimeout(() => handleCall(), 300);
    }, 500);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const dialTo = manualNumber.trim() || targetPhone;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && (phase === 'ringing' || phase === 'active' || phase === 'initializing')) return;
      setOpen(v);
    }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        disabled={!targetPhone && !manualNumber}
        title={`Call ${targetName} via Twilio`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
        style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
      >
        <Phone className="w-3 h-3" />
        {!iconOnly && 'Call'}
      </button>

      <DialogContent
        className="p-0 overflow-hidden"
        style={{
          background: '#0a1628',
          border: '1px solid rgba(255,255,255,0.1)',
          maxWidth: 360,
          borderRadius: 20,
        }}
      >
        {/* ── DIAL PHASE ─────────────────────────────────────────────────── */}
        {(phase === 'dial') && (
          <div className="p-6 space-y-5">
            {/* Contact card */}
            <div className="text-center space-y-1 pt-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(59,130,246,0.15)', border: '2px solid rgba(59,130,246,0.3)' }}>
                <Phone className="w-7 h-7 text-blue-400" />
              </div>
              {targetName && targetName !== targetPhone && (
                <p className="font-semibold text-white text-lg">{targetName}</p>
              )}
              <p className="text-sm font-mono text-blue-300">{dialTo || 'Enter number below'}</p>
            </div>

            {/* Manual number input */}
            <input
              type="tel"
              placeholder="Or dial any number e.g. +971581806000"
              value={manualNumber}
              onChange={e => setManualNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', caretColor: '#60a5fa' }}
            />

            {/* From number */}
            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>
                FROM (Twilio number)
              </label>
              {loadingNumbers ? (
                <div className="flex items-center gap-2 text-sm py-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : numbers.length === 0 ? (
                <p className="text-xs text-amber-400">No Twilio numbers found. Check TwilioHub settings.</p>
              ) : (
                <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13 }}>
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    {numbers.map(n => (
                      <SelectItem key={n.phone_number} value={n.phone_number}>
                        {n.friendly_name || n.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 text-center px-2">{errorMsg}</p>
            )}

            {/* Call button */}
            <button
              disabled={!selectedNumber || !dialTo}
              onClick={handleCall}
              className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }}
            >
              <Phone className="w-5 h-5" />
              Call Now
            </button>
          </div>
        )}

        {/* ── INITIALIZING / RINGING ─────────────────────────────────────── */}
        {(phase === 'initializing' || phase === 'ringing') && (
          <div className="px-6 py-10 flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-28 h-28 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)' }}>
                <PhoneCall className="w-12 h-12 text-green-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-green-500/25 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {phase === 'initializing' ? 'Connecting…' : 'Ringing…'}
              </p>
              <p className="text-xl font-semibold text-white">{targetName || dialTo}</p>
              <p className="text-sm font-mono text-green-400">{dialTo}</p>
            </div>
            {phase === 'initializing' && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Setting up browser audio…
              </div>
            )}
            <button
              onClick={handleHangup}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </div>
        )}

        {/* ── ACTIVE CALL ─────────────────────────────────────────────────── */}
        {phase === 'active' && (
          <div className="px-6 py-8 flex flex-col items-center gap-5">
            {/* Avatar with live ring */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.45)' }}>
                <Phone className="w-10 h-10 text-green-400" />
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-400 border-2"
                style={{ borderColor: '#0a1628' }} />
            </div>

            {/* Name + timer */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-green-400">Live</span>
              </div>
              <p className="text-xl font-semibold text-white">{targetName || dialTo}</p>
              <p className="text-xs font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{dialTo}</p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <Clock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-2xl font-mono font-bold text-white">{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* Transfer panel */}
            {showTransfer && (
              <div className="w-full space-y-2">
                <input
                  type="tel"
                  placeholder="Transfer to number…"
                  value={transferNumber}
                  onChange={e => setTransferNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
                />
                <div className="flex gap-2">
                  <button onClick={handleTransfer}
                    disabled={!transferNumber.trim()}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)' }}>
                    Transfer Now
                  </button>
                  <button onClick={() => setShowTransfer(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Controls row */}
            <div className="flex items-end justify-center gap-5 w-full">
              {/* Mute mic */}
              <DialerBtn
                onClick={toggleMute}
                active={muted}
                activeColor="rgba(239,68,68,0.3)"
                activeBorder="rgba(239,68,68,0.5)"
                icon={muted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-white" />}
                label={muted ? 'Unmute' : 'Mute'}
              />

              {/* Hang up — center, bigger */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={handleHangup}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Hang Up</span>
              </div>

              {/* Speaker */}
              <DialerBtn
                onClick={toggleSpeaker}
                active={!speakerOn}
                activeColor="rgba(239,68,68,0.3)"
                activeBorder="rgba(239,68,68,0.5)"
                icon={speakerOn ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-red-400" />}
                label={speakerOn ? 'Speaker' : 'Muted'}
              />
            </div>

            {/* Transfer button */}
            {!showTransfer && (
              <button
                onClick={() => setShowTransfer(true)}
                className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full transition-all hover:opacity-80"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transfer
              </button>
            )}
          </div>
        )}

        {/* ── ENDED ───────────────────────────────────────────────────────── */}
        {phase === 'ended' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' }}>
              <PhoneOff className="w-9 h-9 text-slate-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-semibold text-white">{targetName || dialTo}</p>
              {elapsed > 0 && (
                <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Duration: {formatTime(elapsed)}
                </p>
              )}
              {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
              <p className="text-sm text-slate-400 mt-1">Call ended</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setPhase('dial'); setErrorMsg(''); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
              >
                Call Again
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Small helper button for dialer controls
function DialerBtn({ onClick, active, activeColor, activeBorder, icon, label }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{
          background: active ? activeColor : 'rgba(255,255,255,0.08)',
          border: `1px solid ${active ? activeBorder : 'rgba(255,255,255,0.15)'}`,
        }}
      >
        {icon}
      </button>
      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    </div>
  );
}