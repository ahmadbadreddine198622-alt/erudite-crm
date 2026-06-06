import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Phone, Loader2, PhoneCall, PhoneOff, Mic, MicOff,
  Volume2, VolumeX, Clock, Delete
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
  const [serverCallSid, setServerCallSid] = useState('');
  const [serverMuted, setServerMuted] = useState(false);
  const [serverSpeaker, setServerSpeaker] = useState(true);
  const [dialPadInput, setDialPadInput] = useState('');

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
    setServerCallSid('');
    setServerMuted(false);
    setServerSpeaker(true);
    setDialPadInput('');
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
      // 1. Try to get browser voice token (may fail if SDK not configured)
      let tokenData = null;
      try {
        const tokenRes = await base44.functions.invoke('twilioVoiceToken', {});
        tokenData = tokenRes.data;
      } catch (_tokenErr) {
        // Token fetch failed — fall through to server-side call
        tokenData = { browser_calling_unavailable: true };
      }

      // ── Fallback: browser SDK not configured → use server-side call ──────
      if (tokenData?.browser_calling_unavailable || !tokenData?.token) {
        setPhase('ringing');
        const callRes = await base44.functions.invoke('twilioMakeCall', {
          lead_id: leadId,
          to_phone: dialTo,
          from_phone: selectedNumber,
          lead_name: targetName,
          browser_mode: false,
        });
        if (callRes.data?.ok) {
          setServerCallSid(callRes.data?.call_sid || '');
          setPhase('server_call');
        } else {
          throw new Error(callRes.data?.error || 'Call failed');
        }
        return;
      }

      const token = tokenData.token;

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
          browser_mode: true,
        });
        callLogId = logRes.data?.call_log_id;
      } catch (_) {}

      // 5. Connect via browser SDK
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
  const handleHangup = async () => {
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch (_) {}
      callRef.current = null;
    }
    // For server-side calls, also notify Twilio to end the call
    if (phase === 'server_call' && serverCallSid) {
      try {
        await base44.functions.invoke('twilioHangupCall', { call_sid: serverCallSid });
      } catch (_) {}
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
          maxWidth: 380,
          borderRadius: 24,
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

            {/* Controls row */}
            <div className="flex items-end justify-center gap-5 w-full">
              <DialerBtn
                onClick={toggleMute}
                active={muted}
                activeColor="rgba(239,68,68,0.3)"
                activeBorder="rgba(239,68,68,0.5)"
                icon={muted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-white" />}
                label={muted ? 'Unmute' : 'Mute'}
              />
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
              <DialerBtn
                onClick={toggleSpeaker}
                active={!speakerOn}
                activeColor="rgba(239,68,68,0.3)"
                activeBorder="rgba(239,68,68,0.5)"
                icon={speakerOn ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-red-400" />}
                label={speakerOn ? 'Speaker' : 'Muted'}
              />
            </div>
          </div>
        )}

        {/* ── SERVER-SIDE CALL — full dialer screen ──────────────────────── */}
        {phase === 'server_call' && (
          <div className="flex flex-col" style={{ background: '#0a1628' }}>
            {/* Top: contact info */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6 gap-2">
              <div className="relative mb-1">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)' }}>
                  <Phone className="w-9 h-9 text-green-400" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-green-400/20 animate-ping" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-green-400">Active Call</span>
              </div>
              <p className="text-xl font-bold text-white">{targetName || dialTo}</p>
              <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>{dialTo}</p>
            </div>

            {/* Dial pad input display */}
            <div className="mx-6 mb-2 flex items-center justify-between px-4 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 40 }}>
              <span className="text-lg font-mono tracking-widest text-white">{dialPadInput || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Keypad</span>}</span>
              {dialPadInput && (
                <button onClick={() => setDialPadInput(p => p.slice(0, -1))} className="ml-2 opacity-60 hover:opacity-100">
                  <Delete className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Numeric keypad */}
            <div className="grid grid-cols-3 gap-2 px-6 py-2">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => (
                <button
                  key={k}
                  onClick={() => setDialPadInput(p => p + k)}
                  className="h-12 rounded-2xl text-lg font-semibold text-white flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {k}
                  <span className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {{'2':'ABC','3':'DEF','4':'GHI','5':'JKL','6':'MNO','7':'PQRS','8':'TUV','9':'WXYZ'}[k] || ''}
                  </span>
                </button>
              ))}
            </div>

            {/* Controls: mute, hang up, speaker */}
            <div className="flex items-end justify-center gap-6 px-6 pt-3 pb-8">
              <DialerBtn
                onClick={() => setServerMuted(m => !m)}
                active={serverMuted}
                activeColor="rgba(239,68,68,0.3)"
                activeBorder="rgba(239,68,68,0.5)"
                icon={serverMuted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-white" />}
                label={serverMuted ? 'Unmute' : 'Mute'}
              />
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={handleHangup}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>End Call</span>
              </div>
              <DialerBtn
                onClick={() => setServerSpeaker(s => !s)}
                active={!serverSpeaker}
                activeColor="rgba(239,68,68,0.3)"
                activeBorder="rgba(239,68,68,0.5)"
                icon={serverSpeaker ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-red-400" />}
                label={serverSpeaker ? 'Speaker' : 'Muted'}
              />
            </div>
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