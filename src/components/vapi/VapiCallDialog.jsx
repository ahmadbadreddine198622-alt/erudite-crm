import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneOff, Loader2, Mic } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export default function VapiCallDialog({ lead, landlord, iconOnly = false }) {
    const [open, setOpen]                   = useState(false);
    const [assistants, setAssistants]       = useState([]);
    const [phoneNumbers, setPhoneNumbers]   = useState([]); // VAPI phone numbers
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('');
    const [phoneNumber, setPhoneNumber]     = useState('');
    const [loading, setLoading]             = useState(false);
    const [fetchingSetup, setFetchingSetup] = useState(false);

    // PHASES: idle | calling | ringing | active | ended
    const [phase, setPhase]           = useState('idle');
    const [activeCallId, setActiveCallId] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [hangingUp, setHangingUp]   = useState(false);
    const [endReason, setEndReason]   = useState('');
    const [errorMsg, setErrorMsg]     = useState('');

    const timerRef  = useRef(null);
    const pollerRef = useRef(null);
    const callIdRef = useRef(null); // stable ref so poller doesn't need activeCallId in deps

    const entity     = lead || landlord;
    const entityPhone = entity?.phone || entity?.whatsapp || '';
    const entityName  = lead?.full_name || landlord?.full_name_en || landlord?.first_name || '';

    // ── Timer (counts only while active) ──
    useEffect(() => {
        if (phase === 'active') {
            timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [phase]);

    // ── Status poller — only keyed on activeCallId, uses ref for phase transitions ──
    const startPoller = useCallback((callId) => {
        clearInterval(pollerRef.current);
        callIdRef.current = callId;

        pollerRef.current = setInterval(async () => {
            try {
                const res = await base44.functions.invoke('getVapiCallStatus', { callId: callIdRef.current });
                const status = res?.data?.status;
                const endedReason = res?.data?.endedReason;

                if (!status) return;

                if (status === 'in-progress') {
                    setPhase('active');
                } else if (status === 'ringing' || status === 'queued') {
                    setPhase('ringing');
                } else if (['ended', 'failed', 'cancelled'].includes(status)) {
                    clearInterval(pollerRef.current);
                    setEndReason(endedReason || status);
                    setPhase('ended');
                }
            } catch (_) {}
        }, 3000);
    }, []);

    // Cleanup on unmount
    useEffect(() => () => {
        clearInterval(timerRef.current);
        clearInterval(pollerRef.current);
    }, []);



    const handleOpenChange = (isOpen) => {
        // Block closing mid-call
        if (!isOpen && (phase === 'ringing' || phase === 'active' || phase === 'calling')) return;
        setOpen(isOpen);
        if (isOpen) {
            setPhoneNumber(entityPhone);
            setPhase('idle');
            setActiveCallId(null);
            callIdRef.current = null;
            setCallDuration(0);
            setEndReason('');
            setErrorMsg('');
            clearInterval(pollerRef.current);
            if (assistants.length === 0) {
                setFetchingSetup(true);
                Promise.all([
                    base44.functions.invoke('listVapiAssistants', {}).catch(() => null),
                    base44.functions.invoke('listVapiPhoneNumbers', {}).catch(() => null),
                ]).then(([aRes, pRes]) => {
                    if (aRes?.data?.success && aRes.data.assistants?.length) {
                        setAssistants(aRes.data.assistants);
                        setSelectedAssistant(aRes.data.assistants[0].id);
                    }
                    if (pRes?.data?.success && pRes.data.phoneNumbers?.length) {
                        setPhoneNumbers(pRes.data.phoneNumbers);
                        setSelectedPhoneNumberId(pRes.data.phoneNumbers[0].id);
                    }
                }).catch(() => {}).finally(() => setFetchingSetup(false));
            }
        } else {
            clearInterval(pollerRef.current);
            clearInterval(timerRef.current);
        }
    };

    const handleMakeCall = async () => {
        if (!selectedAssistant) {
            toast.error('Please select an AI assistant');
            return;
        }
        const num = phoneNumber.trim();
        if (!num) {
            toast.error('Please enter a phone number to call');
            return;
        }

        setLoading(true);
        setPhase('calling');
        setErrorMsg('');

        try {
            const response = await base44.functions.invoke('makeVapiCall', {
                assistantId: selectedAssistant,
                phoneNumberId: selectedPhoneNumberId || undefined,
                phoneNumber: num,
                leadId: lead?.id,
                landlordId: landlord?.id,
                leadName: entityName,
            });

            const data = response.data;

            if (data?.success && data?.callId) {
                setActiveCallId(data.callId);
                callIdRef.current = data.callId;
                setPhase('ringing');
                startPoller(data.callId);
                toast.success('Call initiated — ringing now');
            } else {
                const errText = data?.error || 'Failed to start call';
                setErrorMsg(errText);
                setPhase('idle');
                toast.error(errText);
            }
        } catch (err) {
            const errText = err?.response?.data?.error || err?.message || 'Network error';
            setErrorMsg(errText);
            setPhase('idle');
            toast.error(errText);
        } finally {
            setLoading(false);
        }
    };

    const handleHangUp = async () => {
        setHangingUp(true);
        clearInterval(pollerRef.current);
        try {
            if (callIdRef.current) {
                await base44.functions.invoke('hangupVapiCall', { callId: callIdRef.current });
            }
        } catch (_) {}
        setHangingUp(false);
        setPhase('ended');
        setEndReason('hung_up');
        clearInterval(timerRef.current);
    };

    const resetToIdle = () => {
        clearInterval(pollerRef.current);
        clearInterval(timerRef.current);
        setPhase('idle');
        setActiveCallId(null);
        callIdRef.current = null;
        setCallDuration(0);
        setEndReason('');
        setErrorMsg('');
    };

    // ─── Shared button styles ───────────────────────────────────────────────
    const hangupBtnStyle = {
        background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
        boxShadow: '0 6px 24px rgba(239,68,68,0.55)',
    };
    const callBtnStyle = {
        background: loading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
        boxShadow: '0 6px 24px rgba(139,92,246,0.45)',
    };

    // ─── Avatar initials ───────────────────────────────────────────────────
    const initial = (entityName || phoneNumber || '?').charAt(0).toUpperCase();

    const trigger = iconOnly ? (
        <button title="AI Voice Call (VAPI)"
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:scale-105"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <Mic className="w-4 h-4 text-violet-400" />
        </button>
    ) : (
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
            <Mic className="w-4 h-4" /> AI Voice Call
        </button>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>

            <DialogContent
                className="p-0 overflow-hidden"
                style={{
                    background: 'linear-gradient(160deg, #12101f 0%, #0d1120 100%)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 20,
                    maxWidth: 360,
                    width: '90vw',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.15)',
                }}
            >
                <DialogTitle className="sr-only">VAPI AI Voice Call</DialogTitle>

                {/* ══ IDLE — Setup screen ══════════════════════════════════ */}
                {(phase === 'idle' || phase === 'calling') && (
                    <div className="p-6 space-y-5">
                        {/* Header */}
                        <div className="text-center space-y-1">
                            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
                                style={{ background: 'rgba(139,92,246,0.15)', border: '2px solid rgba(139,92,246,0.35)' }}>
                                <Mic className="w-6 h-6 text-violet-400" />
                            </div>
                            <p className="text-white font-bold text-base mt-2">AI Voice Call</p>
                            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Powered by VAPI</p>
                        </div>

                        {/* Error banner */}
                        {errorMsg && (
                            <div className="rounded-lg px-3 py-2 text-xs text-red-300 text-center"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                ⚠ {errorMsg}
                            </div>
                        )}

                        {/* Fields */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}>AI Assistant</Label>
                                {fetchingSetup ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading assistants…
                                    </div>
                                ) : (
                                    <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                                        <SelectTrigger className="h-9 text-sm"
                                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                                            <SelectValue placeholder="Select assistant…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {assistants.length === 0
                                                ? <div className="p-2 text-sm text-muted-foreground">No assistants found</div>
                                                : assistants.map(a => (
                                                    <SelectItem key={a.id} value={a.id}>{a.name || 'Unnamed'}</SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* VAPI Caller ID (outbound number) */}
                            {phoneNumbers.length > 0 && (
                                <div>
                                    <Label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block"
                                        style={{ color: 'rgba(255,255,255,0.4)' }}>Call From (VAPI Number)</Label>
                                    <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                                        <SelectTrigger className="h-9 text-sm"
                                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                                            <SelectValue placeholder="Select caller number…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {phoneNumbers.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name} · {p.number}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}>Phone Number to Call</Label>
                                <Input
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !loading && handleMakeCall()}
                                    placeholder="+971 50 123 4567"
                                    className="text-base font-mono text-center h-10"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.95)' }}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => setOpen(false)}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                                Cancel
                            </button>
                            <button
                                onClick={handleMakeCall}
                                disabled={loading || !selectedAssistant || !phoneNumber.trim()}
                                className="flex-1 py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-sm disabled:opacity-40 transition-all active:scale-95"
                                style={callBtnStyle}>
                                {loading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Calling…</>
                                    : <><Phone className="w-4 h-4" /> Call Now</>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* ══ RINGING ══════════════════════════════════════════════ */}
                {phase === 'ringing' && (
                    <div className="px-6 py-10 flex flex-col items-center gap-7">
                        {/* Pulsing avatar */}
                        <div className="relative flex items-center justify-center">
                            <div className="absolute w-28 h-28 rounded-full animate-ping opacity-20"
                                style={{ background: 'rgba(139,92,246,0.6)' }} />
                            <div className="absolute w-24 h-24 rounded-full animate-ping opacity-10 animation-delay-150"
                                style={{ background: 'rgba(139,92,246,0.8)' }} />
                            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold relative z-10"
                                style={{ background: 'rgba(139,92,246,0.25)', border: '2px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }}>
                                {initial}
                            </div>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-violet-400 font-bold text-[11px] uppercase tracking-widest animate-pulse">Ringing…</p>
                            <p className="text-white text-xl font-bold">{entityName || 'Contact'}</p>
                            <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>{phoneNumber}</p>
                        </div>

                        {/* Hang up button — large, always visible */}
                        <button
                            onClick={handleHangUp}
                            disabled={hangingUp}
                            className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                            style={hangupBtnStyle}>
                            {hangingUp
                                ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                                : <PhoneOff className="w-7 h-7 text-white" />
                            }
                        </button>
                        <p className="text-[11px] text-red-400 -mt-4">Tap to hang up</p>
                    </div>
                )}

                {/* ══ ACTIVE / CONNECTED ═══════════════════════════════════ */}
                {phase === 'active' && (
                    <div className="px-6 py-10 flex flex-col items-center gap-6">
                        {/* Avatar with green pulse */}
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                                style={{ background: 'rgba(139,92,246,0.2)', border: '2px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }}>
                                {initial}
                            </div>
                            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 animate-pulse"
                                style={{ borderColor: '#0d1120' }} />
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-emerald-400 font-bold text-[11px] uppercase tracking-widest">● Connected · AI Speaking</p>
                            <p className="text-white text-xl font-bold">{entityName || 'Contact'}</p>
                            <p className="text-3xl font-mono font-bold text-white tabular-nums mt-1">{fmt(callDuration)}</p>
                            <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{phoneNumber}</p>
                        </div>

                        {/* Hang up button */}
                        <button
                            onClick={handleHangUp}
                            disabled={hangingUp}
                            className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                            style={hangupBtnStyle}>
                            {hangingUp
                                ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                                : <PhoneOff className="w-7 h-7 text-white" />
                            }
                        </button>
                        <p className="text-[11px] text-red-400 -mt-4">Tap to hang up</p>
                    </div>
                )}

                {/* ══ ENDED ════════════════════════════════════════════════ */}
                {phase === 'ended' && (
                    <div className="px-6 py-10 flex flex-col items-center gap-5">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.25)' }}>
                            <PhoneOff className="w-9 h-9 text-slate-400" />
                        </div>
                        <div className="text-center space-y-1.5">
                            <p className="text-xl font-bold text-white">{entityName || phoneNumber}</p>
                            {callDuration > 0 && (
                                <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    Duration: {fmt(callDuration)}
                                </p>
                            )}
                            <p className="text-sm text-slate-400">
                                {endReason === 'hung_up'
                                    ? 'Call ended by you'
                                    : endReason
                                    ? `Ended: ${endReason.replace(/_/g, ' ')}`
                                    : 'Call ended'}
                            </p>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button onClick={resetToIdle}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                                Call Again
                            </button>
                            <button onClick={() => setOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
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