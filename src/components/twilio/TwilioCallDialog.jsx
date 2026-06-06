import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Loader2, PhoneCall, PhoneOff, Clock, Delete } from 'lucide-react';
import { toast } from 'sonner';

export default function TwilioCallDialog({ lead, contact, iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [manualNumber, setManualNumber] = useState('');

  // phase: dial | calling | active | ended
  const [phase, setPhase] = useState('dial');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [callSid, setCallSid] = useState('');
  const [dialPadInput, setDialPadInput] = useState('');

  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const targetPhone = lead?.phone || contact?.phone || '';
  const targetName = lead?.full_name || lead?.full_name_en || lead?.name || contact?.full_name || contact?.name || targetPhone;
  const leadId = lead?.id || contact?.id;

  // Load numbers on open
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

  // Timer when active
  useEffect(() => {
    if (phase === 'active') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Poll call status to auto-detect connect/end
  const startPolling = useCallback((sid) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const p = phaseRef.current;
      if (!['calling', 'active'].includes(p)) {
        clearInterval(pollRef.current);
        return;
      }
      try {
        const res = await base44.functions.invoke('twilioGetCallStatus', { call_sid: sid });
        const status = res.data?.status;
        if (status === 'in-progress' && p === 'calling') {
          setPhase('active');
        } else if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
          clearInterval(pollRef.current);
          setPhase('ended');
        }
      } catch (_) {}
    }, 3000);
  }, []);

  const fullReset = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    setPhase('dial');
    setElapsed(0);
    setErrorMsg('');
    setCallSid('');
    setDialPadInput('');
  }, []);

  useEffect(() => { if (!open) fullReset(); }, [open, fullReset]);

  const handleCall = async () => {
    const dialTo = manualNumber.trim() || targetPhone;
    if (!dialTo) return toast.error('No phone number');
    if (!selectedNumber) return toast.error('Select a Twilio number first');

    setPhase('calling');
    setErrorMsg('');

    try {
      const res = await base44.functions.invoke('twilioMakeCall', {
        lead_id: leadId,
        to_phone: dialTo,
        from_phone: selectedNumber,
        lead_name: targetName,
      });

      const data = res.data;
      if (!data?.ok) {
        setErrorMsg(data?.error || 'Call failed');
        setPhase('dial');
        return;
      }

      setCallSid(data.call_sid || '');
      if (data.call_sid) startPolling(data.call_sid);

    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to place call';
      setErrorMsg(msg);
      setPhase('dial');
    }
  };

  const handleHangup = async () => {
    clearInterval(pollRef.current);
    setPhase('ended');
    if (callSid) {
      base44.functions.invoke('twilioHangupCall', { call_sid: callSid }).catch(() => {});
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
      if (!v && ['calling', 'active'].includes(phase)) return;
      setOpen(v);
    }}>
      <button
        onClick={() => setOpen(true)}
        disabled={!targetPhone && !manualNumber}
        title={`Call ${targetName}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
        style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
      >
        <Phone className="w-3 h-3" />
        {!iconOnly && 'Call'}
      </button>

      <DialogContent className="p-0 overflow-hidden" style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 360, borderRadius: 24 }}>
        <DialogTitle className="sr-only">Call {targetName}</DialogTitle>

        {/* DIAL */}
        {phase === 'dial' && (
          <div className="p-6 space-y-5">
            <div className="text-center pt-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(59,130,246,0.15)', border: '2px solid rgba(59,130,246,0.3)' }}>
                <Phone className="w-7 h-7 text-blue-400" />
              </div>
              {targetName && targetName !== targetPhone && (
                <p className="font-semibold text-white text-lg">{targetName}</p>
              )}
              <p className="text-sm font-mono text-blue-300 mt-1">{dialTo || 'Enter number below'}</p>
            </div>

            <input
              type="tel"
              placeholder="+971XXXXXXXXX"
              value={manualNumber}
              onChange={e => setManualNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />

            <div>
              <label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.45)' }}>CALLER ID</label>
              {loadingNumbers ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : numbers.length === 0 ? (
                <p className="text-xs text-amber-400">No numbers found — check Twilio Hub settings.</p>
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
              <div className="text-xs text-red-300 text-center px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {errorMsg}
              </div>
            )}

            <button
              disabled={!selectedNumber || !dialTo}
              onClick={handleCall}
              className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.3)' }}
            >
              <Phone className="w-5 h-5" /> Call Now
            </button>
          </div>
        )}

        {/* CALLING — waiting for agent to pick up */}
        {phase === 'calling' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(250,180,40,0.12)', border: '2px solid rgba(250,180,40,0.4)' }}>
                <PhoneCall className="w-11 h-11 text-amber-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-amber-400 font-bold text-sm uppercase tracking-widest">Calling…</p>
              <p className="text-white text-xl font-bold">{targetName}</p>
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{dialTo}</p>
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                📱 Your phone will ring — pick up to connect with the customer
              </p>
            </div>
            <button onClick={handleHangup}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* ACTIVE — on call */}
        {phase === 'active' && (
          <div className="flex flex-col" style={{ background: '#0a1628' }}>
            <div className="flex flex-col items-center pt-8 pb-3 px-6 gap-2">
              <div className="relative mb-1">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.45)' }}>
                  <Phone className="w-9 h-9 text-green-400" />
                </div>
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-400 border-2" style={{ borderColor: '#0a1628' }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-green-400">Live</span>
              </div>
              <p className="text-xl font-bold text-white">{targetName}</p>
              <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>{dialTo}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5 text-white/40" />
                <span className="text-xl font-mono font-bold text-white">{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* Keypad */}
            <div className="mx-6 mb-2 flex items-center justify-between px-4 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 40 }}>
              <span className="text-lg font-mono tracking-widest text-white">
                {dialPadInput || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Keypad</span>}
              </span>
              {dialPadInput && (
                <button onClick={() => setDialPadInput(p => p.slice(0, -1))}>
                  <Delete className="w-4 h-4 text-white/60" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 px-6 py-2">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => (
                <button key={k} onClick={() => setDialPadInput(p => p + k)}
                  className="h-11 rounded-2xl text-base font-semibold text-white flex flex-col items-center justify-center transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {k}
                  <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {{'2':'ABC','3':'DEF','4':'GHI','5':'JKL','6':'MNO','7':'PQRS','8':'TUV','9':'WXYZ'}[k]||''}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-1.5 py-5">
              <button onClick={handleHangup}
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}>
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>End Call</span>
            </div>
          </div>
        )}

        {/* ENDED */}
        {phase === 'ended' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' }}>
              <PhoneOff className="w-9 h-9 text-slate-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-semibold text-white">{targetName || dialTo}</p>
              {elapsed > 0 && <p className="text-sm font-mono text-white/40">Duration: {formatTime(elapsed)}</p>}
              {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
              <p className="text-sm text-slate-400">Call ended</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setPhase('dial'); setErrorMsg(''); }}
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