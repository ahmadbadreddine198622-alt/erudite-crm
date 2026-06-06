import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Loader2, PhoneCall, PhoneOff, Mic, MicOff, Clock } from 'lucide-react';
import { toast } from 'sonner';

// Phase: 'dial' | 'calling' | 'active' | 'ended'

export default function TwilioCallDialog({ lead, contact, size = 'sm', iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [phase, setPhase] = useState('dial'); // dial | calling | active | ended
  const [callSid, setCallSid] = useState(null);
  const [callLogId, setCallLogId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hangingUp, setHangingUp] = useState(false);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const targetPhone = lead?.phone || contact?.phone;
  const targetName = lead?.full_name || lead?.name || contact?.full_name || contact?.name || targetPhone;
  const leadId = lead?.id || contact?.id;

  // Load numbers when dialog opens
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

  // Start elapsed timer when call goes active
  useEffect(() => {
    if (phase === 'active') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Poll call status to detect when ringing becomes active / ends
  useEffect(() => {
    if (phase === 'calling' && callSid) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await base44.functions.invoke('twilioGetCallStatus', { call_sid: callSid });
          const status = res.data?.status;
          if (status === 'in-progress') {
            setPhase('active');
            clearInterval(pollRef.current);
          } else if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
            setPhase('ended');
            clearInterval(pollRef.current);
          }
        } catch (_) {}
      }, 2000);
    }
    return () => clearInterval(pollRef.current);
  }, [phase, callSid]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setPhase('dial');
      setCallSid(null);
      setCallLogId(null);
      setMuted(false);
      setElapsed(0);
      setHangingUp(false);
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    }
  }, [open]);

  const handleCall = async () => {
    if (!selectedNumber || !targetPhone) return;
    setPhase('calling');
    try {
      const res = await base44.functions.invoke('twilioMakeCall', {
        lead_id: leadId,
        to_phone: targetPhone,
        from_phone: selectedNumber,
        lead_name: targetName,
      });
      if (res.data?.ok) {
        setCallSid(res.data.call_sid);
        setCallLogId(res.data.call_log_id);
        // Move to active immediately — the server-side call dials agent's phone then bridges
        // We show active panel right away; hangup always works via REST
        setTimeout(() => setPhase('active'), 3000);
      } else {
        toast.error(res.data?.error || 'Call failed');
        setPhase('dial');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Call failed');
      setPhase('dial');
    }
  };

  const handleHangup = async () => {
    if (!callSid) {
      setPhase('ended');
      return;
    }
    setHangingUp(true);
    try {
      await base44.functions.invoke('twilioHangupCall', { call_sid: callSid });
    } catch (_) {}
    setHangingUp(false);
    setPhase('ended');
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      // Prevent closing mid-call accidentally
      if (!v && (phase === 'calling' || phase === 'active')) return;
      setOpen(v);
    }}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="outline"
          className="gap-1.5"
          title={`Call ${targetName} via Twilio`}
          disabled={!targetPhone}
          onClick={() => setOpen(true)}
        >
          <Phone className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
          {!iconOnly && <span>Call</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden" style={{ background: '#0d1829', border: '1px solid rgba(255,255,255,0.1)' }}>
        {/* ── DIAL PHASE ── */}
        {phase === 'dial' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-white">
                <PhoneCall className="w-5 h-5 text-blue-400" />
                Call via Twilio
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4">
              {/* Target card */}
              <div className="rounded-xl p-4 text-center space-y-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2 border border-blue-500/30">
                  <Phone className="w-6 h-6 text-blue-400" />
                </div>
                <p className="font-semibold text-white text-lg">{targetName}</p>
                <p className="text-sm text-blue-300 font-mono">{targetPhone}</p>
              </div>

              {/* Number picker */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Call from
                </label>
                {loadingNumbers ? (
                  <div className="flex items-center gap-2 text-sm py-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading numbers…
                  </div>
                ) : numbers.length === 0 ? (
                  <p className="text-sm text-amber-400">No Twilio numbers configured.</p>
                ) : (
                  <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                    <SelectTrigger style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}>
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

              {/* Call button */}
              <button
                disabled={!selectedNumber || !targetPhone}
                onClick={handleCall}
                className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}
              >
                <Phone className="w-5 h-5" />
                Call Now
              </button>
            </div>
          </>
        )}

        {/* ── CALLING / RINGING PHASE ── */}
        {phase === 'calling' && (
          <div className="px-6 py-10 flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-green-500/15 flex items-center justify-center border border-green-500/30 animate-pulse">
                <Phone className="w-10 h-10 text-green-400" />
              </div>
              <div className="absolute inset-0 rounded-full border border-green-500/20 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Connecting</p>
              <p className="text-xl font-semibold text-white">{targetName}</p>
              <p className="text-sm font-mono text-green-400">{targetPhone}</p>
            </div>
            <button
              onClick={handleHangup}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </div>
        )}

        {/* ── ACTIVE CALL PHASE ── */}
        {phase === 'active' && (
          <div className="px-6 py-8 flex flex-col items-center gap-5">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-green-500/15 flex items-center justify-center border-2 border-green-500/40">
              <Phone className="w-10 h-10 text-green-400" />
            </div>

            {/* Name & timer */}
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-semibold text-green-400">Live</span>
              </div>
              <p className="text-xl font-semibold text-white">{targetName}</p>
              <p className="text-sm font-mono text-green-400">{targetPhone}</p>
              <div className="flex items-center justify-center gap-1.5 mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <Clock className="w-3.5 h-3.5" />
                <span className="text-lg font-mono font-bold text-white">{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6 mt-2">
              {/* Mute toggle */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => setMuted(m => !m)}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{
                    background: muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  }}
                >
                  {muted
                    ? <MicOff className="w-6 h-6 text-red-400" />
                    : <Mic className="w-6 h-6 text-white" />
                  }
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{muted ? 'Unmute' : 'Mute'}</span>
              </div>

              {/* Hangup */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={handleHangup}
                  disabled={hangingUp}
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}
                >
                  {hangingUp
                    ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                    : <PhoneOff className="w-7 h-7 text-white" />
                  }
                </button>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Hang Up</span>
              </div>
            </div>

            <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Call is bridged through your Twilio number
            </p>
          </div>
        )}

        {/* ── ENDED PHASE ── */}
        {phase === 'ended' && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-slate-500/15 flex items-center justify-center border border-slate-500/30">
              <PhoneOff className="w-9 h-9 text-slate-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xl font-semibold text-white">{targetName}</p>
              {elapsed > 0 && (
                <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Duration: {formatTime(elapsed)}
                </p>
              )}
              <p className="text-sm text-slate-400 mt-1">Call ended</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="px-6 py-2.5 rounded-xl font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Close
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}