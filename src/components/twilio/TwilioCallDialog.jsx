import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Loader2, PhoneCall, PhoneOff, Clock, Mic, MicOff, Edit2, Smartphone, Zap } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Outbound call dialog — three modes (auto-detected based on credentials):
 *   1. Browser SDK  → dials customer directly via browser mic/speakers
 *   2. Direct REST  → Twilio API calls customer directly (no agent phone needed)
 *   3. Bridge       → Twilio calls agent's phone first, then bridges to customer
 *
 * Mode is selected by the user; defaults to best available option.
 */
export default function TwilioCallDialog({ lead, landlord, contact, iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const [cred, setCred] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [callMode, setCallMode] = useState('direct'); // 'browser' | 'direct' | 'bridge'

  // phase: idle | init | calling | active | ended
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [muted, setMuted] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const entity = lead || landlord || contact;
  const defaultPhone = entity?.phone || entity?.whatsapp || '';
  const targetName = lead?.full_name || lead?.full_name_en || lead?.name ||
    landlord?.full_name_en || landlord?.first_name ||
    contact?.full_name || contact?.name || defaultPhone;
  const leadId = lead?.id || null;
  const landlordId = landlord?.id || null;

  // Load creds + numbers when dialog opens
  useEffect(() => {
    if (!open) return;
    setDialNumber(defaultPhone);
    setLoadingNumbers(true);
    base44.functions.invoke('getTwilioNumbers', {})
      .then(res => {
        const nums = res.data?.numbers || [];
        const c = res.data?.credential || {};
        setNumbers(nums);
        setCred(c);
        if (nums.length > 0) setSelectedNumber(nums[0].phone_number);
        // Auto-select best mode
        const hasBrowserCreds = c.api_key_sid && c.api_key_secret && c.twiml_app_sid;
        if (hasBrowserCreds) setCallMode('browser');
        else if (c.agent_phone) setCallMode('bridge');
        else setCallMode('direct');
      })
      .catch(() => {})
      .finally(() => setLoadingNumbers(false));
  }, [open]);

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
    clearInterval(pollRef.current);
  }, []);

  const fullReset = useCallback(() => {
    destroyDevice();
    clearInterval(timerRef.current);
    setPhase('idle');
    setElapsed(0);
    setErrorMsg('');
    setMuted(false);
    setStatusMsg('');
  }, [destroyDevice]);

  useEffect(() => { if (!open) fullReset(); }, [open, fullReset]);

  // ── Poll call log until status resolves ───────────────────────────────────
  const pollCallLog = (callLogId) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) { clearInterval(pollRef.current); return; }
      try {
        const logs = await base44.entities.CallLog.filter({ id: callLogId });
        const log = logs?.[0];
        if (!log) return;
        if (log.status === 'in-progress' || log.status === 'answered') {
          setPhase('active');
          clearInterval(pollRef.current);
        } else if (['completed', 'failed', 'busy', 'no-answer'].includes(log.status)) {
          setPhase('ended');
          clearInterval(pollRef.current);
        }
      } catch (_) {}
    }, 3000);
  };

  // ── Direct / Bridge REST call ─────────────────────────────────────────────
  const handleRestCall = async () => {
    const toPhone = dialNumber.trim();
    if (!toPhone) return toast.error('Enter a phone number to call');
    setPhase('init');
    setErrorMsg('');
    setStatusMsg('Placing call…');

    try {
      const res = await base44.functions.invoke('twilioMakeCall', {
        lead_id: leadId,
        landlord_id: landlordId,
        to_phone: toPhone,
        from_phone: selectedNumber,
        lead_name: targetName,
        browser_mode: false,
        direct_only: callMode === 'direct',
      });

      const data = res.data;
      if (data?.error) { setErrorMsg(data.error); setPhase('idle'); return; }

      setPhase('calling');
      setStatusMsg(data.message || '');
      if (data.call_log_id) pollCallLog(data.call_log_id);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || err.message || 'Failed to place call');
      setPhase('idle');
    }
  };

  // ── Browser SDK call ──────────────────────────────────────────────────────
  const handleBrowserCall = async () => {
    const toPhone = dialNumber.trim();
    if (!toPhone) return toast.error('Enter a phone number to call');
    if (!selectedNumber) return toast.error('Select a caller ID number first');
    setPhase('init');
    setErrorMsg('');

    try {
      const tokenRes = await base44.functions.invoke('twilioVoiceToken', {});
      const tokenData = tokenRes.data;

      if (tokenData?.browser_calling_unavailable || !tokenData?.token) {
        // Fall back to direct REST call
        setCallMode('direct');
        return handleRestCall();
      }

      const { Device } = await import('@twilio/voice-sdk');
      destroyDevice();

      const device = new Device(tokenData.token, { logLevel: 2, codecPreferences: ['opus', 'pcmu'] });
      deviceRef.current = device;

      device.on('error', (err) => {
        console.error('[Twilio Device Error]', err);
        setErrorMsg(`Device error: ${err.message}`);
        setPhase('idle');
        destroyDevice();
      });

      await device.register();

      // Create call log
      let callLogId = '';
      try {
        const logRes = await base44.functions.invoke('twilioMakeCall', {
          lead_id: leadId, landlord_id: landlordId,
          to_phone: toPhone, from_phone: selectedNumber,
          lead_name: targetName, browser_mode: true,
        });
        callLogId = logRes.data?.call_log_id || '';
      } catch (_) {}

      const call = await device.connect({ params: { To: toPhone, CallerId: selectedNumber, call_log_id: callLogId } });
      callRef.current = call;
      setPhase('calling');

      call.on('ringing', () => setPhase('calling'));
      call.on('accept', () => setPhase('active'));
      call.on('disconnect', () => { setPhase('ended'); destroyDevice(); });
      call.on('cancel', () => { setPhase('ended'); destroyDevice(); });
      call.on('error', (err) => {
        let msg = err.message || 'Call error';
        if (err.code === 53000) msg = 'Connection error — check Twilio Hub settings or switch to Direct mode.';
        setErrorMsg(msg);
        setPhase('ended');
        destroyDevice();
      });
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to place call');
      setPhase('idle');
      destroyDevice();
    }
  };

  const handleCall = () => callMode === 'browser' ? handleBrowserCall() : handleRestCall();

  const handleHangup = () => {
    if (callRef.current) { try { callRef.current.disconnect(); } catch (_) {} }
    clearInterval(pollRef.current);
    setPhase('ended');
    destroyDevice();
  };

  const toggleMute = () => {
    if (callRef.current) { const n = !muted; callRef.current.mute(n); setMuted(n); }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const modes = [
    { id: 'direct', label: 'Direct Call', sub: 'Twilio → Customer', icon: Zap, color: '#4ade80', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)' },
    ...(cred?.api_key_sid ? [{ id: 'browser', label: 'Browser Audio', sub: 'Mic & Speakers', icon: Phone, color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)' }] : []),
    ...(cred?.agent_phone ? [{ id: 'bridge', label: 'Phone Bridge', sub: `Via ${cred.agent_phone}`, icon: Smartphone, color: '#fb923c', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)' }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && ['init', 'calling', 'active'].includes(phase)) return;
      setOpen(v);
    }}>
      <button
        onClick={() => setOpen(true)}
        title={`Call ${targetName}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95"
        style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
      >
        <Phone className="w-3 h-3" />
        {!iconOnly && 'Call'}
      </button>

      <DialogContent
        className="p-0 overflow-hidden"
        style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 360, borderRadius: 24 }}
      >
        <DialogTitle className="sr-only">Call {targetName}</DialogTitle>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="p-6 space-y-4">
            <div className="text-center pt-1">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ background: 'rgba(59,130,246,0.15)', border: '2px solid rgba(59,130,246,0.3)' }}>
                <Phone className="w-6 h-6 text-blue-400" />
              </div>
              {targetName && targetName !== defaultPhone && (
                <p className="font-semibold text-white text-base">{targetName}</p>
              )}
            </div>

            {/* Mode selector */}
            {modes.length > 1 && (
              <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${modes.length}, 1fr)` }}>
                {modes.map(m => {
                  const Icon = m.icon;
                  const active = callMode === m.id;
                  return (
                    <button key={m.id} onClick={() => setCallMode(m.id)}
                      className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: active ? m.bg : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${active ? m.border : 'rgba(255,255,255,0.1)'}`,
                        color: active ? m.color : 'rgba(255,255,255,0.4)',
                      }}>
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                      <span className="text-[10px] opacity-70">{m.sub}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Number to call */}
            <div>
              <label className="text-[11px] font-medium mb-1.5 flex items-center gap-1 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Edit2 className="w-3 h-3" /> Number to Call
              </label>
              <input
                type="tel"
                placeholder="+971XXXXXXXXX"
                value={dialNumber}
                onChange={e => setDialNumber(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
              />
              {defaultPhone && dialNumber !== defaultPhone && (
                <button onClick={() => setDialNumber(defaultPhone)}
                  className="text-[11px] mt-1 underline"
                  style={{ color: 'rgba(100,160,255,0.7)' }}>
                  Reset to {defaultPhone}
                </button>
              )}
            </div>

            {/* Caller ID */}
            <div>
              <label className="text-[11px] font-medium mb-1.5 block uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Caller ID
              </label>
              {loadingNumbers ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : numbers.length === 0 ? (
                <p className="text-xs text-amber-400">No numbers — check Twilio Hub settings.</p>
              ) : (
                <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13 }}>
                    <SelectValue />
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
              <div className="text-xs text-red-300 px-3 py-2 rounded-xl text-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {errorMsg}
              </div>
            )}

            <button
              disabled={!dialNumber.trim() || loadingNumbers}
              onClick={handleCall}
              className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.3)' }}
            >
              <Phone className="w-5 h-5" /> Call Now
            </button>
          </div>
        )}

        {/* ── INIT ── */}
        {phase === 'init' && (
          <div className="px-6 py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            <p className="text-white font-semibold">Connecting…</p>
          </div>
        )}

        {/* ── CALLING: ringing ── */}
        {phase === 'calling' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(250,180,40,0.12)', border: '2px solid rgba(250,180,40,0.4)' }}>
                <PhoneCall className="w-11 h-11 text-amber-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-amber-400 font-bold text-xs uppercase tracking-widest">Ringing…</p>
              <p className="text-white text-xl font-bold">{targetName}</p>
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{dialNumber}</p>
              {statusMsg && (
                <p className="text-xs mt-2 px-4 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>{statusMsg}</p>
              )}
            </div>
            <button onClick={handleHangup}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* ── ACTIVE ── */}
        {phase === 'active' && (
          <div className="flex flex-col" style={{ background: '#0a1628' }}>
            <div className="flex flex-col items-center pt-8 pb-4 px-6 gap-2">
              <div className="relative mb-1">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.45)' }}>
                  <Phone className="w-9 h-9 text-green-400" />
                </div>
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-400 border-2 animate-pulse"
                  style={{ borderColor: '#0a1628' }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-green-400">Live</span>
              </div>
              <p className="text-xl font-bold text-white">{targetName}</p>
              <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>{dialNumber}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 text-white/40" />
                <span className="text-2xl font-mono font-bold text-white">{formatTime(elapsed)}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 pb-8 pt-2">
              {callMode === 'browser' && (
                <div className="flex flex-col items-center gap-1">
                  <button onClick={toggleMute}
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    }}>
                    {muted ? <MicOff className="w-6 h-6 text-red-400" /> : <Mic className="w-6 h-6 text-white/70" />}
                  </button>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{muted ? 'Unmute' : 'Mute'}</span>
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                <button onClick={handleHangup}
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}>
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>End Call</span>
              </div>
            </div>
          </div>
        )}

        {/* ── ENDED ── */}
        {phase === 'ended' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' }}>
              <PhoneOff className="w-9 h-9 text-slate-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-semibold text-white">{targetName || dialNumber}</p>
              {elapsed > 0 && <p className="text-sm font-mono text-white/40">Duration: {formatTime(elapsed)}</p>}
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