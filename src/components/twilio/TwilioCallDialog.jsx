import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Phone, Loader2, PhoneCall, PhoneOff, Mic, MicOff,
  Volume2, VolumeX, Clock, Delete
} from 'lucide-react';
import { toast } from 'sonner';

export default function TwilioCallDialog({ lead, contact, iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [manualNumber, setManualNumber] = useState('');

  // phase: dial | placing | ringing | connected | ended
  const [phase, setPhase] = useState('dial');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [callSids, setCallSids] = useState({ agent: '', customer: '', log: '' });
  const [dialPadInput, setDialPadInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

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

  // ── Poll Twilio call status ──────────────────────────────────────────────
  const startPolling = useCallback((agentSid, customerSid, logId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!['ringing', 'connected'].includes(phaseRef.current)) {
        clearInterval(pollRef.current);
        return;
      }
      try {
        // Check agent call status
        const agentRes = await base44.functions.invoke('twilioGetCallStatus', { call_sid: agentSid });
        const agentStatus = agentRes.data?.status;

        // Check customer call status
        const custRes = await base44.functions.invoke('twilioGetCallStatus', { call_sid: customerSid });
        const custStatus = custRes.data?.status;

        // Agent answered → connected
        if (agentStatus === 'in-progress' && phaseRef.current === 'ringing') {
          setPhase('connected');
          setStatusMsg('');
        }

        // Agent hung up → end call
        if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(agentStatus)) {
          clearInterval(pollRef.current);
          setPhase('ended');
          return;
        }

        // Customer status for display only
        if (custStatus === 'in-progress' && phaseRef.current === 'ringing') {
          setStatusMsg('Customer answered');
        }

      } catch (_) {}
    }, 3000);
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'connected') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Reset on close ───────────────────────────────────────────────────────
  const fullReset = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    setPhase('dial');
    setElapsed(0);
    setErrorMsg('');
    setCallSids({ agent: '', customer: '', log: '' });
    setDialPadInput('');
    setStatusMsg('');
  }, []);

  useEffect(() => {
    if (!open) fullReset();
  }, [open, fullReset]);

  // ── Place call ───────────────────────────────────────────────────────────
  const handleCall = async () => {
    const dialTo = manualNumber.trim() || targetPhone;
    if (!dialTo) return toast.error('No phone number');
    if (!selectedNumber) return toast.error('Select a Twilio number first');

    setPhase('placing');
    setErrorMsg('');

    try {
      const res = await base44.functions.invoke('twilioMakeCall', {
        lead_id: leadId,
        to_phone: dialTo,
        from_phone: selectedNumber,
        lead_name: targetName,
        browser_mode: false,
      });

      const data = res.data;
      if (!data?.ok) {
        setErrorMsg(data?.error || 'Call failed');
        setPhase('dial');
        return;
      }

      const sids = {
        agent: data.agent_call_sid || '',
        customer: data.customer_call_sid || '',
        log: data.call_log_id || '',
      };
      setCallSids(sids);
      setPhase('ringing');

      // Start polling for real status updates
      if (sids.agent) startPolling(sids.agent, sids.customer, sids.log);

    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to place call';
      setErrorMsg(msg);
      setPhase('dial');
    }
  };

  // ── Hang up — kills agent leg (which ends conference) ────────────────────
  const handleHangup = async () => {
    clearInterval(pollRef.current);
    setPhase('ended');
    // Kill both legs to be safe
    const { agent, customer } = callSids;
    const tasks = [];
    if (agent) tasks.push(base44.functions.invoke('twilioHangupCall', { call_sid: agent }).catch(() => {}));
    if (customer) tasks.push(base44.functions.invoke('twilioHangupCall', { call_sid: customer }).catch(() => {}));
    await Promise.all(tasks);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const dialTo = manualNumber.trim() || targetPhone;
  const isActive = ['placing', 'ringing', 'connected'].includes(phase);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && isActive) return;
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
        <DialogTitle className="sr-only">Call {targetName}</DialogTitle>

        {/* ── DIAL ──────────────────────────────────────────────────────── */}
        {phase === 'dial' && (
          <div className="p-6 space-y-5">
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

            <input
              type="tel"
              placeholder="Or dial any number e.g. +971581806000"
              value={manualNumber}
              onChange={e => setManualNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', caretColor: '#60a5fa' }}
            />

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
              <p className="text-xs text-red-400 text-center px-2 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>{errorMsg}</p>
            )}

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

        {/* ── PLACING ───────────────────────────────────────────────────── */}
        {phase === 'placing' && (
          <div className="px-6 py-14 flex flex-col items-center gap-5">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <p className="text-white font-semibold text-lg">Starting call…</p>
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Connecting to Twilio</p>
          </div>
        )}

        {/* ── RINGING ───────────────────────────────────────────────────── */}
        {phase === 'ringing' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(250,180,40,0.12)', border: '2px solid rgba(250,180,40,0.4)' }}>
                <PhoneCall className="w-10 h-10 text-amber-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-amber-400 font-bold text-sm uppercase tracking-widest">Ringing…</p>
              <p className="text-white text-lg font-semibold">{targetName}</p>
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{dialTo}</p>
              {statusMsg && (
                <p className="text-xs text-green-400 mt-1">{statusMsg}</p>
              )}
            </div>
            <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Your phone will ring first — pick up to speak with the customer
            </p>
            <button onClick={handleHangup}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        )}

        {/* ── CONNECTED ─────────────────────────────────────────────────── */}
        {phase === 'connected' && (
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
                <Clock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-xl font-mono font-bold text-white">{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* Keypad input display */}
            <div className="mx-6 mb-2 flex items-center justify-between px-4 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 40 }}>
              <span className="text-lg font-mono tracking-widest text-white">
                {dialPadInput || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Keypad</span>}
              </span>
              {dialPadInput && (
                <button onClick={() => setDialPadInput(p => p.slice(0, -1))} className="ml-2 opacity-60 hover:opacity-100">
                  <Delete className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Numeric keypad */}
            <div className="grid grid-cols-3 gap-2 px-6 py-2">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(k => (
                <button key={k} onClick={() => setDialPadInput(p => p + k)}
                  className="h-11 rounded-2xl text-base font-semibold text-white flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {k}
                  <span className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {{'2':'ABC','3':'DEF','4':'GHI','5':'JKL','6':'MNO','7':'PQRS','8':'TUV','9':'WXYZ'}[k] || ''}
                  </span>
                </button>
              ))}
            </div>

            {/* End Call */}
            <div className="flex items-center justify-center py-5">
              <div className="flex flex-col items-center gap-1.5">
                <button onClick={handleHangup}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}>
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>End Call</span>
              </div>
            </div>
          </div>
        )}

        {/* ── ENDED ─────────────────────────────────────────────────────── */}
        {phase === 'ended' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' }}>
              <PhoneOff className="w-9 h-9 text-slate-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-semibold text-white">{targetName || dialTo}</p>
              {elapsed > 0 && (
                <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Duration: {formatTime(elapsed)}</p>
              )}
              {errorMsg && <p className="text-xs text-red-400 mt-1">{errorMsg}</p>}
              <p className="text-sm text-slate-400 mt-1">Call ended</p>
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